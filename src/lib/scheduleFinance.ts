import { scheduleRules as config } from "./validatedConfig";
import type { CostFinding, InstallmentSchedule } from "./analysisContext";
import { calculateEffectiveAPR, calculateEMI, parseAmount, type AmortizationRow } from "./financial";

const finite = (value: number) => Number.isFinite(value);
const periodsPerYear = (unit: InstallmentSchedule["intervalUnit"]) => config.units.find((entry) => entry.unit === unit)!.periodsPerYear;

export interface ScheduleCashflow {
  payment: number;
  elapsedYears: number;
  elapsedMonths: number;
  intervalYears: number;
  kind: "regular" | "balloon" | "single";
}

/** Expand the stated sequence without replacing its final payment with an EMI. */
export function expandPaymentSchedule(schedule: InstallmentSchedule): ScheduleCashflow[] | null {
  const segments = schedule.segments?.length ? schedule.segments : [{ ...schedule, kind: schedule.count === 1 ? "single" as const : "regular" as const }];
  if (segments.reduce((sum, item) => sum + item.count, 0) > config.cashflows.maximumPayments) return null;
  let elapsedYears = 0;
  const cashflows: ScheduleCashflow[] = [];
  for (const segment of segments) {
    if (!Number.isInteger(segment.count) || segment.count < 1 || !finite(segment.amount) || segment.amount <= 0
      || !finite(segment.interval) || segment.interval <= 0) return null;
    const intervalYears = schedule.count === 1 && schedule.daysToMaturity
      ? schedule.daysToMaturity / 365 : segment.interval / periodsPerYear(segment.intervalUnit);
    for (let index = 0; index < segment.count; index++) {
      elapsedYears += intervalYears;
      cashflows.push({ payment: segment.amount, elapsedYears, elapsedMonths: elapsedYears * 12, intervalYears, kind: segment.kind });
    }
  }
  return cashflows;
}

/** Nominal APR on the first payment interval; handles different later intervals explicitly. */
export function scheduleEffectiveAPR(netProceeds: number, schedule: InstallmentSchedule): number | null {
  const payments = expandPaymentSchedule(schedule);
  if (!finite(netProceeds) || netProceeds <= 0 || !payments?.length) return null;
  const total = payments.reduce((sum, entry) => sum + entry.payment, 0);
  if (total < netProceeds) return null;
  if (Math.abs(total - netProceeds) < 1e-8) return 0;
  const periods = 1 / payments[0].intervalYears;
  const npv = (rate: number) => netProceeds - payments.reduce((sum, entry) => sum + entry.payment / (1 + rate) ** (entry.elapsedYears * periods), 0);
  let lower = 0;
  let upper = 1;
  for (let guard = 0; npv(upper) < 0 && guard < 100; guard++) upper *= 2;
  if (npv(upper) < 0) return null;
  for (let iteration = 0; iteration < 160; iteration++) {
    const middle = (lower + upper) / 2;
    if (npv(middle) < 0) lower = middle;
    else upper = middle;
  }
  const apr = (lower + upper) / 2 * periods * 100;
  return finite(apr) ? apr : null;
}

export function analyzePaymentSchedule(schedule: InstallmentSchedule, principal: number, annualRate: number | null, netProceeds = principal) {
  const payments = expandPaymentSchedule(schedule);
  if (!payments?.length || !finite(principal) || principal <= 0 || !finite(netProceeds) || netProceeds <= 0
    || (annualRate !== null && (!finite(annualRate) || annualRate < 0))) return null;
  let balance = principal;
  let computedInterest = 0;
  let expectedFinalPayment: number | null = null;
  const rows: AmortizationRow[] = [];
  if (annualRate !== null) {
    payments.forEach((entry, index) => {
      const interestPaid = Math.max(0, balance) * annualRate / 100 * entry.intervalYears;
      if (index === payments.length - 1) expectedFinalPayment = balance + interestPaid;
      const principalPaid = entry.payment - interestPaid;
      balance -= principalPaid;
      computedInterest += interestPaid;
      rows.push({ month: entry.elapsedMonths, emi: entry.payment, principalPaid, interestPaid, remainingBalance: balance });
    });
  }
  const totalPayment = payments.reduce((sum, entry) => sum + entry.payment, 0);
  const tolerance = Math.max(0.02, config.cashflows.roundingPerPayment * payments.length);
  return {
    emi: payments[0].payment,
    totalPayment,
    totalInterest: annualRate === null ? totalPayment - principal : computedInterest,
    totalCost: totalPayment - netProceeds,
    netDisbursed: netProceeds,
    effectiveAPR: scheduleEffectiveAPR(netProceeds, schedule),
    rows,
    expectedFinalPayment,
    remainingBalance: annualRate === null ? null : balance,
    balanceMatches: annualRate === null ? null : Math.abs(balance) <= tolerance,
    elapsedMonths: payments[payments.length - 1].elapsedMonths,
  };
}

