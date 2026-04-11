import { calculateEMI } from "./financial";
import type { AnalysisResult } from "@/components/AnalysisDashboard";

// Client-side analysis fallback (no AI needed)
export function analyzeLocally(text: string, amount: number, rate: number, duration: number): AnalysisResult {
  const { emi, totalPayment, totalInterest } = calculateEMI(amount, rate, duration);
  const lower = text.toLowerCase();

  const hiddenFees: string[] = [];
  const warnings: string[] = [];
  let riskScore = 20;

  // Fee detection
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

  // Warning detection
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
  };
}
