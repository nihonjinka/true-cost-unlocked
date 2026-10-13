import { z } from "zod";
import rawAnalysisRules from "@/data/analysisRules.json";
import rawExtractionRules from "@/data/extractionRules.json";
import rawScheduleRules from "@/data/scheduleRules.json";

const nonempty = z.string().min(1);
const probability = z.number().finite().min(0).max(1);
const band = z.enum(["low", "caution", "high", "critical"]);
const severity = z.enum(["low", "medium", "high", "critical"]);
const polarity = z.enum(["asserted", "conditional", "negated", "waived/zero", "hypothetical"]);
const numericRecord = z.record(z.number().finite());
const categoryRule = z.object({ id: nonempty, category: nonempty, severity: z.number().int().min(0).max(5),
  minimumRiskBand: band.optional(), polarityOverride: polarity.optional() }).passthrough();
const periodRole = z.enum(["term", "trial_promo", "grace", "cancellation", "notice", "cure", "unclassified"]);
const periodRule = z.object({ role: periodRole, pattern: nonempty, priority: z.number().finite() });
const unit = z.enum(["day", "week", "fortnight", "month", "year"]);

export const riskScoringSchema = z.object({
  weights: z.object({ critical: probability, high: probability, medium: probability, low: probability }),
  bands: z.object({ low: z.literal(0), caution: z.number().min(0).max(100), high: z.number().min(0).max(100), critical: z.number().min(0).max(100) }),
  repeatedFindingFactor: probability,
  disclosedCostCategories: z.array(nonempty),
  disclosedCostSeverity: severity,
  protectionDeductionWeight: probability,
  benchmarkFloatingLowRiskPattern: z.string(),
}).superRefine((value, context) => {
  if (!(value.bands.low < value.bands.caution && value.bands.caution < value.bands.high && value.bands.high < value.bands.critical)) {
    context.addIssue({ code: "custom", path: ["bands"], message: "Risk thresholds must increase from low to critical." });
  }
  if (!(value.weights.low <= value.weights.medium && value.weights.medium <= value.weights.high && value.weights.high <= value.weights.critical)) {
    context.addIssue({ code: "custom", path: ["weights"], message: "Risk weights must not decrease with severity." });
  }
});

export const analysisConfigSchema = z.object({
  riskScoring: riskScoringSchema,
  analysisConfidenceThreshold: probability,
  feeCatalog: z.array(categoryRule.extend({ label: nonempty, patterns: z.array(nonempty).min(1), explanation: nonempty })),
  riskRules: z.array(categoryRule.extend({ pattern: z.string(), weight: z.number().nonnegative() })),
  conceptSlots: z.array(categoryRule.extend({ label: nonempty, explanation: nonempty, windowWords: z.number().int().positive(), slots: z.record(z.array(nonempty).min(1)) })),
  unquantifiedTerms: z.array(categoryRule.extend({ label: nonempty, pattern: nonempty })),
  listCategories: z.array(z.object({ id: nonempty, category: nonempty, labelPattern: nonempty })),
  categoryGlossary: z.array(z.object({ category: nonempty, term: nonempty, definition: nonempty })),
  principalLabels: z.array(z.object({ id: nonempty, pattern: nonempty, score: z.number().finite(), kind: z.enum(["principal", "price", "exclude"]), position: z.enum(["before", "after"]).optional() })),
  documentTypes: z.array(z.object({ id: nonempty, label: nonempty, signals: z.array(z.object({ pattern: nonempty, weight: z.number().finite() })).min(1) })),
  protectionCatalog: z.array(z.object({ id: nonempty, label: nonempty, pattern: nonempty, explanation: nonempty, acceptedPolarities: z.array(polarity).min(1) }).passthrough()),
  rateRoleRules: z.array(z.object({ role: z.enum(["base", "purchase", "cash_advance", "balance_transfer", "promotional", "penalty", "tax", "fee_percent", "discount", "cap"]), pattern: nonempty })),
  periodRoles: z.object({ units: nonempty, unitMonths: numericRecord, numberWords: numericRecord, contextCharacters: z.number().positive(), roles: z.array(periodRule), explicitTermPattern: nonempty,
    derivedSchedule: z.object({ suppressRoles: z.array(periodRole) }) }).passthrough(),
  numericCandidateRoles: z.object({ contextCharacters: z.number().positive(), roleWeights: z.object({ money: z.number(), count: z.number(), time: z.number(), rate: z.number(), margin: z.number(), penalty: z.number(), promotional: z.number(), feePercent: z.number(), fee: z.number() }) }).passthrough(),
  constraintResolution: z.object({ paymentTolerance: probability, totalTolerance: probability, maxCandidatesPerField: z.number().int().positive() }).passthrough(),
  calculatorRegistry: z.object({ default: nonempty, documentTypes: z.record(nonempty) }).passthrough(),
  calculatorInputs: z.record(z.array(nonempty)),
  plausibility: z.object({ confidenceCap: probability }).passthrough(),
}).passthrough();

