import { analyzeLoan, calculateEMI, calculateFlatLoan, detectCurrency, formatCurrency, normalizeDuration, parseTimeUnit, toAnnualRate, type SupportedCurrency } from "./financial";
import { calculateRisk, classifyDocument, detectClaims, detectCosts, extractAmountCandidates, extractStatedEMI, scorePrincipalCandidates } from "./analysisEngine";
import { freezeAnalysisContext, type AdviceResult, type AlternativeFunding, type AnalysisContext, type DeceptionResult, type ExtractedField, type FairMarketBenchmark, type GlossaryItem, type InstallmentSchedule } from "./analysisContext";
import rules from "@/data/analysisRules.json";

const CURRENCY_AMOUNT_SOURCE = String.raw`(?:\$|₹|€|£|¥|US\$|C\$|A\$|S\$|usd|inr|eur|gbp|jpy|cad|aud|sgd|aed|rs\.?)`;
const PRICE_COMPARISON_PATTERN = new RegExp(
  String.raw`(?:was|mrp)\s*${CURRENCY_AMOUNT_SOURCE}\s*[\d,]+.*(?:now|offer)\s*${CURRENCY_AMOUNT_SOURCE}\s*[\d,]+`,
  "i"
);

function compactSnippet(value: string, maxLength = 120): string {
  const compact = value.replace(/\s+/g, " ").trim();
  if (compact.length <= maxLength) return compact;
  return `${compact.slice(0, maxLength - 3)}...`;
}

function snippet(text: string, start: number, end: number): string {
  return compactSnippet(text.slice(Math.max(0, start), Math.min(text.length, end)));
}

function cloneRegex(pattern: RegExp, forceGlobal = false): RegExp {
  const flagSet = new Set(pattern.flags.split(""));
  if (forceGlobal) flagSet.add("g");
  return new RegExp(pattern.source, Array.from(flagSet).join(""));
}

function findFirstEvidence(text: string, pattern: RegExp): string | null {
  const match = cloneRegex(pattern).exec(text);
  return match ? compactSnippet(match[0]) : null;
}

export interface ExtractedValues {
  loanAmount: number | null;
  interestRate: number | null;
  interestRateIsConditional?: boolean;
  tenureMonths: number | null;
  principalField: ExtractedField<number>;
  rateField: AnalysisContext["rateField"];
  termField: ExtractedField<number>;
  statedEMI: ExtractedField<number>;
  amountCandidates: ReturnType<typeof extractAmountCandidates>;
  installmentCount: number | null;
  docType: AnalysisContext["docType"];
  extracted: boolean;
}

