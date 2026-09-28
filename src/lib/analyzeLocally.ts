import { calculateEMI, formatCurrency, type SupportedCurrency } from "./financial";
import type { AnalysisResult } from "@/components/AnalysisDashboard";
import type { DeceptionResult } from "@/components/DeceptionDetector";
import type { AdviceResult } from "@/components/SmartAdvice";

const UNIT_MULTIPLIERS: Record<string, number> = {
  k: 1_000,
  thousand: 1_000,
  lakh: 100_000,
  lac: 100_000,
  crore: 10_000_000,
  million: 1_000_000,
  billion: 1_000_000_000,
};

const CURRENCY_AMOUNT_SOURCE = String.raw`(?:\$|₹|€|£|¥|US\$|C\$|A\$|S\$|usd|inr|eur|gbp|jpy|cad|aud|sgd|aed|rs\.?)`;
const CURRENCY_DETECTION_RULES: Array<{ code: SupportedCurrency; source: string }> = [
  { code: "INR", source: String.raw`(?:₹|\bINR\b|\bRs\.?(?=\s|\d|$))` },
  { code: "EUR", source: String.raw`(?:€|\bEUR\b)` },
  { code: "GBP", source: String.raw`(?:£|\bGBP\b)` },
  { code: "JPY", source: String.raw`(?:¥|\bJPY\b)` },
  { code: "CAD", source: String.raw`(?:C\$|\bCAD\b)` },
  { code: "AUD", source: String.raw`(?:A\$|\bAUD\b)` },
  { code: "SGD", source: String.raw`(?:S\$|\bSGD\b)` },
  { code: "AED", source: String.raw`(?:\bAED\b)` },
  { code: "USD", source: String.raw`(?:US\$|\$|\bUSD\b)` },
];
const PRICE_COMPARISON_PATTERN = new RegExp(
  String.raw`(?:was|mrp)\s*${CURRENCY_AMOUNT_SOURCE}\s*[\d,]+.*(?:now|offer)\s*${CURRENCY_AMOUNT_SOURCE}\s*[\d,]+`,
  "i"
);

function compactSnippet(value: string, maxLength = 120): string {
  const compact = value.replace(/\s+/g, " ").trim();
  if (compact.length <= maxLength) return compact;
  return `${compact.slice(0, maxLength - 3)}...`;
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

function findAllEvidence(text: string, pattern: RegExp, limit = 3): string[] {
  const regex = cloneRegex(pattern, true);
  const evidences: string[] = [];
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null && evidences.length < limit) {
    const evidence = compactSnippet(match[0]);
    if (!evidences.includes(evidence)) {
      evidences.push(evidence);
    }
    if (match.index === regex.lastIndex) {
      regex.lastIndex += 1;
    }
  }

  return evidences;
}

function parseAmountWithUnit(rawAmount: string, rawUnit?: string): number {
  const numeric = parseFloat(rawAmount.replace(/,/g, ""));
  if (!Number.isFinite(numeric)) return NaN;
  const unit = rawUnit?.toLowerCase().trim() ?? "";
  return numeric * (UNIT_MULTIPLIERS[unit] ?? 1);
}

function detectCurrencyCode(text: string): SupportedCurrency {
  let detected: SupportedCurrency = "USD";
  let maxMatches = 0;

  for (const rule of CURRENCY_DETECTION_RULES) {
    const matches = text.match(new RegExp(rule.source, "gi"))?.length ?? 0;
    if (matches > maxMatches) {
      maxMatches = matches;
      detected = rule.code;
    }
  }

  return detected;
}

export interface ExtractedValues {
  loanAmount: number | null;
  interestRate: number | null;
  tenureMonths: number | null;
  extracted: boolean;
}

