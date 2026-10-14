import { describe, expect, it, vi } from "vitest";
import { importDocument, needsPageOCR } from "@/lib/documentImport";
import { joinDocumentFragments, normalizedBox, type DocumentFragment } from "@/lib/documentLayout";
import { evaluationMatches, textSimilarity } from "@/lib/evaluation";

const ocr = vi.hoisted(() => ({ recognize: vi.fn(), terminate: vi.fn().mockResolvedValue(undefined) }));
const createWorker = vi.hoisted(() => vi.fn().mockResolvedValue(ocr));
vi.mock("tesseract.js", () => ({ createWorker }));

function fragment(text: string, x: number, y: number, width = 200): DocumentFragment {
  return { text, x, y, width, height: 12, confidence: 100, box: { x: x / 600, y: y / 800, width: width / 600, height: 12 / 800 } };
}

describe("document layout and OCR decisions", () => {
  it.each([25, 90, 180])("OCRs a scanned body even with %i selectable header characters", (characters) => {
    expect(needsPageOCR(characters, 0.7)).toBe(true);
    expect(needsPageOCR(characters, 0.01)).toBe(false);
  });
  it("OCRs sparse image pages and leaves ordinary text pages local to pdf.js", () => {
    expect(needsPageOCR(5, 0)).toBe(true);
    expect(needsPageOCR(1500, 0)).toBe(false);
  });
  it("preserves table rows and their evidence spans", () => {
    const rows = [fragment("Principal", 20, 20, 90), fragment("$12,000", 320, 20), fragment("APR", 20, 40, 90), fragment("8%", 320, 40), fragment("Term", 20, 60, 90), fragment("36 months", 320, 60)];
    const result = joinDocumentFragments(rows, 3, 10, 600);
    expect(result.text).toBe("Principal\t$12,000\nAPR\t8%\nTerm\t36 months");
    result.spans.forEach((span, index) => expect(result.text.slice(span.start - 10, span.end - 10)).toBe(rows[index].text));
    expect(result.spans.every((span) => span.page === 3)).toBe(true);
  });
  it.each([31, 34, 36])("keeps small punctuation and dot leaders at baseline %i with their text", (baseline) => {
    const result = joinDocumentFragments([
      fragment("Processing fee", 20, 20, 130),
      { ...fragment("........", 160, baseline, 60), height: 2 },
      fragment("4%", 240, 20, 40),
    ], 1, 0, 600);
    expect(result.text).toBe("Processing fee\t........\t4%");
  });
  it("reads prose columns in order rather than mixing independent clauses", () => {
    const left = ["The borrower may pay this loan early without penalty.", "The full principal is due at the end of this term.", "Any notices will be sent to the address stated above."];
    const right = ["The lender cannot change any terms without written consent.", "The borrower can select an insurer of their own choice.", "The parties must each sign any amendment to this agreement."];
    const fragments = left.flatMap((text, index) => [fragment(text, 10, 20 + index * 20, 240), fragment(right[index], 330, 20 + index * 20, 250)]);
    expect(joinDocumentFragments(fragments, 1, 0, 600).text).toBe([...left, ...right].join("\n"));
  });
  it("bounds rotated and cropped evidence to the visible page", () => {
    expect(normalizedBox([[100, 200], [110, 150], [90, 150], [95, 200]], 600, 800)).toEqual({ x: 0.15, y: 0.1875, width: 20 / 600, height: 50 / 800 });
    expect(normalizedBox([[-10, -5], [610, 810]], 600, 800)).toEqual({ x: 0, y: 0, width: 1, height: 1 });
  });
  it("cancels before decoding and reports unsupported/empty images", async () => {
    const controller = new AbortController(); controller.abort();
    await expect(importDocument(new File(["pdf"], "contract.pdf"), { signal: controller.signal })).rejects.toMatchObject({ name: "AbortError" });
    await expect(importDocument(new File(["tiff"], "scan.tiff"))).rejects.toThrow("Convert TIFF");
    await expect(importDocument(new File([], "empty.pdf"))).rejects.toThrow("empty");
  });
  it("rejects oversized PNG dimensions before allocating a bitmap", async () => {
    const bytes = new Uint8Array(24);
    bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    new DataView(bytes.buffer).setUint32(16, 100_000);
    new DataView(bytes.buffer).setUint32(20, 1_000);
    const decode = vi.fn();
    vi.stubGlobal("createImageBitmap", decode);
    try {
      await expect(importDocument(new File([bytes], "oversized.png", { type: "image/png" }))).rejects.toThrow("dimensions are too large");
      expect(decode).not.toHaveBeenCalled();
    } finally { vi.unstubAllGlobals(); }
  });
  it("reads legacy BMP dimensions without falsely rejecting the supported image", async () => {
    const bytes = new Uint8Array(26);
    bytes.set([0x42, 0x4d]);
    const view = new DataView(bytes.buffer);
    view.setUint32(14, 12, true);
    view.setUint16(18, 1000, true); view.setUint16(20, 1000, true);
    view.setUint16(22, 1, true); view.setUint16(24, 24, true);
    const decode = vi.fn().mockRejectedValue(new Error("Decode probe"));
    vi.stubGlobal("createImageBitmap", decode);
    try {
      await expect(importDocument(new File([bytes], "legacy.bmp", { type: "image/bmp" }))).rejects.toThrow("could not be decoded");
      expect(decode).toHaveBeenCalledOnce();
    } finally { vi.unstubAllGlobals(); }
  });
  it("terminates in-flight OCR even if the worker never settles its recognition promise", async () => {
    ocr.recognize.mockImplementation(() => new Promise(() => {}));
    const close = vi.fn();
    vi.stubGlobal("createImageBitmap", vi.fn().mockResolvedValue({ width: 600, height: 800, close }));
    const context = vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({ drawImage: vi.fn() } as unknown as CanvasRenderingContext2D);
    try {
      const controller = new AbortController();
      const importing = importDocument(new File(["pixels"], "scan.png"), { signal: controller.signal });
      const rejected = expect(importing).rejects.toMatchObject({ name: "AbortError" });
      await vi.waitFor(() => expect(ocr.recognize).toHaveBeenCalled());
      controller.abort();
      await rejected;
      expect(ocr.terminate).toHaveBeenCalledTimes(1);
      expect(close).toHaveBeenCalledOnce();
    } finally { context.mockRestore(); vi.unstubAllGlobals(); }
  });
  it("cancels OCR worker initialization without leaving import cleanup pending", async () => {
    ocr.terminate.mockClear();
    let resolveWorker: ((worker: typeof ocr) => void) | undefined;
    createWorker.mockImplementationOnce(() => new Promise((resolve) => { resolveWorker = resolve; }));
    const close = vi.fn();
    vi.stubGlobal("createImageBitmap", vi.fn().mockResolvedValue({ width: 600, height: 800, close }));
    const context = vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({ drawImage: vi.fn() } as unknown as CanvasRenderingContext2D);
    try {
      const controller = new AbortController();
      const importing = importDocument(new File(["pixels"], "scan.png"), { signal: controller.signal });
      const rejected = expect(importing).rejects.toMatchObject({ name: "AbortError" });
      await vi.waitFor(() => expect(resolveWorker).toBeTypeOf("function"));
      controller.abort();
      await rejected;
      expect(close).toHaveBeenCalledOnce();
      expect(ocr.terminate).not.toHaveBeenCalled();
      resolveWorker?.(ocr);
      await vi.waitFor(() => expect(ocr.terminate).toHaveBeenCalled());
    } finally { context.mockRestore(); vi.unstubAllGlobals(); createWorker.mockReset().mockResolvedValue(ocr); }
  });
});