export const extractionConfigSchema = z.object({
  moneyLabelPattern: nonempty, quantitySuffixPattern: nonempty, percentSuffixPattern: nonempty,
  paymentLabelPattern: nonempty, paymentExcludedLabelPattern: nonempty,
  rateContextDistance: z.number().positive(), labelContextDistance: z.number().positive(), maximumLabelCharacters: z.number().positive(),
  rangeConfidence: probability, paymentConfidence: probability,
}).passthrough();

export const scheduleConfigSchema = z.object({
  numberWords: numericRecord, numberScales: numericRecord,
  units: z.array(z.object({ unit, pattern: nonempty, months: z.number().positive(), periodsPerYear: z.number().positive() })).min(1),
  frequencies: z.array(z.object({ pattern: nonempty, unit, interval: z.number().positive() })),
  nonTermDurationRoles: z.array(periodRule),
  maximumCount: z.number().int().positive(), maximumClauseCharacters: z.number().positive(), maximumFrequencyDistance: z.number().positive(),
  countRoundingTolerance: probability, totalRelativeTolerance: probability,
}).passthrough();

/** Fail at the exact config path instead of silently disabling a detector. */
export function validateConfigPatterns(value: unknown, path = "config"): void {
  const patterns = new Set(["negators", "scopeBreaks", "countUnits", "timeUnits", "units"]);
  const visit = (node: unknown, current: string, pattern = false) => {
    if (typeof node === "string" && pattern) {
      const groups = Array.from(node.matchAll(/\(\?<([A-Za-z_]\w*)>/g), (match) => match[1]);
      if (new Set(groups).size !== groups.length) throw new Error(`${current}: named regex groups must be unique for browser compatibility.`);
      try { new RegExp(node.replace(/\{\{[A-Z_]+\}\}/g, "(?:x)"), "i"); }
      catch (error) { throw new Error(`${current}: invalid regular expression (${error instanceof Error ? error.message : String(error)}).`); }
    } else if (Array.isArray(node)) {
      // Protection variants intentionally share a concept ID with disjoint polarities.
      const ids = node.flatMap((entry) => entry && typeof entry === "object" && typeof entry.id === "string"
        ? [entry.id + (Array.isArray(entry.acceptedPolarities) ? `:${[...entry.acceptedPolarities].sort().join(",")}` : "")] : []);
      if (new Set(ids).size !== ids.length) throw new Error(`${current}: duplicate rule IDs.`);
      node.forEach((entry, index) => visit(entry, `${current}[${index}]`, pattern));
    } else if (node && typeof node === "object") {
      Object.entries(node).forEach(([key, entry]) => visit(entry, `${current}.${key}`, /patterns?$/i.test(key) || patterns.has(key)));
    }
  };
  visit(value, path);
}

export function validateAnalysisConfig(value: unknown): void {
  const parsed = analysisConfigSchema.parse(value);
  validateConfigPatterns(value, "analysisRules");
  const glossary = new Set(parsed.categoryGlossary.map((entry) => entry.category));
  if (glossary.size !== parsed.categoryGlossary.length) throw new Error("analysisRules.categoryGlossary: duplicate categories.");
  const categories = new Set([...parsed.feeCatalog, ...parsed.riskRules, ...parsed.conceptSlots, ...parsed.unquantifiedTerms, ...parsed.listCategories].map((entry) => entry.category));
  categories.add("protection");
  categories.add("conditional_term");
  categories.add("mismatch");
  for (const category of categories) if (!glossary.has(category)) throw new Error(`analysisRules.categoryGlossary: missing category '${category}'.`);
  for (const type of parsed.documentTypes) {
    const calculator = parsed.calculatorRegistry.documentTypes[type.id];
    if (!calculator || !parsed.calculatorInputs[calculator]) throw new Error(`analysisRules.calculatorRegistry: no calculator inputs for '${type.id}'.`);
  }
}

validateAnalysisConfig(rawAnalysisRules);
extractionConfigSchema.parse(rawExtractionRules);
validateConfigPatterns(rawExtractionRules, "extractionRules");
scheduleConfigSchema.parse(rawScheduleRules);
validateConfigPatterns(rawScheduleRules, "scheduleRules");

// Preserve the complete JSON-inferred shape, including optional extension catalogs.
export const analysisRules = rawAnalysisRules;
export const extractionRules = rawExtractionRules;
export const scheduleRules = rawScheduleRules;
export type ValidatedRiskScoringConfig = z.infer<typeof riskScoringSchema>;
