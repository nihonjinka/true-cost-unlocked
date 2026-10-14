import rules from "../data/documentImportRules.json";
import type { ImportedSourcePage, SourceTextSpan } from "./analysisContext";
import { joinDocumentFragments, normalizedBox, type DocumentFragment } from "./documentLayout";

export interface DocumentImportResult { text: string; pages: ImportedSourcePage[]; spans: SourceTextSpan[] }
export interface DocumentImportProgress { page: number; pageCount: number; phase: "reading" | "ocr" }
export interface DocumentImportOptions {
  onProgress?: (progress: DocumentImportProgress) => void;
  signal?: AbortSignal;
  /** Optional local assets for offline deployments; document bytes never leave the browser. */
  ocrAssets?: { workerPath?: string; corePath?: string; langPath?: string };
}
type OCRWorker = Awaited<ReturnType<(typeof import("tesseract.js"))["createWorker"]>>;
type OCRResult = Awaited<ReturnType<OCRWorker["recognize"]>>;

function aborted(signal?: AbortSignal) {
  if (signal?.aborted) throw new DOMException("Document import cancelled.", "AbortError");
}

function validateFile(file: File): "pdf" | "image" {
  if (!file.size) throw new Error("The selected file is empty.");
  if (file.size > rules.maxBytes) throw new Error("File is larger than the 20 MB limit.");
  if (file.type === "application/pdf" || /\.pdf$/i.test(file.name)) return "pdf";
  if (file.type === "image/tiff" || /\.tiff?$/i.test(file.name)) throw new Error("Convert TIFF pages to PDF, PNG, or JPEG before importing; this browser cannot reliably read every TIFF page.");
  if (/^image\/(?:png|jpeg|webp|bmp)$/i.test(file.type) || /\.(?:png|jpe?g|webp|bmp)$/i.test(file.name)) return "image";
  throw new Error("Choose a PDF, PNG, JPEG, WebP, or BMP file.");
}

function withCancellation<T>(operation: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return operation;
  return new Promise((resolve, reject) => {
    const cancel = () => reject(new DOMException("Document import cancelled.", "AbortError"));
    signal.addEventListener("abort", cancel, { once: true });
    if (signal.aborted) cancel();
    operation.then(resolve, reject).finally(() => signal.removeEventListener("abort", cancel));
  });
}

async function imageDimensions(file: File): Promise<{ width: number; height: number } | null> {
  const sample = file.slice(0, 256 * 1024);
  const buffer = typeof sample.arrayBuffer === "function"
    ? await sample.arrayBuffer()
    : await new Promise<ArrayBuffer>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.onerror = () => reject(reader.error ?? new Error("The image could not be inspected."));
      reader.readAsArrayBuffer(sample);
    });
  const bytes = new Uint8Array(buffer);
  if (bytes.length >= 24
    && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47
    && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a) {
    return {
      width: new DataView(bytes.buffer).getUint32(16),
      height: new DataView(bytes.buffer).getUint32(20),
    };
  }
  if (bytes.length >= 26 && bytes[0] === 0x42 && bytes[1] === 0x4d) {
    const view = new DataView(bytes.buffer);
    const headerSize = view.getUint32(14, true);
    if (headerSize === 12) return { width: view.getUint16(18, true), height: view.getUint16(20, true) };
    if (headerSize >= 40) return { width: Math.abs(view.getInt32(18, true)), height: Math.abs(view.getInt32(22, true)) };
    return null;
  }
  if (bytes.length >= 30 && bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46
    && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
    && bytes[12] === 0x56 && bytes[13] === 0x50 && bytes[14] === 0x38 && bytes[15] === 0x58) {
    return {
      width: 1 + bytes[24] + (bytes[25] << 8) + (bytes[26] << 16),
      height: 1 + bytes[27] + (bytes[28] << 8) + (bytes[29] << 16),
    };
  }
  if (bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8) {
    let offset = 2;
    while (offset + 9 < bytes.length) {
      while (offset < bytes.length && bytes[offset] !== 0xff) offset += 1;
      while (offset < bytes.length && bytes[offset] === 0xff) offset += 1;
      const marker = bytes[offset++];
      if (marker === 0xd8 || marker === 0xd9) continue;
      if (offset + 1 >= bytes.length) break;
      const length = (bytes[offset] << 8) + bytes[offset + 1];
      if (length < 2 || offset + length > bytes.length) break;
      const isFrame = (marker >= 0xc0 && marker <= 0xc3) || (marker >= 0xc5 && marker <= 0xc7)
        || (marker >= 0xc9 && marker <= 0xcb) || (marker >= 0xcd && marker <= 0xcf);
      if (isFrame && length >= 7) return { height: (bytes[offset + 3] << 8) + bytes[offset + 4], width: (bytes[offset + 5] << 8) + bytes[offset + 6] };
      offset += length;
    }
  }
  return null;
}