export function extractValuesFromText(text: string): ExtractedValues {
  const amountCandidates = extractAmountCandidates(text);
  const docType = classifyDocument(text);
  const statedEMI = extractStatedEMI(text, amountCandidates);
  const parsedTerm = normalizeDuration(text);
  const termField: ExtractedField<number> = parsedTerm
    ? { value: parsedTerm.months, source: parsedTerm.source, confidence: parsedTerm.confidence === "high" ? 0.95 : 0.65, alternatives: [], needsReview: false }
    : { value: null, source: null, confidence: 0, alternatives: [], needsReview: false };

  let conditionalInterestRate: number | null = null;
  const deferredApr = text.match(/\bdeferred\s+interest[\s\S]{0,500}?(\d+(?:\.\d+)?)\s*%\s*apr\b/i);
  if (deferredApr) conditionalInterestRate = Number(deferredApr[1]);
  const rateMatches = Array.from(text.matchAll(/(?:\b(?:apr|annual\s+percentage\s+rate|interest\s+rate)\b[^%\d]{0,30}(\d+(?:\.\d+)?)\s*%|(\d+(?:\.\d+)?)\s*%\s*(?:apr|annual|interest|p\.?a\.?))/gi));
  let ordinaryRate: { value: number; source: string; position: number } | null = null;
  for (const match of rateMatches) {
    const statedValue = Number(match[1] ?? match[2]);
    if (!Number.isFinite(statedValue) || statedValue < 0 || statedValue > 10000) continue;
    const position = match.index ?? 0;
    const context = text.slice(Math.max(0, position - 160), Math.min(text.length, position + match[0].length + 160));
    if (statedValue === conditionalInterestRate || /deferred\s+interest|retroactiv\w*/i.test(context)) {
      conditionalInterestRate ??= statedValue;
      continue;
    }
    const periodText = text.slice(position, Math.min(text.length, position + match[0].length + 40));
    const periodMatch = periodText.match(/\b(?:per|each)\s+(day|week|fortnight|month|year)s?\b|\b(daily|weekly|fortnightly|monthly|annually|annual)\b/i);
    const period = periodMatch ? parseTimeUnit(periodMatch[1] ?? periodMatch[2]) : null;
    const isAlreadyAnnual = /\b(?:apr|annual|p\.?a\.?)\b/i.test(match[0] + " " + periodText);
    const annualValue = period && !isAlreadyAnnual ? toAnnualRate(statedValue, period) ?? statedValue : statedValue;
    ordinaryRate = { value: annualValue, source: snippet(text, position - 35, position + match[0].length + 40), position };
    break;
  }

  const interestRateIsConditional = ordinaryRate === null && conditionalInterestRate !== null;
  let interestRate = ordinaryRate?.value ?? conditionalInterestRate;
  let rateSource = ordinaryRate?.source ?? (interestRateIsConditional ? compactSnippet(text.slice(Math.max(0, deferredApr?.index ?? 0), (deferredApr?.index ?? 0) + (deferredApr?.[0].length ?? 0))) : null);
  let rateType: AnalysisContext["rateField"]["rateType"] = interestRateIsConditional ? "deferred" : /\bflat\b/i.test(ordinaryRate?.source ?? "") ? "flat" : docType.type === "credit_card" ? "revolving" : ordinaryRate ? "reducing" : "unknown";
  let rateConfidence = ordinaryRate ? 0.95 : interestRateIsConditional ? 0.92 : 0;
  if (interestRate === null && /\b(?:interest[- ]free|no\s+interest|0%\s+interest)\b/i.test(text) && conditionalInterestRate === null) {
    interestRate = 0;
    rateSource = (text.match(/interest[- ]free|no\s+interest|0%\s+interest/i) ?? [])[0] ?? null;
    rateType = "reducing";
    rateConfidence = 0.8;
  }
  const rateField: AnalysisContext["rateField"] = {
    value: interestRate,
    source: rateSource,
    confidence: rateConfidence,
    alternatives: rateMatches.map((match) => {
      const statedValue = Number(match[1] ?? match[2]);
      const position = match.index ?? 0;
      const periodText = text.slice(position, Math.min(text.length, position + match[0].length + 40));
      const periodMatch = periodText.match(/\b(?:per|each)\s+(day|week|fortnight|month|year)s?\b|\b(daily|weekly|fortnightly|monthly|annually|annual)\b/i);
      const period = periodMatch ? parseTimeUnit(periodMatch[1] ?? periodMatch[2]) : null;
      const isAlreadyAnnual = /\b(?:apr|annual|p\.?a\.?)\b/i.test(match[0] + " " + periodText);
      const value = period && !isAlreadyAnnual ? toAnnualRate(statedValue, period) ?? statedValue : statedValue;
      return { value, label: "APR", source: compactSnippet(text.slice(Math.max(0, position - 30), position + match[0].length + 30)), position, confidence: statedValue === conditionalInterestRate ? 0.92 : 0.85, score: 0 };
    }),
    needsReview: false,
    rateType,
  };
  const principalField = scorePrincipalCandidates(amountCandidates, interestRate, parsedTerm, statedEMI.value, docType.type);
  const loanAmount = principalField.value;
  const installmentCountMatch = text.match(/\b(?:pay\s+in\s+)?(\d+)\s+(?:(?:interest[- ]free|equal|fixed)\s+)?installments?\b/i);
  const installmentCount = installmentCountMatch ? Number(installmentCountMatch[1]) : null;

  return {
    loanAmount,
    interestRate,
    interestRateIsConditional,
    tenureMonths: termField.value,
    principalField,
    rateField,
    termField,
    statedEMI,
    amountCandidates,
    installmentCount,
    docType,
    extracted: loanAmount !== null || interestRate !== null || termField.value !== null,
  };
}

