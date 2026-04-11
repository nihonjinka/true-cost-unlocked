import { calculateEMI } from "./financial";
import type { AnalysisResult } from "@/components/AnalysisDashboard";
import type { DeceptionResult } from "@/components/DeceptionDetector";
import type { AdviceResult } from "@/components/SmartAdvice";

export function detectDeception(text: string): DeceptionResult {
  const lower = text.toLowerCase();
  const urgencyTactics: string[] = [];
  const fakeDiscounts: string[] = [];
  const emotionalManipulation: string[] = [];

  if (/act\s*now/i.test(text)) urgencyTactics.push("\"Act Now\" pressure language detected — creates false urgency.");
  if (/limited\s*time/i.test(text)) urgencyTactics.push("\"Limited Time\" framing — may pressure hasty decisions.");
  if (/won'?t\s*last/i.test(text)) urgencyTactics.push("\"Won't last\" scarcity tactic detected.");
  if (/hurry/i.test(text)) urgencyTactics.push("\"Hurry\" urgency language found.");
  if (/expire/i.test(text) && /soon/i.test(text)) urgencyTactics.push("Expiry pressure — implies you must act immediately.");

  if (/save\s*up\s*to\s*\d+%/i.test(text)) fakeDiscounts.push("\"Save up to X%\" — discount may be calculated against inflated baseline.");
  if (/compared\s*to/i.test(text) && /tier|rate|plan/i.test(text)) fakeDiscounts.push("Discount compared to a higher internal tier — may not reflect real market rates.");
  if (/was\s*\$[\d,]+.*now\s*\$[\d,]+/i.test(text)) fakeDiscounts.push("Crossed-out price pattern — verify the original price is genuine.");

  if (/once[\s-]*in[\s-]*a[\s-]*lifetime/i.test(text)) emotionalManipulation.push("\"Once in a lifetime\" — emotional exaggeration to override rational analysis.");
  if (/don'?t\s*miss\s*out/i.test(text)) emotionalManipulation.push("\"Don't miss out\" — FOMO (fear of missing out) tactic.");
  if (/exclusive/i.test(text) && (/offer|rate|deal/i.test(text))) emotionalManipulation.push("\"Exclusive\" framing — makes offer seem special when it may be standard.");
  if (/you\s*deserve/i.test(text)) emotionalManipulation.push("\"You deserve\" — emotional appeal bypassing financial analysis.");

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
  else reasons.push(`Interest rate of ${rate}% is competitive.`);

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

// Client-side analysis (no AI needed)
export function analyzeLocally(text: string, amount: number, rate: number, duration: number): AnalysisResult & { deception: DeceptionResult; advice: AdviceResult } {
  const { emi, totalPayment, totalInterest } = calculateEMI(amount, rate, duration);
  const lower = text.toLowerCase();

  const hiddenFees: string[] = [];
  const warnings: string[] = [];
  let riskScore = 20;

  const feePatterns: [RegExp, string][] = [
    [/annual\s*fee[:\s]*\$?([\d,.]+)/i, "Annual Fee detected"],
    [/balance\s*transfer\s*fee[:\s]*(\d+%)/i, "Balance Transfer Fee"],
    [/cash\s*advance\s*fee[:\s]*(\d+%)/i, "Cash Advance Fee"],
    [/foreign\s*transaction\s*fee[:\s]*(\d+%)/i, "Foreign Transaction Fee"],
    [/late\s*payment\s*fee[:\s]*(?:up\s*to\s*)?\$?([\d,.]+)/i, "Late Payment Fee"],
    [/returned\s*payment\s*fee[:\s]*(?:up\s*to\s*)?\$?([\d,.]+)/i, "Returned Payment Fee"],
    [/prepayment\s*(?:penalty|fee)/i, "Prepayment Penalty"],
    [/origination\s*fee/i, "Origination Fee"],
    [/processing\s*fee/i, "Processing Fee"],
  ];

  for (const [pattern, label] of feePatterns) {
    const match = text.match(pattern);
    if (match) {
      hiddenFees.push(`${label}: ${match[0].trim()}`);
      riskScore += 8;
    }
  }

  if (lower.includes("penalty apr")) {
    warnings.push("Penalty APR clause found — your rate could increase significantly after a missed payment.");
    riskScore += 15;
  }
  if (lower.includes("variable") && lower.includes("prime rate")) {
    warnings.push("Variable rate tied to Prime Rate — your payments could increase when interest rates rise.");
    riskScore += 10;
  }
  if (lower.includes("change the terms") || lower.includes("modify terms")) {
    warnings.push("Lender reserves the right to change terms — read carefully for conditions.");
    riskScore += 12;
  }
  if (lower.includes("minimum payment")) {
    warnings.push("Minimum payment clause — paying only minimums will cost you significantly more in interest.");
    riskScore += 5;
  }
  if (lower.includes("introductory") || lower.includes("promotional")) {
    warnings.push("Promotional/introductory rate present — be aware of the rate after the promo period ends.");
    riskScore += 5;
  }
  if (lower.includes("indefinitely")) {
    warnings.push("Penalty terms may apply indefinitely — this is an aggressive clause.");
    riskScore += 10;
  }
  if (rate > 20) {
    warnings.push(`High interest rate of ${rate}% — significantly above average market rates.`);
    riskScore += 10;
  }

  riskScore = Math.min(riskScore, 100);

  const interestPct = amount > 0 ? ((totalInterest / amount) * 100).toFixed(1) : "0";

  const summary = `This agreement involves a loan/credit of $${amount.toLocaleString()} at ${rate}% annual interest over ${duration} months. ` +
    `Your monthly payment would be $${emi.toFixed(2)}, totaling $${totalPayment.toFixed(2)} — meaning you'd pay $${totalInterest.toFixed(2)} (${interestPct}%) in interest alone. ` +
    `${hiddenFees.length > 0 ? `We detected ${hiddenFees.length} fee(s) that could increase your actual cost.` : "No significant hidden fees were detected."} ` +
    `${riskScore >= 60 ? "This agreement carries HIGH risk — proceed with caution." : riskScore >= 30 ? "This agreement has moderate risk factors to be aware of." : "This agreement appears relatively straightforward."}`;

  const insights = [
    `At ${rate}% APR, you're paying ${interestPct}% extra over the loan term. Consider negotiating a lower rate.`,
    totalInterest > amount * 0.3
      ? "Your total interest exceeds 30% of the principal — this is an expensive loan. Shop around for better rates."
      : "Your interest-to-principal ratio is within reasonable bounds for this rate.",
    hiddenFees.length >= 3
      ? "Multiple fee types detected. Request a complete fee schedule and compare with competitors."
      : "Fee structure appears manageable, but always confirm all charges before signing.",
    `Monthly EMI of $${emi.toFixed(2)} represents ${((emi / (amount / duration)) * 100 - 100).toFixed(0)}% more than a zero-interest payment would be.`,
  ];

  const deception = detectDeception(text);
  const advice = generateAdvice(riskScore, rate, totalInterest, amount, hiddenFees);

  return {
    summary,
    hiddenFees,
    warnings,
    riskScore,
    insights,
    emi,
    totalPayment,
    totalInterest,
    principal: amount,
    deception,
    advice,
  };
}