function createOCRSession(signal?: AbortSignal, assets?: DocumentImportOptions["ocrAssets"]) {
  let worker: Promise<OCRWorker> | undefined;
  let closing: Promise<void> | undefined;
  let termination: Promise<void> | undefined;
  const terminate = () => termination ??= worker!.then(async (active) => { await active.terminate(); });
  const close = () => {
    if (!worker) return Promise.resolve();
    if (signal?.aborted) {
      void terminate().catch(() => {});
      return Promise.resolve();
    }
    return closing ??= terminate();
  };
  const cancel = () => { void close().catch(() => {}); };
  signal?.addEventListener("abort", cancel, { once: true });
  return {
    async recognize(canvas: HTMLCanvasElement) {
      aborted(signal);
      worker ??= import("tesseract.js").then(({ createWorker }) => createWorker(rules.ocr.language, undefined, assets));
      const active = await withCancellation(worker, signal);
      aborted(signal);
      const result = await withCancellation(active.recognize(canvas, {}, { text: true, blocks: true }), signal);
      aborted(signal);
      return result;
    },
    async close() { signal?.removeEventListener("abort", cancel); await close(); },
  };
}

function ocrFragments(result: OCRResult, width: number, height: number) {
  const words = (result.data.blocks ?? []).flatMap((block) => block.paragraphs.flatMap((paragraph) => paragraph.lines.flatMap((line) => line.words)));
  const fragments: DocumentFragment[] = words.filter((word) => word.text.trim()).map((word) => ({
    text: word.text, x: word.bbox.x0, y: word.bbox.y0,
    width: word.bbox.x1 - word.bbox.x0, height: word.bbox.y1 - word.bbox.y0, confidence: word.confidence,
    box: normalizedBox([[word.bbox.x0, word.bbox.y0], [word.bbox.x1, word.bbox.y1]], width, height),
  }));
  const confidence = words.length ? words.reduce((sum, word) => sum + word.confidence, 0) / words.length : result.data.confidence;
  return { fragments, confidence: Number.isFinite(confidence) ? confidence : 0 };
}

function canvasFor(width: number, height: number) {
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(width); canvas.height = Math.ceil(height);
  const context = canvas.getContext("2d");
  if (!context) throw new Error("This browser cannot prepare the document for local OCR.");
  return { canvas, context };
}