export function detectDeception(text: string): DeceptionResult {
  const urgencyTactics: string[] = [];
  const fakeDiscounts: string[] = [];
  const emotionalManipulation: string[] = [];

  const urgencyRules: Array<{ pattern: RegExp; message: string }> = [
    { pattern: /\bact\s*now\b/i, message: '"Act now" pressure language detected.' },
    { pattern: /\blimited\s*time\b/i, message: '"Limited time" framing may pressure hasty decisions.' },
    { pattern: /\bwon'?t\s*last\b/i, message: '"Won\'t last" scarcity tactic detected.' },
    { pattern: /\bhurry\b/i, message: '"Hurry" urgency language found.' },
    { pattern: /\bexpire(?:s|d)?\b[\s\S]{0,20}\bsoon\b/i, message: "Expiry pressure implies you must act immediately." },
  ];

  const fakeDiscountRules: Array<{ pattern: RegExp; message: string }> = [
    { pattern: /\bsave\s*up\s*to\s*\d+%/i, message: '"Save up to" claim may be calculated against an inflated baseline.' },
    {
      pattern: /\bcompared\s*to\b[\s\S]{0,40}\b(?:tier|rate|plan)\b/i,
      message: "Discount compared to an internal tier may not reflect market reality.",
    },
  ];

  const emotionalRules: Array<{ pattern: RegExp; message: string }> = [
    {
      pattern: /\bonce[\s-]*in[\s-]*a[\s-]*lifetime\b/i,
      message: '"Once in a lifetime" exaggeration detected.',
    },
    { pattern: /\bdon'?t\s*miss\s*out\b/i, message: '"Don\'t miss out" FOMO tactic detected.' },
    {
      pattern: /\bexclusive\b[\s\S]{0,24}\b(?:offer|rate|deal|access)\b/i,
      message: '"Exclusive" framing detected in promotional context.',
    },
    { pattern: /\byou\s*deserve\b/i, message: '"You deserve" emotional appeal detected.' },
  ];

  for (const rule of urgencyRules) {
    const evidence = findFirstEvidence(text, rule.pattern);
    if (evidence) urgencyTactics.push(`${rule.message} Evidence: ${evidence}.`);
  }

  for (const rule of fakeDiscountRules) {
    const evidence = findFirstEvidence(text, rule.pattern);
    if (evidence) fakeDiscounts.push(`${rule.message} Evidence: ${evidence}.`);
  }

  const crossedOutEvidence = findFirstEvidence(text, PRICE_COMPARISON_PATTERN);
  if (crossedOutEvidence) {
    fakeDiscounts.push(`Crossed-out price pattern found. Evidence: ${crossedOutEvidence}.`);
  }

  for (const rule of emotionalRules) {
    const evidence = findFirstEvidence(text, rule.pattern);
    if (evidence) emotionalManipulation.push(`${rule.message} Evidence: ${evidence}.`);
  }

  return { urgencyTactics, fakeDiscounts, emotionalManipulation };
}

export function generateAdvice(riskScore: number, confidence: number, contradictedClaims: boolean, riskBreakdown: AnalysisContext["riskBreakdown"]): AdviceResult {
  const reasons = riskBreakdown.flatMap((item) => item.reasons);
  if (contradictedClaims) reasons.unshift("A marketing claim conflicts with terms listed in the document.");
  if (confidence < 0.75) reasons.unshift("Key facts could not be extracted with enough confidence; verify the source document.");
  if (!reasons.length) reasons.push("No configured risk patterns were found in the extracted text.");
  return {
    recommendation: confidence < 0.75 ? "insufficient_confidence" : riskScore >= 30 || contradictedClaims ? "review_required" : "no_material_flags",
    reasons: Array.from(new Set(reasons)),
  };
}

export function generateLocalGlossary(text: string): GlossaryItem[] {
  return rules.glossary.filter((item) => new RegExp(item.pattern, "i").test(text)).map(({ term, definition }) => ({ term, definition }));
}

export function generateLocalFairMarket(rate: number, currency: SupportedCurrency, docType: string, region: string | null): FairMarketBenchmark | undefined {
  const entries = (rules as { benchmarks?: Array<{ currency: string; docType: string; region: string | null; marketAverage: number; source: string; asOf: string }> }).benchmarks ?? [];
  const match = entries.find((entry) => entry.currency === currency && entry.docType === docType && entry.region === region);
  if (!match || rate <= 0 || !match.source || !match.asOf) return undefined;
  const differencePercent = Math.round(((rate - match.marketAverage) / match.marketAverage) * 100);
  return { marketAverage: match.marketAverage, differencePercent, source: match.source, asOf: match.asOf, assessment: rate + "% is " + (differencePercent >= 0 ? differencePercent + "% above" : Math.abs(differencePercent) + "% below") + " the matched " + match.docType + " benchmark." };
}

export function generateLocalAlternativeFunding(rate: number, amount: number, currencyCode: SupportedCurrency, docType: string, maximumSavings: number): AlternativeFunding[] {
  const entries = (rules as { alternatives?: Array<AlternativeFunding & { docTypes?: string[]; currencies?: string[]; maximumAPR?: number; savingsPercent?: number }> }).alternatives ?? [];
  return entries.flatMap((entry) => {
    if (entry.docTypes?.length && !entry.docTypes.includes(docType)) return [];
    if (entry.currencies?.length && !entry.currencies.includes(currencyCode)) return [];
    if (entry.maximumAPR !== undefined && rate > entry.maximumAPR) return [];
    if (entry.savingsPercent !== undefined && maximumSavings > 0) {
      const savings = Math.min(maximumSavings, Math.max(0, amount * entry.savingsPercent / 100));
      return [{ ...entry, estimatedSavings: "Up to " + formatCurrency(savings, currencyCode) + " (estimate)" }];
    }
    return [{ title: entry.title, description: entry.description, estimatedSavings: entry.estimatedSavings }];
  });
}

function extractInstallmentSchedule(text: string): InstallmentSchedule | null {
  const match = text.match(/\b(?:pay\s+in\s+)?(?<count>\d+)\s+(?:(?:interest[- ]free|equal|fixed)\s+)?installments?\s+of\s+(?:US\$|C\$|A\$|S\$|\$|₹|€|£|¥|INR\s*|USD\s*|EUR\s*|GBP\s*|Rs\.?\s*)?(?<amount>\d{1,3}(?:,\d{2,3})+|\d+)(?:\.(?<decimal>\d+))?[\s\S]{0,80}?every\s+(?<interval>\d+)\s*(?<unit>days?|weeks?|months?)/i);
  if (!match?.groups) return null;
  const count = Number(match.groups.count);
  const amount = Number(match.groups.amount.replace(/,/g, "") + (match.groups.decimal ? "." + match.groups.decimal : ""));
  const interval = Number(match.groups.interval);
  const unit = match.groups.unit.toLowerCase();
  const intervalUnit: InstallmentSchedule["intervalUnit"] = unit.startsWith("day") ? "day" : unit.startsWith("week") ? "week" : "month";
  if (![count, amount, interval].every(Number.isFinite) || count <= 0 || amount <= 0 || interval <= 0) return null;
  return { count, amount, interval, intervalUnit, total: count * amount, totalWithKnownFees: null, source: compactSnippet(match[0]) };
}

function confidenceForAnalysis(context: Pick<AnalysisContext, "docType" | "principalField" | "rateField" | "termField" | "installmentSchedule">): number {
  const type = context.docType.type;
  const scores = [context.docType.confidence];
  if (["installment_loan", "auto_loan", "mortgage", "bnpl", "payday", "rent_to_own", "gold_loan"].includes(type)) {
    scores.push(context.principalField.confidence);
    if (type === "bnpl") scores.push(context.installmentSchedule ? 0.9 : context.termField.confidence);
    else scores.push(context.termField.confidence, context.rateField.confidence);
  }
  if (type === "unknown") scores.push(context.principalField.confidence, context.rateField.confidence, context.termField.confidence);
  return scores.length ? Math.min(...scores) : context.docType.confidence;
}

export function analyzeLocally(
  text: string,
  amountOverride: number | null = null,
  rateOverride: number | null = null,
  durationOverride: number | null = null,
  currencyOverride: SupportedCurrency | null = null,
): AnalysisContext {
  const extracted = extractValuesFromText(text);
  const principalField: AnalysisContext["principalField"] = amountOverride && amountOverride > 0
    ? { value: amountOverride, source: "User override", confidence: 1, alternatives: extracted.principalField.alternatives, needsReview: false }
    : extracted.principalField;
  const termField: AnalysisContext["termField"] = durationOverride && durationOverride > 0
    ? { value: durationOverride, source: "User override", confidence: 1, alternatives: extracted.termField.alternatives, needsReview: false }
    : extracted.termField;
  const useRateOverride = rateOverride !== null && rateOverride >= 0 && rateOverride !== extracted.rateField.value;
  const rateType: AnalysisContext["rateField"]["rateType"] = useRateOverride
    ? extracted.rateField.rateType === "deferred" ? "deferred" : "reducing"
    : extracted.rateField.rateType;
  const rateField: AnalysisContext["rateField"] = useRateOverride
    ? { value: rateOverride, source: "User override", confidence: 1, alternatives: extracted.rateField.alternatives, needsReview: false, rateType }
    : { ...extracted.rateField, rateType };
  const currency = currencyOverride ?? detectCurrency(text);
  const currencyCode = currency ?? "USD";
  const principal = principalField.value;
  const duration = termField.value;
  const schedule = extractInstallmentSchedule(text);
  const installmentCount = schedule?.count ?? extracted.installmentCount;
  const findings = detectCosts(text, principal, installmentCount, duration);
  const fees = findings.filter((finding) => finding.category !== "financed_addon" && finding.category !== "tax");
  const addOns = findings.filter((finding) => finding.category === "financed_addon");
  const taxes = findings.filter((finding) => finding.category === "tax");
  const claims = detectClaims(text, findings, rateField.rateType === "deferred" ? null : rateField.value);
  const confidence = confidenceForAnalysis({ docType: extracted.docType, principalField, rateField, termField, installmentSchedule: schedule });
  const risk = calculateRisk(text, extracted.docType.type, findings, claims, confidence);
  const warnings: string[] = [];
  for (const claim of claims.filter((item) => item.contradicted)) warnings.push(claim.label + ": " + claim.contradiction + " Evidence: " + claim.source + ".");
  for (const finding of findings.filter((item) => !item.negated)) warnings.push(finding.label + " detected. " + finding.explanation + " Evidence: " + finding.source + ".");
  for (const rule of rules.riskRules) {
    if (!rule.pattern) continue;
    const evidence = findFirstEvidence(text, new RegExp(rule.pattern, "i"));
    if (evidence) warnings.push(rule.id.replace(/_/g, " ") + " term detected. Evidence: " + evidence + ".");
  }
  if (extracted.interestRateIsConditional && rateField.value !== null) {
    warnings.push("Conditional deferred APR of " + extracted.interestRate + "% is stated; it is not used as the standard payment rate. Evidence: " + (rateField.source ?? "deferred-interest clause") + ".");
  }
  if (principalField.needsReview) warnings.push("The principal amount is ambiguous or conflicts with the stated installment; choose a source amount before relying on payment calculations.");
  if (currency === null) warnings.push("Currency was not identified in the text; amounts are displayed using the USD fallback until you select a currency.");

  if (schedule) {
    const knownFees = findings.filter((finding) => !finding.negated && (
      finding.frequency === "per_installment" ||
      (finding.frequency === "monthly" && finding.category === "financed_addon" && /automatically added|automatically enrolled/i.test(finding.source))
    )).reduce((sum, finding) => sum + (finding.totalImpact ?? 0), 0);
    schedule.totalWithKnownFees = schedule.total + knownFees;
    if (principal !== null && Math.abs(schedule.total - principal) > 0.01) {
      warnings.push("The stated installments total " + formatCurrency(schedule.total, currencyCode) + ", which differs from the purchase or principal amount " + formatCurrency(principal, currencyCode) + ".");
    }
    if (knownFees > 0) warnings.push("Scheduled payments plus identified recurring charges total at least " + formatCurrency(schedule.totalWithKnownFees, currencyCode) + "; conditional missed-payment charges are excluded.");
  }

  const hiddenFees = findings.filter((finding) => !finding.negated).map((finding) => {
    const impact = finding.totalImpact !== null ? " Estimated impact: " + formatCurrency(finding.totalImpact, currencyCode) + "." : " Total impact could not be determined from the text.";
    return finding.label + ": " + finding.source + "." + impact;
  });
  const standardRateAvailable = rateField.value !== null && rateField.rateType !== "deferred" && rateField.rateType !== "revolving";
  const financeCalculationAllowed = !["bnpl", "credit_card", "subscription", "advance_fee_scam"].includes(extracted.docType.type);
  const financialMetricsAvailable = Boolean(principal && principal > 0 && duration && duration > 0 && standardRateAvailable && financeCalculationAllowed);
  const upfrontFees = findings.filter((finding) => !finding.negated && finding.category === "upfront_fee" && finding.totalImpact !== null).reduce((sum, finding) => sum + (finding.totalImpact ?? 0), 0);
  const monthlyCost = findings.filter((finding) => !finding.negated && finding.frequency === "monthly" && finding.category !== "tax" && finding.amount !== null).reduce((sum, finding) => sum + (finding.amount ?? 0), 0);
  const annualCost = findings.filter((finding) => !finding.negated && finding.frequency === "annual" && finding.totalImpact !== null).reduce((sum, finding) => sum + (finding.totalImpact ?? 0), 0);
  const monthlyFees = monthlyCost + (duration && duration > 0 ? annualCost / duration : 0);
  let emi: number | null = null;
  let totalPayment: number | null = null;
  let totalInterest: number | null = null;
  let totalCost: number | null = null;
  let effectiveAPR: number | null = null;
  let netDisbursed: number | null = null;
  if (financialMetricsAvailable && principal !== null && duration !== null && rateField.value !== null) {
    const base = rateField.rateType === "flat"
      ? calculateFlatLoan(principal, rateField.value, duration)
      : calculateEMI(principal, rateField.value, duration);
    const analysis = analyzeLoan({ principal, annualRate: rateField.value, tenureMonths: duration, rateType: rateField.rateType === "flat" ? "flat" : "reducing", upfrontFees, monthlyFees });
    if (base && analysis) {
      emi = base.emi + monthlyFees;
      totalPayment = analysis.totalPayment;
      totalInterest = base.totalInterest;
      netDisbursed = analysis.netDisbursed;
      totalCost = analysis.totalCost;
      effectiveAPR = analysis.effectiveAPR;
    }
  }

  const advice = generateAdvice(risk.score, confidence, claims.some((claim) => claim.contradicted), risk.breakdown);
  const conditionalText = extracted.interestRateIsConditional && rateField.value !== null
    ? " A conditional deferred APR of " + extracted.interestRate + "% may be charged retroactively; it is not modeled as the standard installment rate."
    : "";
  const feeText = hiddenFees.length ? hiddenFees.length + " cost clause(s) were identified." : "No configured fee clauses were identified in the text.";
  const summary = schedule
    ? "The document schedules " + schedule.count + " payments of " + formatCurrency(schedule.amount, currencyCode) + " every " + schedule.interval + " " + schedule.intervalUnit + (schedule.interval === 1 ? "" : "s") + ", totaling " + formatCurrency(schedule.total, currencyCode) + " before fees. " + feeText + conditionalText
    : financialMetricsAvailable && emi !== null && totalPayment !== null && totalInterest !== null && principal !== null && duration !== null
      ? "The agreement states " + formatCurrency(principal, currencyCode) + " at " + rateField.value + "% " + (rateField.rateType === "flat" ? "flat " : "") + "annual rate over " + duration + " months. Estimated monthly payment including identified monthly fees is " + formatCurrency(emi, currencyCode) + "; scheduled payments total " + formatCurrency(totalPayment, currencyCode) + ", with an estimated total finance cost of " + formatCurrency(totalCost, currencyCode) + " including " + formatCurrency(totalInterest, currencyCode) + " interest and modeled fees." + (effectiveAPR !== null ? " Estimated effective APR after modeled fees is " + effectiveAPR.toFixed(2) + "%." : "") + " " + feeText
      : "Document scan classified this as " + extracted.docType.label.toLowerCase() + ". " + feeText + conditionalText + " Payment calculations are unavailable until the required amount, applicable rate, and term are supported.";

  const insights: string[] = [];
  if (schedule) insights.push("Installment arithmetic: " + schedule.count + " × " + formatCurrency(schedule.amount, currencyCode) + " = " + formatCurrency(schedule.total, currencyCode) + " before fees.");
  if (schedule?.totalWithKnownFees !== null && schedule?.totalWithKnownFees !== undefined && schedule.totalWithKnownFees > schedule.total) {
    insights.push("Identified fees raise scheduled cost to at least " + formatCurrency(schedule.totalWithKnownFees, currencyCode) + "; missed-payment and rescheduling costs are conditional.");
  }
  if (principalField.needsReview) insights.push("More than one amount could be the principal. Select the labeled amount that matches the contract's amount financed.");
  if (effectiveAPR !== null && rateField.value !== null && effectiveAPR > rateField.value + 0.01) {
    insights.push("Modeled fees raise the estimated effective APR from " + rateField.value + "% to " + effectiveAPR.toFixed(2) + "%.");
  }
  if (confidence < 0.75) insights.push("Extraction confidence is limited; the risk score is marked insufficient confidence.");
  if (!insights.length) insights.push("No additional arithmetic insight is available from the extracted fields.");

  const simulatorLateFee = findings.find((finding) => finding.id === "late_payment" && !finding.negated);
  const penaltyMatch = text.match(/\bpenalty\s*apr\b[^\d]{0,25}(\d+(?:\.\d+)?)\s*%/i);
  const maximumSavings = (totalInterest ?? 0) + findings.filter((finding) => !finding.negated).reduce((sum, finding) => sum + (finding.totalImpact ?? 0), 0);
  const context: AnalysisContext = {
    docType: extracted.docType,
    region: null,
    currency,
    currencyCode,
    principalField,
    rateField,
    termField,
    statedEMI: extracted.statedEMI,
    installmentSchedule: schedule,
    principal,
    fees,
    addOns,
    taxes,
    claims,
    confidence,
    warnings: Array.from(new Set(warnings)),
    riskScore: risk.score,
    riskBand: risk.band,
    riskBreakdown: risk.breakdown,
    summary,
    hiddenFees,
    insights,
    emi,
    totalPayment,
    totalInterest,
    totalCost,
    financialMetricsAvailable: financialMetricsAvailable && emi !== null,
    effectiveAPR,
    netDisbursed,
    deception: detectDeception(text),
    advice,
    glossary: generateLocalGlossary(text),
    fairMarketComparison: standardRateAvailable && rateField.value !== null
      ? generateLocalFairMarket(rateField.value, currencyCode, extracted.docType.type, null)
      : undefined,
    alternativeFunding: standardRateAvailable && rateField.value !== null && principal !== null
      ? generateLocalAlternativeFunding(rateField.value, principal, currencyCode, extracted.docType.type, maximumSavings)
      : [],
    simulator: {
      lateFeeAmount: simulatorLateFee?.amount ?? null,
      lateFeePercent: simulatorLateFee?.percent ?? null,
      lateFeeBasis: simulatorLateFee?.basis ?? null,
      penaltyAPR: penaltyMatch ? Number(penaltyMatch[1]) : null,
      isAssumption: !simulatorLateFee && !penaltyMatch,
    },
    rawText: text,
  };
  return freezeAnalysisContext(context) as AnalysisContext;
}
