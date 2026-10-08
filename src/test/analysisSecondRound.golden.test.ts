import { describe, expect, it } from "vitest";
import { analyzeLocally } from "@/lib/analyzeLocally";
import { parseMonetaryValues, segmentClauses } from "@/lib/analysisEngine";

describe("TRUE COST second-round extraction and analysis", () => {
  it("models no-cost EMI interest, tax, composite processing fee, offset, and foreclosure ceiling", () => {
    const document = [
      "PERSONAL CREDIT — NO-COST EMI",
      "Purchase price: ₹60,000",
      "Amount financed: ₹60,000",
      "APR: 15% per year",
      "Tenure: 6 months",
      "Monthly EMI: ₹10,442.03",
      "GST @ 18% payable on the interest component.",
      "Processing fee: Rs. 199 + 18% GST",
      "Instant discount of Rs. 2,652.17 to offset interest.",
      "Foreclosure charge: up to 3% of outstanding balance",
    ].join("\n");
    const result = analyzeLocally(document);

    expect(result.principal).toBe(60000);
    expect(result.rateField.value).toBe(15);
    expect(result.termField.value).toBe(6);
    expect(result.calculator.available).toBe(true);
    expect(result.financialMetricsAvailable).toBe(true);
    expect(result.emi).toBeCloseTo(10442.03, 2);
    expect(result.totalInterest).toBeCloseTo(2652.17, 2);
    expect(result.taxes.find((finding) => finding.basis === "interest")?.totalImpact).toBeCloseTo(477.39, 2);
    expect(result.fees.find((finding) => finding.id === "processing")?.totalImpact).toBeCloseTo(234.82, 2);
    expect(result.netExtraCost).toBeCloseTo(712.21, 2);
    expect(result.claims.some((claim) => claim.contradicted && /no-cost/i.test(claim.label) && claim.contradiction?.includes("712.21"))).toBe(true);
    expect(result.hiddenFees.some((finding) => /up to .*1,800.*at start.*declining as principal is repaid/i.test(finding))).toBe(true);
    expect(result.riskScore).toBeGreaterThan(0);
    expect(result.riskBand).not.toBe("insufficient_confidence");
  });

  it("expands every generic financed item and reconciles an auto loan without catalog aliases", () => {
    const document = [
      "AUTO FINANCE AGREEMENT",
      "Vehicle price: $28,000",
      "Amount financed: $31,200",
      "Amount borrowed: $28,000",
      "Financed add-ons: A $795, B $1,895, C $510",
      "APR: 5% per year",
      "Term: 72 months",
      "Optional products were included in your payment.",
      "The dealer may receive compensation.",
      "Rolled-in negative equity is included.",
    ].join("\n");
    const result = analyzeLocally(document);
    const items = result.addOns.filter((finding) => finding.groupId);

    expect(result.principal).toBe(31200);
    expect(items).toHaveLength(3);
    expect(items.map((finding) => finding.amount)).toEqual([795, 1895, 510]);
    expect(new Set(items.map((finding) => finding.source)).size).toBe(3);
    expect(items.every((finding) => finding.label.startsWith("Unclassified item"))).toBe(true);
    expect(result.itemGroups[0]?.aggregate).toBe(3200);
    expect(result.reconciliations.some((check) => check.matched && check.calculated === 31200)).toBe(true);
    expect(result.principalField.confidence).toBeGreaterThanOrEqual(0.92);
    expect(result.insights.some((insight) => /Principal candidates .* were checked against price plus financed items/i.test(insight))).toBe(true);
    expect(result.addOnImpact?.paymentIncrease).toBeGreaterThan(50);
    expect(result.addOnImpact?.paymentIncrease).toBeLessThan(53);
    expect(result.addOnImpact?.totalPaymentIncrease).toBeGreaterThan(3600);
    expect(result.addOnImpact?.totalPaymentIncrease).toBeLessThan(3800);
    expect(result.claims.some((claim) => claim.id.includes("optional") && claim.contradicted)).toBe(true);
    expect(result.warnings.some((warning) => /dealer compensation/i.test(warning))).toBe(true);
    expect(result.reconciliations[0]?.undisclosedItems).toContain("Rolled-in negative equity");
    expect(result.warnings.some((warning) => /stated but unquantified/i.test(warning))).toBe(true);
    expect(result.riskBreakdown.some((item) => item.reasons.some((reason) => /\d+\s+fee\/add-on clause/i.test(reason)))).toBe(false);
    for (const finding of [...result.fees, ...result.addOns, ...result.taxes, ...result.offsets]) {
      const sourceStart = result.rawText.indexOf(finding.source);
      expect(sourceStart).toBeGreaterThanOrEqual(0);
      expect(/[A-Za-z0-9]/.test(result.rawText[sourceStart + finding.source.length] ?? "")).toBe(false);
    }
  });

  it("keeps Rs. and decimals inside evidence clauses and never truncates a clause", () => {
    const document = "Processing fee: Rs. 199 + 18% GST. The lender is Inc. and the fee is approx. $199.50.";
    const clauses = segmentClauses(document);
    const result = analyzeLocally(document);

    expect(clauses[0]?.text).toBe("Processing fee: Rs. 199 + 18% GST.");
    expect(clauses.some((clause) => clause.text.includes("Inc. and the fee is approx. $199.50."))).toBe(true);
    expect(result.fees.find((finding) => finding.id === "processing")?.source).toBe(clauses[0]?.text);
    expect(result.fees.find((finding) => finding.id === "processing")?.amount).toBe(199);
    expect(result.fees.every((finding) => !finding.source.endsWith("Tenur"))).toBe(true);
    expect(result.fees.every((finding) => finding.amount !== null || finding.percent !== null || finding.amountNotStated)).toBe(true);
    expect(new Set(result.warnings.map((warning) => warning.replace(/\s+/g, " ").trim().toLowerCase())).size).toBe(result.warnings.length);
  });

  it("returns structured currency, frequency, qualifier, basis, and composite tax values", () => {
    const values = parseMonetaryValues("Processing fee: Rs. 199 + 18% GST; foreclosure charge up to C$1,800 per month, 3% of outstanding balance.");
    const base = values.find((value) => value.amount === 199);
    const cap = values.find((value) => value.amount === 1800);
    const percentage = values.find((value) => value.percent === 3);

    expect(base).toMatchObject({ currency: "INR", tax: { percent: 18, basis: "fee" } });
    expect(cap).toMatchObject({ currency: "CAD", frequency: "monthly", qualifier: "up to" });
    expect(percentage).toMatchObject({ basis: "outstanding", percent: 3 });
  });

  it("keeps neighboring fee findings distinct with specific evidence clauses", () => {
    const result = analyzeLocally("Missed installment fee: €35, plus a rescheduling fee of €15.");
    const late = result.fees.find((finding) => finding.id === "late_payment");
    const reschedule = result.fees.find((finding) => finding.id === "reschedule");

    expect(late?.amount).toBe(35);
    expect(reschedule?.amount).toBe(15);
    expect(late?.source).toContain("Missed installment fee");
    expect(late?.source).not.toContain("rescheduling");
    expect(reschedule?.source).toContain("rescheduling fee");
    expect(reschedule?.source).not.toContain("Missed installment");
  });

  it("handles a CAD tax and unfamiliar financed upgrade labels", () => {
    const result = analyzeLocally([
      "Retail installment contract",
      "Cash price: C$4,000",
      "Credit amount: C$4,500",
      "Additional upgrades: Ceramic coating C$200, Cabin shield C$150, Roadside bundle C$150",
      "Annual rate: 9% APR",
      "Repayment period: 12 months",
      "HST @ 13% on total interest",
    ].join("\n"));

    expect(result.currencyCode).toBe("CAD");
    expect(result.itemGroups[0]?.items).toHaveLength(3);
    expect(result.itemGroups[0]?.aggregate).toBe(500);
    expect(result.taxes[0]?.basis).toBe("interest");
    expect(result.taxes[0]?.totalImpact).toBeGreaterThan(0);
  });

  it("handles euro VAT clauses, alternative term wording, and an unclassified product list", () => {
    const result = analyzeLocally([
      "Retail credit terms",
      "Purchase price: €2,400",
      "Amount financed: €2,600",
      "Optional equipment: Rain coating €80, Seat cover €70, Road kit €50",
      "Interest rate: 6% per annum",
      "Repayment period: 24 months",
      "VAT at 20% on the interest component",
    ].join("\n"));

    expect(result.currencyCode).toBe("EUR");
    expect(result.principal).toBe(2600);
    expect(result.termField.value).toBe(24);
    expect(result.itemGroups[0]?.aggregate).toBe(200);
    expect(result.taxes[0]?.totalImpact).toBeGreaterThan(0);
  });

  it("handles a third unseen variant with GBP, a different label, and different add-on names", () => {
    const result = analyzeLocally([
      "Retail finance disclosure",
      "Cash price: £1,000",
      "Loan amount: £1,250",
      "Optional items: UrbanGuard £100, Commuter Cover £80, Climate Pack £70",
      "Interest rate: 7% p.a.",
      "Term: 36 mo",
    ].join("\n"));

    expect(result.currencyCode).toBe("GBP");
    expect(result.itemGroups[0]?.items).toHaveLength(3);
    expect(result.itemGroups[0]?.aggregate).toBe(250);
    expect(result.reconciliations.some((check) => check.matched)).toBe(true);
  });

  it("keeps findings-based risk visible when calculation inputs are missing", () => {
    const result = analyzeLocally("Installment agreement. Processing fee: €25.");

    expect(result.calculator.available).toBe(false);
    expect(result.calculator.missingInputs).toEqual(expect.arrayContaining(["principal / amount financed", "applicable interest rate", "repayment term"]));
    expect(result.riskScore).toBeGreaterThan(0);
    expect(result.riskBand).not.toBe("insufficient_confidence");
    expect(result.fees.every((finding) => finding.amount !== null || finding.percent !== null || finding.amountNotStated)).toBe(true);
  });

  it("does not invent a fixed outstanding-balance penalty without a completed calculator", () => {
    const result = analyzeLocally("Loan amount: $60,000. Foreclosure charge: 3% of outstanding balance.");
    const foreclosure = result.hiddenFees.find((finding) => /foreclosure/i.test(finding));

    expect(result.calculator.available).toBe(false);
    expect(foreclosure).toContain("3% of outstanding balance");
    expect(foreclosure).not.toContain("$1,800");
  });
});