async function readImage(file: File, options: DocumentImportOptions): Promise<DocumentImportResult> {
  aborted(options.signal);
  options.onProgress?.({ page: 1, pageCount: 1, phase: "ocr" });
  const dimensions = await imageDimensions(file);
  aborted(options.signal);
  if (dimensions && dimensions.width * dimensions.height > rules.maxImagePixels) {
    throw new Error("Image dimensions are too large. Resize to under 40 megapixels or upload a PDF.");
  }
  let bitmap: ImageBitmap;
  try { bitmap = await createImageBitmap(file); }
  catch { throw new Error("The image could not be decoded. Try a PNG or JPEG export of the original page."); }
  const session = createOCRSession(options.signal, options.ocrAssets);
  let canvas: HTMLCanvasElement | undefined;
  try {
    aborted(options.signal);
    if (bitmap.width * bitmap.height > rules.maxImagePixels) throw new Error("Image dimensions are too large. Resize to under 40 megapixels or upload a PDF.");
    const prepared = canvasFor(bitmap.width, bitmap.height);
    canvas = prepared.canvas;
    prepared.context.drawImage(bitmap, 0, 0);
    const recognized = ocrFragments(await session.recognize(canvas), canvas.width, canvas.height);
    const joined = joinDocumentFragments(recognized.fragments, 1, 0, canvas.width);
    return { ...joined, pages: [{ page: 1, confidence: recognized.confidence, isOCR: true }] };
  } finally {
    bitmap.close();
    if (canvas) { canvas.width = 0; canvas.height = 0; }
    await session.close();
  }
}

/** Image coverage is independent of selectable header/footer text. */
export function needsPageOCR(textCharacters: number, rasterFraction: number) {
  return textCharacters < rules.ocr.minimumTextCharacters || rasterFraction >= rules.ocr.minimumRasterPageFraction;
}

