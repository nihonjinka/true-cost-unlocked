import { afterEach, describe, expect, it, vi } from "vitest";
import { classifyPolarity } from "@/lib/analysisEngine";
import { analyzeLocally, extractValuesFromText } from "@/lib/analyzeLocally";
import rules from "@/data/analysisRules.json";
import { textSimilarity } from "@/lib/evaluation";
import { handleOpenRouter } from "../../server/openrouter";

afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

describe("review of uncommitted changes", () => {
  it("enforces the text bound before either extraction or analysis begins", () => {
    const text = "x".repeat(rules.maxInputCharacters + 1);
    expect(() => extractValuesFromText(text)).toThrow("Analysis is limited");
    expect(() => analyzeLocally(text)).toThrow("Analysis is limited");
  });
  it.each(["but", "however", "yet"])("isolates a paid charge from a later exclusion after %s", (contrast) => {
    const text = `An origination fee applies ${contrast} no late fee is charged.`;
    const start = text.indexOf("origination fee");
    expect(classifyPolarity(text, start, start + "origination fee".length)).toBe("asserted");
  });

  it("keeps distinct numbers and separate table rows distinct in OCR accuracy", () => {
    expect(textSimilarity("10\n20", "1020")).toBeLessThan(1);
    expect(textSimilarity("Payments: 1 2", "Payments: 12")).toBeLessThan(1);
  });

  it("retains a charge's own trailing waiver across punctuation", () => {
    const text = "Processing fee, which is waived for this borrower.";
    expect(classifyPolarity(text, 0, "Processing fee".length)).toBe("waived/zero");
  });

  it("includes separately paid charges in addition to disclosed cash proceeds", () => {
    const result = analyzeLocally("PERSONAL LOAN. Principal: $10000. APR: 10%. Term: 12 months. Processing fee: $300 deducted from proceeds. Origination fee: $200 paid separately. Net proceeds: $9700.");
    expect(result.principal).toBe(10000);
    expect(result.netDisbursed).toBe(9500);
    expect(result.totalCost).toBeCloseTo(result.totalPayment! - 9500, 6);
  });

  it("does not ignore a separate fee when full principal is disbursed", () => {
    const result = analyzeLocally("PERSONAL LOAN. Principal: $10000. APR: 10%. Term: 12 months. Origination fee: $300 paid separately. Amount paid to Borrower: $10000.");
    expect(result.netDisbursed).toBe(9700);
    expect(result.effectiveAPR).toBeGreaterThan(10);
  });

  it("bounds proxy state even when every request uses a new active client", async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date("2040-01-01T00:00:00Z"));
    const fetchMock = vi.fn().mockImplementation(async () => new Response(JSON.stringify({ choices: [] })));
    vi.stubGlobal("fetch", fetchMock);
    let lastStatus = 0;
    for (let index = 0; index <= 1000; index++) {
      const request = new Request("https://truecost.example/.netlify/functions/openrouter", {
        method: "POST", headers: { origin: "https://truecost.example", "x-nf-client-connection-ip": `review-client-${index}` },
        body: JSON.stringify({ messages: [{ role: "user", content: "Review this agreement." }] }),
      });
      lastStatus = (await handleOpenRouter(request, { OPENROUTER_API_KEY: "test-key" })).status;
    }
    expect(lastStatus).toBe(429);
    expect(fetchMock).toHaveBeenCalledTimes(1000);
    vi.advanceTimersByTime(60_001);
    const next = new Request("https://truecost.example/.netlify/functions/openrouter", {
      method: "POST", headers: { origin: "https://truecost.example", "x-nf-client-connection-ip": "after-expiry" },
      body: JSON.stringify({ messages: [{ role: "user", content: "Review this agreement." }] }),
    });
    expect((await handleOpenRouter(next, { OPENROUTER_API_KEY: "test-key" })).status).toBe(200);
  });
});
