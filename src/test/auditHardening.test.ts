import { describe, expect, it } from "vitest";
import { analyzeLocally } from "@/lib/analyzeLocally";
import { collectRuleFindings } from "@/lib/analysisEngine";
import { scoreRiskFindings } from "@/lib/riskScoring";

describe("audit integration regressions", () => {
  it.each([
    { principal: 20000, rate: 8, count: 35, regular: 133.33, final: 20133.33 },
    { principal: 9000, rate: 12, count: 11, regular: 90, final: 9090 },
    { principal: 15000, rate: 6, count: 23, regular: 75, final: 15075 },
  ])("uses actual balloon cashflows and enables their schedule: $principal", (loan) => {
    const text = `LOAN AGREEMENT. Principal: $${loan.principal}. Amount financed: $${loan.principal}. Fixed APR: ${loan.rate}%. Term: ${loan.count + 1} months. Borrower pays ${loan.count} monthly interest-only payments of $${loan.regular}, followed by one final payment of $${loan.final}.`;
    const result = analyzeLocally(text);
    expect(result.principal).toBe(loan.principal);
    expect(result.principalField.needsReview).toBe(false);
    expect(result.totalPayment).toBeCloseTo(loan.count * loan.regular + loan.final, 2);
    expect(result.paymentScheduleRows).toHaveLength(loan.count + 1);
    expect(result.paymentScheduleRows?.at(-1)?.emi).toBe(loan.final);
    expect(result.ranCalculators).toContain("amortization");
    expect(result.ranCalculators).not.toContain("early_repayment");
    expect(result.summary).toContain(" + 1 × ");
    expect(result.riskScore).toBe(scoreRiskFindings(result.findings).score);
    const confirmed = analyzeLocally(text, loan.principal, loan.rate, loan.count + 1);
    expect(confirmed.principal).toBe(loan.principal);
    expect(confirmed.rateField.source).toBe("User override");
  });

  it.each([
    "Default under another agreement is cross-default and all amounts become immediately due; the lender may seize the vehicle without prior notice.",
    "A cross-default permits acceleration of the entire balance and repossession of the collateral without notice.",
    "If you default on any other loan, all amounts are immediately due and the lender may take possession of your property without demand.",
  ])("preserves separate categories from compound remedies", (text) => {
    const findings = collectRuleFindings(text, [], "unknown", []);
    const categories = findings.map((finding) => finding.category);
    expect(categories).toContain("cross_default");
    expect(categories).toContain("acceleration");
    expect(categories).toContain("collateral_recovery");
    const keys = findings.map((finding) => `${finding.clauseSpan.join(":")}:${finding.category}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it.each(["Net proceeds: $9700.", "Amount disbursed to Borrower: $9700.", "Funds released to the borrower: $9700."])("reconciles disclosed proceeds with itemized fees: %s", (proceeds) => {
    const result = analyzeLocally(`PERSONAL LOAN. Principal: $10000. APR: 10%. Term: 24 months. Origination fee: $300. ${proceeds}`);
    expect(result.netDisbursed).toBe(9700);
    expect(result.effectiveAPR).toBeGreaterThan(10);
  });

  it("retains flat basis when the same rate is manually confirmed", () => {
    const text = "Loan amount: $10000. Flat interest rate: 12% per year. Term: 12 months.";
    const result = analyzeLocally(text, null, 12);
    expect(result.rateField.source).toBe("User override");
    expect(result.rateField.rateType).toBe("flat");
    expect(result.totalInterest).toBe(1200);
  });

  it("scores the final materialized reconciliation findings", () => {
    const result = analyzeLocally("AUTO LOAN. Cash price: $10000. Amount financed: $12000. APR: 10%. Term: 36 months. Documentation fee: $100.");
    expect(result.findings.some((finding) => finding.category === "mismatch")).toBe(true);
    expect(result.riskScore).toBe(scoreRiskFindings(result.findings).score);
  });
});