export interface AdjustableRateProjection {
  scenario: "first_adjustment" | "lifetime_cap";
  resetMonths: number;
  resetRate: number;
  payment: number;
  remainingBalance: number;
  initialPayment: number;
  source: string;
  assumption: string;
}

export function projectAdjustableRates(text: string, principal: number | null, termMonths: number | null, initialRate: number | null, monthlyFees = 0): AdjustableRateProjection[] {
  if (principal === null || termMonths === null || initialRate === null || ![principal, termMonths, initialRate, monthlyFees].every(finite)
    || principal <= 0 || initialRate < 0 || monthlyFees < 0) return [];
  const rules = config.adjustableRates;
  const resetMatch = new RegExp(rules.resetAfterMonthsPattern, "i").exec(text);
  const resetMonths = Number(resetMatch?.groups?.months ?? resetMatch?.groups?.monthsAfterReset ?? resetMatch?.groups?.monthsAfterRateReset ?? NaN);
  if (!Number.isInteger(resetMonths) || resetMonths <= 0 || resetMonths >= termMonths) return [];
  const initial = calculateEMI(principal, initialRate, termMonths);
  if (!initial) return [];
  let remainingBalance = principal;
  for (let month = 0; month < resetMonths; month++) remainingBalance = remainingBalance * (1 + initialRate / 1200) - initial.emi;
  if (remainingBalance <= 0) return [];
  const first = new RegExp(rules.firstAdjustmentCapPattern, "i").exec(text);
  const lifetime = new RegExp(rules.lifetimeCapPattern, "i").exec(text);
  const firstCap = Number(first?.groups?.cap ?? NaN);
  const lifetimeCap = Number(lifetime?.groups?.cap ?? NaN);
  const lifetimeRate = finite(lifetimeCap)
    ? (new RegExp(rules.incrementPattern, "i").test(lifetime![0]) ? initialRate + lifetimeCap : lifetimeCap) : null;
  if (lifetimeRate !== null && lifetimeRate < initialRate) return [];
  const output: AdjustableRateProjection[] = [];
  const add = (scenario: AdjustableRateProjection["scenario"], resetRate: number, source: string, assumption: string) => {
    const payment = calculateEMI(remainingBalance, resetRate, termMonths - resetMonths);
    if (payment) output.push({ scenario, resetMonths, resetRate, payment: payment.emi + monthlyFees, remainingBalance, initialPayment: initial.emi + monthlyFees, source, assumption });
  };
  const firstLabel = first?.[0].slice(0, first[0].indexOf(first.groups?.cap ?? "")) ?? "";
  const firstRate = first && new RegExp(rules.absolutePattern, "i").test(firstLabel) && !new RegExp(rules.incrementPattern, "i").test(firstLabel) ? firstCap : initialRate + firstCap;
  if (finite(firstCap) && firstRate >= initialRate) add("first_adjustment", Math.min(firstRate, lifetimeRate ?? Infinity), first![0], "First-adjustment ceiling; the actual benchmark rate may be lower.");
  if (lifetimeRate !== null) add("lifetime_cap", lifetimeRate, lifetime![0], "Stress scenario using the remaining balance at the first reset; the lifetime ceiling may only be reached at later resets.");
  return output;
}

