import { describe, expect, it } from "vitest";
import { analyzeLocally } from "@/lib/analyzeLocally";
import { scheduleEffectiveAPR } from "@/lib/scheduleFinance";

describe("remaining Round 8 cashflow reconciliation", () => {
  it.each([
    { principal: 1000, total: 1200, charge: 50 },
    { principal: 2000, total: 2400, charge: 100 },
    { principal: 500, total: 650, charge: 50 },
  ])("keeps a conflicting finance charge separate from repayment cost: $principal", ({ principal, total, charge }) => {
    const result = analyzeLocally(`SHORT-TERM LOAN. Principal: $${principal}. One payment of $${total} is due after 30 days. Total of payments: $${total}. Finance charge: $${charge}.`);
    expect(result.principal).toBe(principal);
    expect(result.statedFinanceCharge).toBe(charge);
    expect(result.totalInterest).toBe(total - principal);
    expect(result.totalCost).toBe(total - principal);
    expect(result.findings.some((finding) => finding.id === "computed_finance_charge_mismatch")).toBe(true);
  });

  it.each([
    { advance: 20000, net: 18000, purchased: 30000, remittance: 250 },
    { advance: 10000, net: 9500, purchased: 15000, remittance: 125 },
    { advance: 6000, net: 5500, purchased: 9000, remittance: 75 },
  ])("uses actual merchant advance proceeds for implied APR: $advance", ({ advance, net, purchased, remittance }) => {
    const result = analyzeLocally(`MERCHANT CASH ADVANCE. Advance amount: $${advance}. Net proceeds: $${net}. Purchased amount: $${purchased}. Daily remittance: $${remittance} from receivables.`);
    expect(result.docType.type).toBe("merchant_cash_advance");
    expect(result.cashPriceAnalysis?.cashPrice).toBe(net);
    expect(result.effectiveAPR).toBeCloseTo(scheduleEffectiveAPR(net, result.installmentSchedule!)!, 6);
    expect(result.cashPriceAnalysis?.periodsPerYear).toBe(365);
  });

  it.each([
    { repayment: "One payment of $1100 is due in three months.", days: 90, interval: 3, unit: "month" },
    { repayment: "A single payment of $1100 is payable within two weeks.", days: 14, interval: 2, unit: "week" },
    { repayment: "One repayment of $1100 is due after ninety days.", days: 90, interval: 90, unit: "day" },
  ])("resolves a single payment's own maturity: $repayment", ({ repayment, days, interval, unit }) => {
    const result = analyzeLocally(`SHORT-TERM LOAN. Principal: $1000. ${repayment}`);
    expect(result.installmentSchedule?.daysToMaturity).toBe(days);
    expect(result.installmentSchedule?.interval).toBe(interval);
    expect(result.installmentSchedule?.intervalUnit).toBe(unit);
    expect(result.totalPayment).toBe(1100);
    expect(result.termField.value).toBeGreaterThan(0);
    if (unit === "month") expect(result.termField.value).toBe(interval);
    expect(result.effectiveAPR).toBeCloseTo(0.1 * 365 / days * 100, 6);
  });

  it("takes maturity from the repayment clause rather than a late-fee due window", () => {
    const result = analyzeLocally("SHORT-TERM LOAN. Principal: $1000. A late fee of $20 is due within 5 days. One payment of $1100 is due after 30 days.");
    expect(result.installmentSchedule?.daysToMaturity).toBe(30);
    expect(result.installmentSchedule?.source).not.toContain("late fee");
  });

  it("includes separately paid MCA charges in its economic proceeds", () => {
    const result = analyzeLocally("MERCHANT CASH ADVANCE. Advance amount: $20000. Net proceeds: $18000. Purchased amount: $30000. Daily remittance: $250 from receivables. Origination fee: $500 paid separately.");
    expect(result.cashPriceAnalysis?.cashPrice).toBe(17500);
    expect(result.effectiveAPR).toBeCloseTo(scheduleEffectiveAPR(17500, result.installmentSchedule!)!, 6);
  });
});