describe("evaluation rigor", () => {
  it("rejects materially wrong values formerly hidden by relative tolerances", () => {
    expect(evaluationMatches("rate", 10.3, 9.9)).toBe(false);
    expect(evaluationMatches("term", 39, 36)).toBe(false);
    expect(evaluationMatches("principal", 10040, 10000)).toBe(false);
    expect(evaluationMatches("payment", 101, 100)).toBe(false);
    expect(evaluationMatches("payment", 100.01, 100)).toBe(true);
  });
  it("counts omissions and insertions as OCR errors while ignoring whitespace layout", () => {
    expect(textSimilarity("Principal: $1000\nAPR: 5%", "Principal: $1000  APR: 5%")).toBe(1);
    expect(textSimilarity("Principal: $15,000\nTerm: 36 months", "Principal : $ 15, 000\nTerm : 36 months")).toBe(1);
    expect(textSimilarity("Principal: $15,000\nTerm: 36 months", "Principal : $ 15, 000\nTerm : 3 6 months")).toBeLessThan(1);
    expect(textSimilarity("Principal: $1000 APR: 5%", "Principal: $1000")).toBeLessThan(0.95);
    expect(textSimilarity("Principal: $1000", "Principal: $1000 extra invented content")).toBeLessThan(0.95);
  });
});
