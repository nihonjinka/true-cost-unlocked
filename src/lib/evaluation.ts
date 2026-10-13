import rules from "../data/evaluationRules.json";
import type { AnalysisContext } from "./analysisContext";

export type EvaluationField = "principal" | "rate" | "term" | "payment" | "docType" | "band";
export interface EvaluationCase { name: string; text: string; expected: Partial<Record<EvaluationField, number | string | null>> }
export const evaluationFields: EvaluationField[] = ["principal", "rate", "term", "payment", "docType", "band"];
export const evaluationRules = rules;

export function evaluationFieldValue(field: EvaluationField, context: AnalysisContext): number | string | null {
  if (field === "principal") return context.principalField.value;
  if (field === "rate") return context.rateField.value;
  if (field === "term") return context.termField.value;
  if (field === "payment") return context.statedEMI.value ?? context.installmentSchedule?.amount ?? null;
  if (field === "docType") return context.docType.type;
  return context.riskBand;
}

export function evaluationFieldConfidence(field: EvaluationField, context: AnalysisContext): number {
  if (field === "principal") return context.principalField.needsReview ? 0 : context.principalField.confidence;
  if (field === "rate") return context.rateField.needsReview ? 0 : context.rateField.confidence;
  if (field === "term") return context.termField.needsReview ? 0 : context.termField.confidence;
  if (field === "payment") return context.statedEMI.value !== null ? context.statedEMI.confidence : context.installmentSchedule ? 0.85 : 0;
  if (field === "docType") return context.docType.confidence;
  return context.confidence;
}

export function evaluationMatches(field: EvaluationField, actual: number | string | null, expected: number | string | null): boolean {
  if (typeof expected !== "number") return actual === expected;
  if (typeof actual !== "number" || !Number.isFinite(actual)) return false;
  const tolerance = rules.tolerances[field as keyof typeof rules.tolerances];
  return Math.abs(actual - expected) <= Math.max(tolerance?.absolute ?? 0, Math.abs(expected) * (tolerance?.relative ?? 0)) + Number.EPSILON * Math.max(1, Math.abs(expected));
}

export function textSimilarity(original: string, extracted: string): number {
  const normalize = (text: string) => text.normalize("NFKC").replace(/[“”]/g, '"').replace(/[‘’]/g, "'").replace(/\s+/g, " ").trim();
  const left = normalize(original), right = normalize(extracted);
  if (!left.length && !right.length) return 1;
  // Linear memory Levenshtein: inserted/missing content counts against accuracy.
  let previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let i = 1; i <= left.length; i++) {
    const current = [i];
    for (let j = 1; j <= right.length; j++) current[j] = Math.min(current[j - 1] + 1, previous[j] + 1, previous[j - 1] + (left[i - 1] === right[j - 1] ? 0 : 1));
    previous = current;
  }
  return 1 - previous[right.length] / Math.max(left.length, right.length);
}