async function readPdf(file: File, options: DocumentImportOptions): Promise<DocumentImportResult> {
  const pdfjs = await import("pdfjs-dist/build/pdf.mjs");
  const pdfWorker = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
  pdfjs.GlobalWorkerOptions.workerSrc = pdfWorker.default;
  aborted(options.signal);
  const loadingTask = pdfjs.getDocument({ data: await file.arrayBuffer() });
  const session = createOCRSession(options.signal, options.ocrAssets);
  let closing: Promise<void> | undefined;
  const closePDF = () => closing ??= loadingTask.destroy();
  const cancel = () => { void closePDF().catch(() => {}); };
  options.signal?.addEventListener("abort", cancel, { once: true });
  let text = "";
  const pages: ImportedSourcePage[] = [];
  const spans: SourceTextSpan[] = [];
  try {
    aborted(options.signal);
    const pdf = await loadingTask.promise;
    if (pdf.numPages > rules.maxPages) throw new Error("PDF has more than the 30-page limit.");
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
      aborted(options.signal);
      options.onProgress?.({ page: pageNumber, pageCount: pdf.numPages, phase: "reading" });
      const page = await pdf.getPage(pageNumber);
      let canvas: HTMLCanvasElement | undefined;
      try {
        const content = await page.getTextContent();
        const viewport = page.getViewport({ scale: 1 });
        const items = content.items.filter((item): item is typeof item & { str: string; transform: number[]; width: number; height: number; fontName: string } => "str" in item && Boolean(item.str.trim()));
        const fragments: DocumentFragment[] = items.map((item) => {
          const tx = pdfjs.Util.transform(viewport.transform, item.transform);
          const fontHeight = Math.hypot(tx[2], tx[3]) || item.height || 10;
          const advanceLength = Math.hypot(tx[0], tx[1]) || 1;
          const advance = [tx[0] / advanceLength * item.width, tx[1] / advanceLength * item.width];
          const ascent = content.styles[item.fontName]?.ascent ?? 0.8;
          const baseline = [tx[4], tx[5]];
          const vertical = [tx[2] / fontHeight, tx[3] / fontHeight];
          const corners: Array<[number, number]> = [0, 1].flatMap((edge) => [ascent, ascent - 1].map((height): [number, number] => [
            baseline[0] + edge * advance[0] + vertical[0] * height * fontHeight,
            baseline[1] + edge * advance[1] + vertical[1] * height * fontHeight,
          ]));
          const box = normalizedBox(corners, viewport.width, viewport.height);
          return { text: item.str, x: box.x * viewport.width, y: box.y * viewport.height,
            width: box.width * viewport.width, height: box.height * viewport.height, confidence: 100, box };
        });
        // A scanned body may coexist with a perfectly selectable page number/title.
        const operators = await page.getOperatorList();
        let transform = [1, 0, 0, 1, 0, 0];
        const stack: number[][] = [];
        let rasterFraction = 0;
        const imageOps = new Set([pdfjs.OPS.paintImageXObject, pdfjs.OPS.paintInlineImageXObject, pdfjs.OPS.paintImageMaskXObject]);
        for (let index = 0; index < operators.fnArray.length; index++) {
          const op = operators.fnArray[index];
          if (op === pdfjs.OPS.save) stack.push([...transform]);
          else if (op === pdfjs.OPS.restore) transform = stack.pop() ?? [1, 0, 0, 1, 0, 0];
          else if (op === pdfjs.OPS.transform) transform = pdfjs.Util.transform(transform, operators.argsArray[index]);
          else if (imageOps.has(op)) rasterFraction += Math.abs(transform[0] * transform[3] - transform[1] * transform[2]) / (viewport.width * viewport.height);
        }
        let selected = fragments;
        let confidence = 100;
        const isOCR = needsPageOCR(fragments.reduce((sum, item) => sum + item.text.length, 0), rasterFraction);
        if (isOCR) {
          options.onProgress?.({ page: pageNumber, pageCount: pdf.numPages, phase: "ocr" });
          const scale = Math.min(rules.ocr.renderScale, Math.sqrt(rules.ocr.maxRenderPixels / (viewport.width * viewport.height)));
          const renderViewport = page.getViewport({ scale });
          const prepared = canvasFor(renderViewport.width, renderViewport.height);
          canvas = prepared.canvas;
          const rendering = page.render({ canvas, canvasContext: prepared.context, viewport: renderViewport });
          const cancelRender = () => rendering.cancel();
          options.signal?.addEventListener("abort", cancelRender, { once: true });
          try { aborted(options.signal); await rendering.promise; }
          finally { options.signal?.removeEventListener("abort", cancelRender); }
          const recognized = ocrFragments(await session.recognize(canvas), canvas.width, canvas.height);
          confidence = recognized.confidence;
          const renderWidth = canvas.width, renderHeight = canvas.height;
          const native = fragments.map((fragment) => ({ ...fragment, x: fragment.box.x * renderWidth, y: fragment.box.y * renderHeight,
            width: fragment.box.width * renderWidth, height: fragment.box.height * renderHeight }));
          selected = [...recognized.fragments.filter((fragment) => !native.some((existing) => {
            const centerX = fragment.x + fragment.width / 2, centerY = fragment.y + fragment.height / 2;
            return centerX >= existing.x && centerX <= existing.x + existing.width
              && centerY >= existing.y && centerY <= existing.y + existing.height;
          })), ...native];
        }
        const joined = joinDocumentFragments(selected, pageNumber, text.length + (text ? 2 : 0), canvas?.width ?? viewport.width);
        text += (text ? "\n\n" : "") + joined.text;
        spans.push(...joined.spans);
        pages.push({ page: pageNumber, confidence, isOCR });
      } finally {
        if (canvas) { canvas.width = 0; canvas.height = 0; }
        page.cleanup();
      }
    }
  } catch (error) {
    aborted(options.signal);
    if (error instanceof Error && error.name === "PasswordException") throw new Error("This PDF is password protected. Upload an unlocked copy.");
    if (error instanceof Error && error.name === "InvalidPDFException") throw new Error("This PDF is damaged or invalid. Export a fresh PDF and try again.");
    throw error;
  } finally {
    options.signal?.removeEventListener("abort", cancel);
    await Promise.allSettled([session.close(), closePDF()]);
  }
  return { text, pages, spans };
}

export async function importDocument(file: File, options: DocumentImportOptions = {}): Promise<DocumentImportResult> {
  aborted(options.signal);
  const kind = validateFile(file);
  const result = kind === "pdf" ? await readPdf(file, options) : await readImage(file, options);
  aborted(options.signal);
  if (!result.text.trim()) throw new Error("No readable text was found. Try a clearer scan or paste the document text.");
  return result;
}

export const documentImportLimits = { maxBytes: rules.maxBytes, maxPages: rules.maxPages, lowConfidence: rules.lowConfidence } as const;
