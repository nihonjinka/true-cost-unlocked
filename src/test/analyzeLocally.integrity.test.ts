import { describe, expect, it } from "vitest";
import { analyzeLocally, detectDeception } from "@/lib/analyzeLocally";

describe("analyzeLocally integrity safeguards", () => {
  it("attaches evidence to clause-based warnings", () => {
    const text = "Penalty APR: 29.99% may apply indefinitely after late payment.";
    const result = analyzeLocally(text, 150000, 24, 24);

    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings.some((warning) => warning.includes("Evidence:"))).toBe(true);
  });

  it("does not fabricate hidden fees when clauses are absent", () => {
    const text = "Loan amount is 10000 with 9% APR for 12 months. No extra charges are listed.";
    const result = analyzeLocally(text, 10000, 9, 12);

    expect(result.hiddenFees).toHaveLength(0);
  });
});

describe("deception detection precision", () => {
  it("avoids false emotional flag on non-promotional exclusive wording", () => {
    const text = "This section grants exclusive voting rights to cooperative members.";
    const deception = detectDeception(text);

    expect(deception.emotionalManipulation).toHaveLength(0);
  });
});
