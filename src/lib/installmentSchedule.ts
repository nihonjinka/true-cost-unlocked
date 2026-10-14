import { analysisRules as rules, scheduleRules } from "./validatedConfig";
import { classifyDocument, extractAmountCandidates, parseMonetaryValues, segmentClauses } from "./analysisEngine";
import { countedSchedules, frequenciesIn, paymentMaturityIn } from "./scheduleParsing";
import type { InstallmentSchedule } from "./analysisContext";

const SCHEDULE_MONEY_TOKEN = String.raw`(?:(?:US\$|C\$|A\$|S\$|[$₹€£¥]|\b(?:USD|INR|EUR|GBP|JPY|CAD|AUD|SGD|AED)\b|Rs\.?)\s*)?(?:\d{1,3}(?:,\d{2,3})+|\d+)(?:\.\d+)?`;

export function extractInstallmentSchedule(text: string): InstallmentSchedule | null {
  const matches = [...new Map(countedSchedules(text).map((entry) => [entry.position + ":" + entry.count, entry])).values()]
    .sort((left, right) => left.position - right.position);
  const amounts = extractAmountCandidates(text);
  const clauses = segmentClauses(text);
  const segments: NonNullable<InstallmentSchedule["segments"]> = [];
  let previousFrequency: { interval: number; unit: InstallmentSchedule["intervalUnit"] } | null = null;
  const segmentWindow = (rules as typeof rules & { paymentSchedule?: { segmentWindowCharacters?: number } }).paymentSchedule?.segmentWindowCharacters ?? 480;
  for (let index = 0; index < matches.length; index += 1) {
    const item = matches[index];
    const clause = clauses.find((candidate) => candidate.start <= item.position && item.position < candidate.end);
    const next = matches.slice(index + 1).find((candidate) => candidate.position > item.position);
    const end = Math.min(next?.position ?? item.position + segmentWindow, item.position + segmentWindow);
    const amountCandidate = amounts.find((candidate) => {
      if (candidate.position < item.position || candidate.position >= end) return false;
      // Candidate labels can inherit a nearby table heading (for example Cash
      // price from the preceding row); qualify against this schedule segment.
      const localRoleContext = text.slice(Math.max(item.position, candidate.position - 100), candidate.position);
      return !/principal|loan amount|amount financed|amount borrowed|credit amount|balance|price|finance charge|total (?:of payments|repayment|payable)|\bfees?\b|\bcharges?\b/i.test(localRoleContext);
    });
    if (!amountCandidate || amountCandidate.value <= 0) continue;
    const token = new RegExp(SCHEDULE_MONEY_TOKEN, "gi").exec(text.slice(amountCandidate.position));
    const sourceStart = clause?.start ?? item.position;
    const maturity = item.count === 1 && matches.length === 1 && clause ? paymentMaturityIn(clause.text) : null;
    const sourceEnd = Math.max(maturity ? clause!.end : 0, amountCandidate.position + (token?.[0].length ?? String(amountCandidate.value).length),
      item.position + item.source.length);
    const source = text.slice(sourceStart, sourceEnd).trim();
    const frequency = item.frequency ?? frequenciesIn(source)[0] ?? previousFrequency;
    const unit: InstallmentSchedule["intervalUnit"] = maturity?.unit ?? frequency?.unit ?? (item.count === 1 && /\b(?:days?|weeks?|months?|years?)\b/i.test(source)
      ? /\b(?:days?)\b/i.test(source) ? "day" : /\b(?:weeks?)\b/i.test(source) ? "week" : /\b(?:years?)\b/i.test(source) ? "year" : "month"
      : "month");
    const interval = maturity?.interval ?? frequency?.interval ?? 1;
    previousFrequency = { interval, unit };
    const kind = /\b(?:final|balloon|lump[- ]sum|maturity)\b/i.test(source) ? "balloon" : item.count === 1 && matches.length === 1 ? "single" : "regular";
    segments.push({ count: item.count, amount: amountCandidate.value, interval, intervalUnit: unit,
      total: item.count * amountCandidate.value, kind, source });
  }

  if (segments.length) {
    const count = segments.reduce((sum, segment) => sum + segment.count, 0);
    const total = segments.reduce((sum, segment) => sum + segment.total, 0);
    const stated = amounts.find((candidate) => /total of payments|total repayment|total payable|scheduled total/i.test(candidate.label + " " + candidate.source));
    const statedTotal = stated?.value ?? null;
    const tolerance = (rules as unknown as { paymentSchedule?: { roundingTolerance?: number } }).paymentSchedule?.roundingTolerance ?? 0.005;
    const maturity = count === 1 ? paymentMaturityIn(segments[0].source) : null;
    return { count, amount: segments[0].amount, interval: segments[0].interval, intervalUnit: segments[0].intervalUnit, total,
      totalWithKnownFees: null, source: segments.map((segment) => segment.source).join(" "), firstPaymentTiming: "one period after agreement",
      segments, statedTotal, totalMatchesStated: statedTotal === null ? null : Math.abs(total - statedTotal) <= Math.max(1, statedTotal * tolerance),
      daysToMaturity: maturity?.days ?? null, maturityAssumption: maturity?.assumption ?? null };
  }

  const singleClause = clauses.find((clause) => new RegExp(scheduleRules.singlePayment.conceptPattern, "i").test(clause.text));
  if (singleClause && /\b(?:payment|repayment|repay|balloon|maturity)\b/i.test(singleClause.text)) {
    const maturity = paymentMaturityIn(singleClause.text);
    const money = amounts.find((candidate) => candidate.position >= singleClause.start && candidate.position < singleClause.end
      && !/principal|amount financed|finance charge|total (?:of payments|repayment|payable)|fees?|charges?|deposit/i.test(candidate.label));
    if (money && maturity) {
      return { count: 1, amount: money.value, interval: maturity.interval, intervalUnit: maturity.unit, total: money.value,
        totalWithKnownFees: null, source: singleClause.text, firstPaymentTiming: "one period after agreement",
        segments: [{ count: 1, amount: money.value, interval: maturity.interval, intervalUnit: maturity.unit, total: money.value, kind: "single", source: singleClause.text }],
        statedTotal: money.value, totalMatchesStated: true, daysToMaturity: maturity.days, maturityAssumption: maturity.assumption };
    }
  }

  if (classifyDocument(text).type === "merchant_cash_advance") {
    const remittanceClause = segmentClauses(text).find((clause) => /\b(?:daily|weekly|monthly|per\s+day|per\s+week)\b[^.;]{0,50}\b(?:remittance|remit|withhold|debit)\b|\b(?:remittance|remit|withhold|debit)\b[^.;]{0,50}\b(?:daily|weekly|monthly|per\s+day|per\s+week)\b/i.test(clause.text));
    const remittance = remittanceClause && parseMonetaryValues(remittanceClause.text, remittanceClause.start).find((value) => value.amount !== null);
    const purchased = extractAmountCandidates(text).filter((candidate) => /purchased amount|receivables purchased|total repayment|total of payments/i.test(candidate.label + " " + candidate.source))
      .sort((left, right) => right.score - left.score)[0];
    const frequency = remittanceClause?.text.match(/\b(daily|weekly|monthly)\b|\bper\s+(day|week)\b/i)?.[0]?.toLowerCase();
    const unit: InstallmentSchedule["intervalUnit"] = frequency?.includes("week") ? "week" : frequency?.includes("month") ? "month" : "day";
    if (remittance?.amount && purchased && purchased.value >= remittance.amount) {
      const count = Math.round(purchased.value / remittance.amount);
      if (count > 0 && Math.abs(count * remittance.amount - purchased.value) <= Math.max(1, purchased.value * 0.01)) {
        return { count, amount: remittance.amount, interval: 1, intervalUnit: unit, total: count * remittance.amount,
          totalWithKnownFees: null, source: remittanceClause!.text, firstPaymentTiming: "one period after agreement",
          segments: [{ count, amount: remittance.amount, interval: 1, intervalUnit: unit, total: count * remittance.amount, kind: "regular", source: remittanceClause!.text }] };
      }
    }
  }
  return null;
}