export function extractValuesFromText(text: string): ExtractedValues {
  let loanAmount: number | null = null;
  let interestRate: number | null = null;
  let tenureMonths: number | null = null;

  // Extract loan/credit amount
  const amountPatterns = [
    new RegExp(String.raw`(?:loan|credit|principal|borrow|finance|amount|sum|balance|sanction(?:ed)?\s*amount)[^\d]{0,25}${CURRENCY_AMOUNT_SOURCE}\s*([\d,]+(?:\.\d+)?)\s*(lakh|lac|crore|million|billion|thousand|k)?`, "i"),
    /(?:loan|credit|principal|borrow|finance|amount|sum|balance|sanction(?:ed)?\s*amount)[^\d]{0,25}([\d,]+(?:\.\d+)?)\s*(lakh|lac|crore|million|billion|thousand|k)\b/i,
    new RegExp(String.raw`${CURRENCY_AMOUNT_SOURCE}\s*([\d,]+(?:\.\d+)?)\s*(lakh|lac|crore|million|billion|thousand|k)?\s*(?:loan|credit|principal|amount)?`, "i"),
    new RegExp(String.raw`(?:up\s*to|maximum|limit)[^\d]{0,25}(?:${CURRENCY_AMOUNT_SOURCE})?\s*([\d,]+(?:\.\d+)?)\s*(lakh|lac|crore|million|billion|thousand|k)?`, "i"),
    new RegExp(String.raw`(?:amount|balance|sum)\s*(?:of|:)\s*(?:${CURRENCY_AMOUNT_SOURCE})?\s*([\d,]+(?:\.\d+)?)\s*(lakh|lac|crore|million|billion|thousand|k)?`, "i"),
  ];
  for (const pattern of amountPatterns) {
    const match = text.match(pattern);
    if (match) {
      const val = parseAmountWithUnit(match[1], match[2]);
      if (Number.isFinite(val) && val > 100) { loanAmount = val; break; }
    }
  }

  // Extract interest rate / APR
  const ratePatterns = [
    /(?:apr|annual\s*percentage\s*rate|interest\s*rate)[^%\d]*(\d+(?:\.\d+)?)\s*%/i,
    /(\d+(?:\.\d+)?)\s*%\s*(?:apr|annual|interest|variable|fixed)/i,
    /(?:rate|apr)\s*(?:of|is|:)\s*(\d+(?:\.\d+)?)\s*%/i,
    /(\d+(?:\.\d+)?)\s*%\s*(?:per\s*annum|p\.?a\.?)/i,
  ];
  for (const pattern of ratePatterns) {
    const match = text.match(pattern);
    if (match) {
      const val = parseFloat(match[1]);
      if (val > 0 && val < 100) { interestRate = val; break; }
    }
  }

  // Extract tenure/duration
  const tenurePatterns = [
    /(\d+)\s*(?:months?|month\s*term|monthly\s*(?:payment|installment)s?)/i,
    /(?:tenure|term|duration|period|repayment)\s*(?:of|is|:)?\s*(\d+)\s*(?:months?|mo)/i,
    /(\d+)\s*(?:year|yr)s?\s*(?:term|tenure|duration|period|loan|repayment)?/i,
    /(?:over|for|within)\s*(\d+)\s*months?/i,
  ];
  for (const pattern of tenurePatterns) {
    const match = text.match(pattern);
    if (match) {
      let val = parseInt(match[1] || match[2], 10);
      // If matched via year pattern, convert
      if (/year|yr/i.test(match[0]) && val < 100) val *= 12;
      if (val > 0 && val <= 600) { tenureMonths = val; break; }
    }
  }

  return {
    loanAmount,
    interestRate,
    tenureMonths,
    extracted: loanAmount !== null || interestRate !== null || tenureMonths !== null,
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

export function generateAdvice(riskScore: number, rate: number, totalInterest: number, principal: number, hiddenFees: string[]): AdviceResult {
  const interestRatio = principal > 0 ? totalInterest / principal : 0;

  let recommendation: AdviceResult["recommendation"] = "take";
  if (riskScore >= 60 || rate > 25 || interestRatio > 0.5) recommendation = "avoid";
  else if (riskScore >= 30 || rate > 15 || hiddenFees.length >= 3) recommendation = "caution";

  const reasons: string[] = [];
  if (rate > 20) reasons.push(`Interest rate of ${rate}% is well above the national average of ~11%.`);
  else if (rate > 10) reasons.push(`Interest rate of ${rate}% is moderate — shop around for sub-10% options.`);
  else if (rate > 0) reasons.push(`Interest rate of ${rate}% is competitive.`);
  else reasons.push("Interest rate could not be determined — verify before proceeding.");

  if (interestRatio > 0.5) reasons.push(`You'd pay ${(interestRatio * 100).toFixed(0)}% of the principal in interest — that's very expensive.`);
  if (hiddenFees.length > 0) reasons.push(`${hiddenFees.length} hidden fee(s) detected that increase the true cost.`);
  if (riskScore >= 60) reasons.push("High risk score indicates aggressive terms and potential traps.");

  const alternatives: string[] = [];
  if (rate > 15) alternatives.push("Credit unions typically offer rates 5-10% lower than banks.");
  if (rate > 20) alternatives.push("Consider a secured loan or credit-builder loan at lower rates.");
  alternatives.push("Compare at least 3 lenders before committing.");
  if (interestRatio > 0.3) alternatives.push("Shorter loan terms significantly reduce total interest paid.");

  const tips: string[] = [
    "Always read the full agreement — not just the summary.",
    "Negotiate fees — many lenders will waive origination and processing fees.",
    "Set up autopay to avoid late fees and potential penalty APR.",
  ];
  if (rate > 15) tips.push("Improve your credit score by 50+ points to qualify for much better rates.");

  return { recommendation, reasons, alternatives, tips };
}

export function analyzeLocally(text: string, amount: number, rate: number, duration: number, overrideCurrency?: SupportedCurrency): AnalysisResult & { deception: DeceptionResult; advice: AdviceResult } {
  const { emi, totalPayment, totalInterest } = calculateEMI(amount, rate, duration);
  const currencyCode = overrideCurrency || detectCurrencyCode(text);

  const hiddenFees: string[] = [];
  const warnings: string[] = [];
  let riskScore = 20;

  const feePatterns: Array<{ pattern: RegExp; label: string }> = [
    { pattern: new RegExp(String.raw`annual\s*fee[:\s]*(?:${CURRENCY_AMOUNT_SOURCE})?[\d,.]+`, "i"), label: "Annual Fee" },
    { pattern: /balance\s*transfer\s*fee[:\s]*(?:\d+%)/i, label: "Balance Transfer Fee" },
    { pattern: /cash\s*advance\s*fee[:\s]*(?:\d+%)/i, label: "Cash Advance Fee" },
    { pattern: /foreign\s*transaction\s*fee[:\s]*(?:\d+%)/i, label: "Foreign Transaction Fee" },
    {
      pattern: new RegExp(String.raw`late\s*payment\s*fee[:\s]*(?:up\s*to\s*)?(?:${CURRENCY_AMOUNT_SOURCE})?[\d,.]+`, "i"),
      label: "Late Payment Fee",
    },
    {
      pattern: new RegExp(String.raw`returned\s*payment\s*fee[:\s]*(?:up\s*to\s*)?(?:${CURRENCY_AMOUNT_SOURCE})?[\d,.]+`, "i"),
      label: "Returned Payment Fee",
    },
    { pattern: /prepayment\s*(?:penalty|fee)/i, label: "Prepayment Penalty" },
    { pattern: /origination\s*fee/i, label: "Origination Fee" },
    { pattern: /processing\s*fee/i, label: "Processing Fee" },
  ];

  for (const { pattern, label } of feePatterns) {
    const evidenceMatches = findAllEvidence(text, pattern, 3);
    if (evidenceMatches.length > 0) {
      for (const evidence of evidenceMatches) {
        hiddenFees.push(`${label}: ${evidence}`);
      }
      riskScore += 6 + Math.min(2, evidenceMatches.length - 1) * 2;
    }
  }

  const warningRules: Array<{ pattern: RegExp; message: string; risk: number }> = [
    {
      pattern: /\bpenalty\s*apr\b/i,
      message: "Penalty APR clause found — your rate could increase significantly after a missed payment.",
      risk: 15,
    },
    {
      pattern: /\bvariable\b[\s\S]{0,80}\bprime\s*rate\b/i,
      message: "Variable rate tied to Prime Rate — your payments could increase when rates rise.",
      risk: 10,
    },
    {
      pattern: /\b(?:change|modify)\s+(?:the\s+)?terms?\b/i,
      message: "Lender reserves the right to change terms — review trigger conditions carefully.",
      risk: 12,
    },
    {
      pattern: /\bminimum\s*payment\b[\s\S]{0,90}\b(?:greater\s*of|interest|fees|%)\b/i,
      message: "Minimum-payment clause detected — paying only minimums can significantly raise total interest.",
      risk: 5,
    },
    {
      pattern: /\b(?:introductory|promotional)\s*(?:apr|rate)?\b/i,
      message: "Promotional rate language present — verify post-promo pricing and trigger conditions.",
      risk: 5,
    },
    {
      pattern: /\bindefinitely\b[\s\S]{0,80}\b(?:apply|penalty|apr|rate)\b|\b(?:penalty|apr|rate)\b[\s\S]{0,80}\bindefinitely\b/i,
      message: "Penalty terms may apply indefinitely — this is an aggressive risk clause.",
      risk: 10,
    },
  ];

  for (const rule of warningRules) {
    const evidence = findFirstEvidence(text, rule.pattern);
    if (!evidence) continue;
    warnings.push(`${rule.message} Evidence: ${evidence}.`);
    riskScore += rule.risk;
  }

  if (rate > 20) {
    warnings.push(`High interest rate of ${rate}% — significantly above average market rates.`);
    riskScore += 10;
  }

  const uniqueHiddenFees = Array.from(new Set(hiddenFees));
  const uniqueWarnings = Array.from(new Set(warnings));

  riskScore = Math.min(riskScore, 100);

  const interestPct = amount > 0 ? ((totalInterest / amount) * 100).toFixed(1) : "0";

  let summary: string;
  if (amount > 0 && rate > 0 && duration > 0) {
    summary = `This agreement involves a loan/credit of ${formatCurrency(amount, currencyCode)} at ${rate}% annual interest over ${duration} months. ` +
      `Your monthly payment would be ${formatCurrency(emi, currencyCode)}, totaling ${formatCurrency(totalPayment, currencyCode)} — meaning you'd pay ${formatCurrency(totalInterest, currencyCode)} (${interestPct}%) in interest alone. ` +
      `${uniqueHiddenFees.length > 0 ? `We detected ${uniqueHiddenFees.length} fee(s) that could increase your actual cost.` : "No significant hidden fees were detected."} ` +
      `${riskScore >= 60 ? "This agreement carries HIGH risk — proceed with caution." : riskScore >= 30 ? "This agreement has moderate risk factors to be aware of." : "This agreement appears relatively straightforward."}`;
  } else {
    summary = `Analysis of this financial document detected ${uniqueHiddenFees.length} fee(s) and ${uniqueWarnings.length} warning(s). ` +
      `${riskScore >= 60 ? "This agreement carries HIGH risk — proceed with caution." : riskScore >= 30 ? "This agreement has moderate risk factors to be aware of." : "This agreement appears relatively straightforward."} ` +
      `Some financial values could not be determined — EMI calculations may be incomplete.`;
  }

  const insights: string[] = [];
  if (amount > 0 && rate > 0 && duration > 0) {
    insights.push(`At ${rate}% APR, you're paying ${interestPct}% extra over the loan term. Consider negotiating a lower rate.`);
    insights.push(
      totalInterest > amount * 0.3
        ? "Your total interest exceeds 30% of the principal — this is an expensive loan. Shop around for better rates."
        : "Your interest-to-principal ratio is within reasonable bounds for this rate."
    );
    insights.push(`Monthly EMI of ${formatCurrency(emi, currencyCode)} represents ${((emi / (amount / duration)) * 100 - 100).toFixed(0)}% more than a zero-interest payment would be.`);
  }
  insights.push(
    uniqueHiddenFees.length >= 3
      ? "Multiple fee types detected. Request a complete fee schedule and compare with competitors."
      : "Fee structure appears manageable, but always confirm all charges before signing."
  );

  const deception = detectDeception(text);
  const advice = generateAdvice(riskScore, rate, totalInterest, amount, uniqueHiddenFees);

  return {
    summary,
    hiddenFees: uniqueHiddenFees,
    warnings: uniqueWarnings,
    riskScore,
    insights,
    emi,
    totalPayment,
    totalInterest,
    principal: amount,
    currencyCode,
    deception,
    advice,
    rawText: text,
  };
}
