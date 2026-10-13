import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { evaluationRules as config, evaluationFields as FIELDS, evaluationFieldValue as fieldValue, evaluationFieldConfidence as fieldConfidence, evaluationMatches as isMatch, type EvaluationField as Field, type EvaluationCase } from "@/lib/evaluation";
import { analyzeLocally } from "@/lib/analyzeLocally";

interface Measurement { checked: number; correct: number; confidentlyWrong: number }
const devCases = JSON.parse(readFileSync(join(process.cwd(), "tests/dev/regression.json"), "utf8")) as EvaluationCase[];

function loadHeldoutCases(): EvaluationCase[] {
  const directory = join(process.cwd(), "tests/heldout");
  if (!existsSync(directory)) return [];
  return readdirSync(directory).filter((filename) => filename.toLowerCase().endsWith(".json"))
    .flatMap((filename) => {
      const parsed: unknown = JSON.parse(readFileSync(join(directory, filename), "utf8"));
      return Array.isArray(parsed) ? parsed as EvaluationCase[] : [parsed as EvaluationCase];
    });
}

function measure(cases: EvaluationCase[]) {
  const metrics = Object.fromEntries(FIELDS.map((field) => [field, { checked: 0, correct: 0, confidentlyWrong: 0 }])) as Record<Field, Measurement>;
  const mismatches: string[] = [];
  for (const sample of cases) {
    const result = analyzeLocally(sample.text);
    for (const field of FIELDS) {
      if (!(field in sample.expected)) continue;
      const actual = fieldValue(field, result);
      const expected = sample.expected[field] ?? null;
      const item = metrics[field];
      item.checked += 1;
      if (isMatch(field, actual, expected)) item.correct += 1;
      else {
        mismatches.push(`${sample.name} · ${field}: expected ${String(expected)}, got ${String(actual)} (${Math.round(fieldConfidence(field, result) * 100)}% confidence)`);
        if (fieldConfidence(field, result) >= config.confidentWrongThreshold) item.confidentlyWrong += 1;
      }
    }
  }
  return { metrics, mismatches, confidentlyWrong: Object.values(metrics).reduce((sum, item) => sum + item.confidentlyWrong, 0) };
}

function report(title: string, cases: EvaluationCase[]) {
  const result = measure(cases);
  console.log(`\n${title} evaluation (${cases.length} documents)`);
  if (!cases.length) { console.log("NOT EVALUATED: owner documents have not been supplied."); return result; }
  for (const field of FIELDS) {
    const metric = result.metrics[field];
    if (!metric.checked) continue;
    const accuracy = metric.checked ? Math.round(metric.correct / metric.checked * 100) : 100;
    console.log(`${field.padEnd(8)} ${metric.correct}/${metric.checked} (${accuracy}%) · confidently wrong ${metric.confidentlyWrong}`);
  }
  console.log(`Confidently wrong total: ${result.confidentlyWrong}`);
  result.mismatches.forEach((message) => console.log(`  ${message}`));
  return result;
}

describe("Round 8 evaluation harness", () => {
  it("prints per-field dev and held-out accuracy and fails on dev regression or confidently-wrong fields", () => {
    const dev = report("DEV", devCases);
    const heldout = report("HELD-OUT", loadHeldoutCases());
    expect(dev.mismatches, "Dev regression detected").toEqual([]);
    expect(dev.confidentlyWrong + heldout.confidentlyWrong, "A confidently-wrong field was emitted").toBe(0);
  });

  it("keeps scam signals above disclosed products without document-type priors", () => {
    const calibration = [
      { name: "clean", text: "PERSONAL LOAN AGREEMENT\nPrincipal: $10,000.\nAPR: 8%.\nTerm: 36 months.\nNo fees." },
      { name: "card", text: "CREDIT CARD AGREEMENT\nRevolving credit. APR: 19.9% per year." },
      { name: "unilateral loan", text: "PERSONAL LOAN AGREEMENT\nPrincipal: $10,000.\nAPR: 9%.\nTerm: 36 months.\nThe lender may, in its sole discretion, increase the APR." },
      { name: "MCA", text: "MERCHANT CASH ADVANCE AGREEMENT\nAdvance amount: $24,000.\nPurchased amount: $30,000.\nDaily remittance: $250 from receivables.\nThe owner personally guarantees all obligations. The borrower consents to confession of judgment." },
      { name: "scam", text: "100% guaranteed approval. Pay a $350 processing deposit by gift card to release the loan." },
    ].map((sample) => ({ ...sample, analysis: analyzeLocally(sample.text) }));
    console.log(`\nCalibration scores: baseline [clean=${calibration[0].analysis.riskScore}, card=${calibration[1].analysis.riskScore}], unilateral=${calibration[2].analysis.riskScore} < MCA=${calibration[3].analysis.riskScore} < scam=${calibration[4].analysis.riskScore}`);
    expect(calibration[2].analysis.riskScore).toBeGreaterThan(calibration[1].analysis.riskScore);
    expect(calibration[3].analysis.riskScore).toBeGreaterThan(calibration[2].analysis.riskScore);
    expect(calibration[4].analysis.riskScore).toBeGreaterThan(calibration[2].analysis.riskScore);
    expect(calibration[3].analysis.riskScore).toBeLessThan(calibration[4].analysis.riskScore);
    const highRiskStack = analyzeLocally("A confession of judgment is required. The borrower also provides a personal guaranty.");
    expect(highRiskStack.riskScore).toBeGreaterThanOrEqual(80);
    expect(highRiskStack.riskScore).toBeLessThanOrEqual(100);
  });
});

