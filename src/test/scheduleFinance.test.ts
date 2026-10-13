import { describe, expect, it } from "vitest";
import { analyzePaymentSchedule, feeCashflowTreatment, feeCashflows, projectAdjustableRates, renewalScenariosFor, scheduleEffectiveAPR } from "@/lib/scheduleFinance";
import type { CostFinding, InstallmentSchedule } from "@/lib/analysisContext";

const schedule = (principal: number, rate: number, count: number): InstallmentSchedule => {
  const interest = principal * rate / 1200;
  return { count, amount: interest, interval: 1, intervalUnit: "month", total: principal + count * interest, totalWithKnownFees: null,
    source: "stated payment segments", firstPaymentTiming: "one period after agreement", segments: [
      { count: count - 1, amount: interest, interval: 1, intervalUnit: "month", total: interest * (count - 1), kind: "regular", source: "Interest-only payments" },
      { count: 1, amount: principal + interest, interval: 1, intervalUnit: "month", total: principal + interest, kind: "balloon", source: "Final repayment" },
    ] };
};
const single: InstallmentSchedule = { count: 1, amount: 550, interval: 30, intervalUnit: "day", total: 550, totalWithKnownFees: null,
  source: "One payment due in 30 days", firstPaymentTiming: "one period after agreement", daysToMaturity: 30 };

describe("explicit payment cashflows", () => {
  it.each([[20000, 8, 36], [9000, 12, 12], [7500, 6, 24]])("keeps interest-only payments and pays principal in the balloon", (principal, rate, count) => {
    const result = analyzePaymentSchedule(schedule(principal, rate, count), principal, rate)!;
    expect(result.rows).toHaveLength(count);
    expect(result.rows[0].principalPaid).toBeCloseTo(0);
    expect(result.rows[count - 1].principalPaid).toBeCloseTo(principal);
    expect(result.remainingBalance).toBeCloseTo(0);
    expect(result.balanceMatches).toBe(true);
    expect(result.effectiveAPR).toBeCloseTo(rate, 5);
    expect(result.totalPayment).toBeCloseTo(principal * (1 + rate / 1200 * count));
  });
  it("retains an underfunded final balance instead of silently clearing it", () => {
    const input = schedule(10000, 12, 12);
    input.segments![1].amount -= 200;
    const result = analyzePaymentSchedule(input, 10000, 12)!;
    expect(result.balanceMatches).toBe(false);
    expect(result.remainingBalance).toBeCloseTo(200);
    expect(result.expectedFinalPayment).toBeCloseTo(10100);
  });
  it("includes fee deductions in APR only once", () => {
    const input = schedule(10000, 12, 12);
    expect(scheduleEffectiveAPR(9800, input)).toBeGreaterThan(12);
    expect(analyzePaymentSchedule(input, 10000, 12, 9800)?.totalCost).toBe(1400);
  });
  it("uses days to maturity for a single payment, not a guessed monthly period", () => {
    expect(scheduleEffectiveAPR(500, single)).toBeCloseTo(0.1 * 365 / 30 * 100);
  });
});

describe("adjustable rate scenarios", () => {
  it.each([
    "The rate adjusts after 60 months. First adjustment is capped at 2%; lifetime cap is 8%.",
    "At 60 months the rate resets. Initial adjustment limit: 2 percentage points; maximum lifetime rate cap: 8%.",
    "The first adjustment occurs after 60 months. Initial increase cap of 2% and a lifetime rate ceiling of 8% apply.",
  ])("projects first adjustment and lifetime stress separately: %s", (text) => {
    const projections = projectAdjustableRates(text, 200000, 360, 4);
    expect(projections.map((entry) => entry.scenario)).toEqual(["first_adjustment", "lifetime_cap"]);
    expect(projections.map((entry) => entry.resetRate)).toEqual([6, 8]);
    expect(projections[0].remainingBalance).toBeLessThan(200000);
    expect(projections[0].payment).toBeLessThan(projections[1].payment);
  });
  it.each([
    "The rate adjusts after 36 months. First adjustment cap: 1%; lifetime increase limit is 5 percentage points.",
    "After 36 months interest resets. Initial increase capped at 1%; lifetime cap of 5 points applies.",
    "The initial adjustment occurs after 36 months. First adjustment limit is 1%; maximum lifetime cap is 5% above the initial rate.",
  ])("distinguishes a lifetime increase from an absolute rate ceiling: %s", (text) => {
    expect(projectAdjustableRates(text, 150000, 240, 3).find((entry) => entry.scenario === "lifetime_cap")?.resetRate).toBe(8);
  });
  it("uses an explicitly absolute first-reset rate cap without adding the initial rate", () => {
    const projections = projectAdjustableRates("After 60 months the rate resets. First adjustment rate cap: 6%; lifetime rate cap: 9%.", 200000, 360, 4);
    expect(projections[0].resetRate).toBe(6);
  });
});

describe("renewal clause scope", () => {
  it.each([
    "The lender is under no obligation to renew this advance.",
    "Loan extensions are not permitted.",
    "You cannot refinance or roll over the balance.",
  ])("does not invent a renewal from a prohibition: %s", (text) => {
    expect(renewalScenariosFor([text], single, 500)).toEqual([]);
  });
  it.each([
    "You may renew the loan by paying the charge at each maturity.",
    "An extension is allowed upon payment of the finance charge.",
    "Each rollover keeps the same principal outstanding.",
  ])("models three illustrative renewals only when allowed: %s", (text) => {
    const scenarios = renewalScenariosFor([text], single, 500)!;
    expect(scenarios.map((entry) => entry.totalPaid)).toEqual([600, 650, 700]);
    expect(scenarios.every((entry) => entry.effectiveAPR !== null)).toBe(true);
  });
  it("uses the stated renewal charge instead of repeating a different original charge", () => {
    const scenarios = renewalScenariosFor(["Renewal fee: $25. You may renew for the same period."], single, 500)!;
    expect(scenarios.map((entry) => entry.totalPaid)).toEqual([575, 600, 625]);
  });
});

describe("fee cashflow treatment", () => {
  it.each([
    ["The processing fee is deducted from the proceeds.", "deducted"],
    ["A charge is withheld from the advance.", "deducted"],
    ["The lender retains the fee from the disbursement.", "deducted"],
    ["The fee is financed into the loan balance.", "financed"],
    ["This charge is included in the amount financed.", "financed"],
    ["The premium is added to principal.", "financed"],
    ["The fee is paid separately.", "paid_separately"],
    ["The charge is due at closing.", "paid_separately"],
    ["This amount is payable upfront.", "paid_separately"],
  ])("attaches cashflow treatment to its clause: %s", (source, treatment) => {
    expect(feeCashflowTreatment({ source, negated: false, category: "upfront_fee" })).toBe(treatment);
  });
  it("does not add tax again to an already inclusive total", () => {
    const finding = { source: "Fee deducted from proceeds", category: "upfront_fee", amount: 100, taxAmount: 18, totalImpact: 118, position: 0, negated: false } as CostFinding;
    expect(feeCashflows([finding, { ...finding, id: "duplicate" }]).deducted).toBe(118);
  });
});
