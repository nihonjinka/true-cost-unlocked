import rules from "@/data/analysisRules.json";
import type { CostFinding, RiskBand, RiskBreakdownItem } from "./analysisContext";

export type { RiskBand } from "./analysisContext";
export type RiskSeverity = "low" | "medium" | "high" | "critical";
export interface RiskScoringConfig {
  weights: Record<RiskSeverity, number>;
  bands: Record<RiskBand, number>;
  repeatedFindingFactor?: number;
  disclosedCostCategories?: string[];
  disclosedCostSeverity?: RiskSeverity;
  protectionDeductionWeight?: number;
  benchmarkFloatingLowRiskPattern?: string;
}

type ScoredFinding = CostFinding & { minimumRiskBand?: RiskBand; mergedRuleIds?: string[] };
const catalog = rules as unknown as {
  riskScoring: RiskScoringConfig;
  feeCatalog: Array<{ id: string; minimumRiskBand?: RiskBand }>;
  riskRules: Array<{ id: string; minimumRiskBand?: RiskBand }>;
};

function severityName(severity: number): RiskSeverity {
  return severity >= 5 ? "critical" : severity >= 4 ? "high" : severity >= 2 ? "medium" : "low";
}

export function riskBandForScore(score: number, settings = catalog.riskScoring): RiskBand {
  const bands = Object.entries(settings.bands) as Array<[RiskBand, number]>;
  return bands.sort((left, right) => right[1] - left[1]).find(([, threshold]) => score >= threshold)?.[0] ?? "low";
}

function clauseKey(finding: CostFinding): string {
  const span = finding.clauseSpan;
  if (span && span[1] > span[0]) return `${span[0]}:${span[1]}`;
  return `${finding.position}:${(finding.evidence || finding.source).trim().replace(/\s+/g, " ")}`;
}

/** Each original clause contributes once, using its strongest catalog finding. */
export function scoreRiskFindings(findings: readonly CostFinding[], settings = catalog.riskScoring): {
  score: number;
  band: RiskBand;
  breakdown: RiskBreakdownItem[];
  combinedScore: number;
  floor: RiskBand | null;
} {
  const clauses = new Map<string, { finding: ScoredFinding; labels: Set<string>; floor: RiskBand | null }>();
  const strongestFloor = (left: RiskBand | null, right: RiskBand | null): RiskBand | null =>
    right && (!left || settings.bands[right] > settings.bands[left]) ? right : left;
  const effectiveSeverity = (finding: CostFinding): RiskSeverity => {
    const disclosed = (finding.amount !== null || finding.totalImpact !== null)
      && (settings.disclosedCostCategories ?? []).includes(finding.category);
    const benchmarkWithChoice = finding.category === "variable_rate" && Boolean(settings.benchmarkFloatingLowRiskPattern
      && new RegExp(settings.benchmarkFloatingLowRiskPattern, "i").test(finding.evidence || finding.source));
    return disclosed || benchmarkWithChoice ? settings.disclosedCostSeverity ?? "low" : severityName(finding.severity);
  };
  for (const finding of findings as readonly ScoredFinding[]) {
    if (finding.category === "protection" || finding.category === "conditional_term" || finding.negated || finding.severity <= 0
      || finding.polarity === "hypothetical" || finding.polarity === "negated" || finding.polarity === "waived/zero") continue;
    const matchingIds = new Set([finding.id, finding.topicId, ...(finding.riskRuleIds ?? []), ...(finding.mergedRuleIds ?? [])]);
    let floor = finding.minimumRiskBand ?? null;
    for (const entry of [...catalog.feeCatalog, ...catalog.riskRules]) {
      if (matchingIds.has(entry.id)) floor = strongestFloor(floor, entry.minimumRiskBand ?? null);
    }
    const key = clauseKey(finding);
    const existing = clauses.get(key);
    if (!existing) clauses.set(key, { finding, floor, labels: new Set([finding.label]) });
    else {
      existing.labels.add(finding.label);
      existing.floor = strongestFloor(existing.floor, floor);
      if (settings.weights[effectiveSeverity(finding)] > settings.weights[effectiveSeverity(existing.finding)]) existing.finding = finding;
    }
  }
  let complement = 1;
  let minimumBand: RiskBand | null = null;
  const breakdown: RiskBreakdownItem[] = [];
  const repeatedCounts: Record<RiskSeverity, number> = { critical: 0, high: 0, medium: 0, low: 0 };
  const protectionClauses = new Set(findings.filter((finding) => finding.category === "protection"
    && finding.polarity !== "hypothetical").map(clauseKey));
  for (const { finding, labels, floor } of [...clauses.values()].sort((left, right) => left.finding.position - right.finding.position)) {
    const severity = effectiveSeverity(finding);
    const baseWeight = Math.min(1, Math.max(0, settings.weights[severity]));
    const repeatFactor = Math.pow(settings.repeatedFindingFactor ?? 1, repeatedCounts[severity]++);
    const weight = baseWeight * repeatFactor;
    complement *= 1 - weight;
    minimumBand = strongestFloor(minimumBand, floor);
    breakdown.push({
      category: finding.category,
      points: weight * 100,
      reasons: [...labels, ...(floor ? [`Minimum risk band: ${floor}.`] : [])],
      weight,
      baseWeight,
      repeatFactor,
      findingId: finding.id,
      evidence: finding.evidence || finding.source,
      combinedScore: 100 * (1 - complement),
    });
  }
  const combinedScore = 100 * (1 - complement);
  const protectedAmount = protectionClauses.size * Math.max(0, settings.protectionDeductionWeight ?? 0);
  const protectedScore = Math.max(0, combinedScore - protectedAmount * 100);
  // Protection credits reduce the score, while explicit catalog severity floors
  // remain binding even when a document also contains many protective clauses.
  const score = Math.max(0, Math.min(100, Math.max(protectedScore, minimumBand ? settings.bands[minimumBand] : 0)));
  const appliedCredit = combinedScore - protectedScore;
  if (appliedCredit > 0) breakdown.push({ category: "protection_credit", points: -appliedCredit,
    reasons: [`${protectionClauses.size} stated protection${protectionClauses.size === 1 ? "" : "s"} × ${Math.round((settings.protectionDeductionWeight ?? 0) * 100)}% deduction.`],
    weight: -appliedCredit / 100, baseWeight: -(settings.protectionDeductionWeight ?? 0), repeatFactor: 1,
    findingId: "protection_credit", combinedScore: protectedScore });
  if (score > protectedScore) breakdown.push({ category: "severity_floor", points: score - protectedScore,
    reasons: [`Catalog minimum band: ${minimumBand}.`], findingId: "severity_floor", combinedScore: score });
  return { score, band: riskBandForScore(score, settings), breakdown, combinedScore, floor: minimumBand };
}
