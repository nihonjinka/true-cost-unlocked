import { describe, expect, it } from "vitest";
import { analyzeLocally, extractValuesFromText } from "@/lib/analyzeLocally";

const bnplAgreement = `BUY NOW PAY LATER AGREEMENT - SHOPEASY PAY

Purchase Amount: $1,200
Pay in 4 interest-free installments of $300 every 2 weeks!
NO INTEREST. NO FEES. 100% FREE!*

*Deferred interest applies. If the balance is not paid in full by the end of the
promotional period, interest will be charged retroactively from the purchase date at 36% APR.
Convenience fee: $7.99 per installment.
Missed installment fee: $35, plus a rescheduling fee of $15.
Payment Protection Plan: $12/month, automatically added unless you opt out in writing within 24 hours.
By accepting, you waive your right to join a class action and agree to binding arbitration.
We may report missed payments to credit bureaus and share your data with partners.`;

describe("document analysis context golden cases", () => {
  it("extracts the BNPL amount, installment duration, conditional APR, and listed charges", () => {
    const extracted = extractValuesFromText(bnplAgreement);
    const analysis = analyzeLocally(bnplAgreement);

    expect(extracted.loanAmount).toBe(1200);
    expect(extracted.interestRate).toBe(36);
    expect(extracted.interestRateIsConditional).toBe(true);
    expect(extracted.tenureMonths).toBeCloseTo(8 * 12 / 52, 4);
    expect(analysis.currency).toBe("USD");
    expect(analysis.docType.type).toBe("bnpl");
    expect(analysis.installmentSchedule).toMatchObject({ count: 4, amount: 300, interval: 2, intervalUnit: "week", total: 1200 });
    expect(analysis.installmentSchedule?.totalWithKnownFees).toBeCloseTo(1255.96, 2);
    expect(analysis.rateField).toMatchObject({ value: 36, rateType: "deferred" });
    expect(analysis.financialMetricsAvailable).toBe(false);
    expect(analysis.fees.find((finding) => finding.id === "convenience")?.totalImpact).toBeCloseTo(31.96, 2);
    expect(analysis.fees.find((finding) => finding.id === "late_payment")?.amount).toBe(35);
    expect(analysis.fees.find((finding) => finding.id === "reschedule")?.amount).toBe(15);
    expect(analysis.addOns.find((finding) => finding.id === "payment_protection")?.totalImpact).toBe(24);
    expect(analysis.claims.find((claim) => claim.id === "no_fees")?.contradicted).toBe(true);
    expect(analysis.claims.find((claim) => claim.id === "interest_free")?.contradicted).toBe(false);
    expect(analysis.warnings.some((warning) => warning.includes("36%") && warning.toLowerCase().includes("conditional"))).toBe(true);
    expect(Object.isFrozen(analysis)).toBe(true);
    expect(Object.isFrozen(analysis.fees)).toBe(true);
  });

  it("does not select a financed add-on as the principal amount", () => {
    const text = `AUTO LOAN AGREEMENT
Amount Financed: $31,200
GAP Coverage: $795 financed into the loan.
APR: 8.2%
Term: 60 months`;
    const extracted = extractValuesFromText(text);
    const analysis = analyzeLocally(text);

    expect(extracted.loanAmount).toBe(31200);
    expect(analysis.principal).toBe(31200);
    expect(analysis.addOns.find((finding) => finding.id === "gap")?.amount).toBe(795);
  });

  it("flags a principal candidate when its stated payment does not cross-check", () => {
    const extracted = extractValuesFromText(`Personal loan agreement
Amount financed: $10,000
Monthly payment: $1,000
APR: 12%
Term: 12 months`);

    expect(extracted.principalField.value).toBeNull();
    expect(extracted.principalField.needsReview).toBe(true);
    expect(extracted.principalField.alternatives[0]?.value).toBe(10000);
  });

  it("annualizes a monthly flat rate before calculating the loan cost", () => {
    const extracted = extractValuesFromText(`Personal loan agreement
Loan amount: $12,000
Interest rate: 1.5% per month flat
Term: 12 months`);

    expect(extracted.interestRate).toBe(18);
    expect(extracted.rateField.rateType).toBe("flat");
  });
});