export function renewalScenariosFor(clauses: readonly string[], schedule: InstallmentSchedule, principal: number, netProceeds = principal): InstallmentSchedule["renewalScenarios"] {
  if (schedule.count !== 1 || !schedule.daysToMaturity || principal <= 0 || netProceeds <= 0) return [];
  const rules = config.renewals;
  const permitted = clauses.filter((clause) => new RegExp(rules.conceptPattern, "i").test(clause)
    && new RegExp(rules.permissionPattern, "i").test(clause) && !new RegExp(rules.denialPattern, "i").test(clause));
  const originalCharge = (schedule.statedTotal ?? schedule.total) - principal;
  if (!permitted.length || originalCharge <= 0) return [];
  const chargePattern = new RegExp(rules.explicitChargePattern.split("{{CURRENCY}}").join(config.currencyPattern), "i");
  const explicitCharges = [...new Set(permitted.flatMap((clause) => {
    const amount = chargePattern.exec(clause)?.groups?.amount;
    const value = amount ? parseAmount(amount) : null;
    return value === null ? [] : [value];
  }))];
  if (explicitCharges.length > 1) return [];
  const charge = explicitCharges[0] ?? originalCharge;
  return Array.from({ length: rules.maximumRenewals }, (_, index) => {
    const renewals = index + 1;
    const flows = [netProceeds, -originalCharge, ...Array<number>(renewals - 1).fill(-charge), -(principal + charge)];
    const rate = calculateEffectiveAPR(flows, 365 / schedule.daysToMaturity!);
    return { renewals, totalPaid: principal + originalCharge + renewals * charge, effectiveAPR: rate ? rate.apr * 100 : null,
      assumption: explicitCharges.length ? "Each renewal repeats the stated renewal charge and original term." : "Each renewal repeats the original finance charge and term; illustrative until the provider confirms the renewal price." };
  });
}

export type FeeTreatment = "deducted" | "financed" | "paid_separately" | "unknown";
export function feeCashflowTreatment(finding: Pick<CostFinding, "source" | "negated" | "category" | "evidence">): FeeTreatment {
  const rules = config.cashflows;
  if (finding.negated || !rules.eligibleCategories.includes(finding.category) || new RegExp(rules.excludedPattern, "i").test(finding.source)) return "unknown";
  if (new RegExp(rules.deductedPattern, "i").test(finding.source)) return "deducted";
  if (new RegExp(rules.financedPattern, "i").test(finding.source)) return "financed";
  if (new RegExp(rules.paidSeparatelyPattern, "i").test(finding.source)) return "paid_separately";
  // Fee detectors may isolate the amount from a following treatment label.
  // Use the enclosing evidence only if it expresses one unambiguous treatment.
  if (finding.evidence && !new RegExp(rules.excludedPattern, "i").test(finding.evidence)) {
    const matching = ([['deducted', rules.deductedPattern], ['financed', rules.financedPattern], ['paid_separately', rules.paidSeparatelyPattern]] as const)
      .filter(([, pattern]) => new RegExp(pattern, "i").test(finding.evidence!));
    if (matching.length === 1) return matching[0][0];
  }
  return finding.category === "upfront_fee" ? rules.defaultUpfrontTreatment as FeeTreatment : "unknown";
}

export function statedNetProceeds(text: string): { amount: number; source: string } | null {
  const values = Array.from(text.matchAll(new RegExp(config.cashflows.netProceedsPattern, "gi")))
    .map((match) => ({ amount: parseAmount(match.groups?.amount ?? ""), source: match[0] }))
    .filter((item): item is { amount: number; source: string } => item.amount !== null && item.amount > 0);
  return new Set(values.map((item) => item.amount)).size === 1 ? values[0] : null;
}

export function feeCashflows(findings: readonly CostFinding[]) {
  const totals = { deducted: 0, financed: 0, paidSeparately: 0, explicitPaidSeparately: 0, unknown: 0 };
  const seen = new Set<string>();
  for (const finding of findings) {
    if (finding.negated || !config.cashflows.eligibleCategories.includes(finding.category)) continue;
    const amount = finding.totalImpact ?? (finding.amount == null ? null : finding.amount + (finding.taxAmount ?? 0));
    if (amount === null || !finite(amount) || amount <= 0) continue;
    const key = `${finding.position}:${finding.source}:${amount}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const treatment = feeCashflowTreatment(finding);
    totals[treatment === "paid_separately" ? "paidSeparately" : treatment] += amount;
    if (treatment === "paid_separately" && new RegExp(config.cashflows.paidSeparatelyPattern, "i").test(finding.source)) {
      totals.explicitPaidSeparately += amount;
    }
  }
  return totals;
}
