import { describe, expect, it } from "vitest";
import { analysisRules, validateAnalysisConfig, validateConfigPatterns } from "@/lib/validatedConfig";

describe("catalog validation", () => {
  it("validates shipped catalogs and every configured finding category's glossary", () => {
    expect(() => validateAnalysisConfig(analysisRules)).not.toThrow();
  });

  it("rejects invalid severity weights and reversed score thresholds", () => {
    for (const scoring of [
      { ...analysisRules.riskScoring, weights: { ...analysisRules.riskScoring.weights, high: 1.2 } },
      { ...analysisRules.riskScoring, bands: { ...analysisRules.riskScoring.bands, high: 75 } },
      { ...analysisRules.riskScoring, weights: { ...analysisRules.riskScoring.weights, low: 0.8 } },
    ]) expect(() => validateAnalysisConfig({ ...analysisRules, riskScoring: scoring })).toThrow();
  });

  it("rejects duplicate IDs within a catalog while allowing shared concepts across catalogs", () => {
    expect(() => validateAnalysisConfig({ ...analysisRules, feeCatalog: [...analysisRules.feeCatalog, analysisRules.feeCatalog[0]] })).toThrow(/duplicate rule IDs/);
    expect(() => validateConfigPatterns({ fees: [{ id: "same", pattern: "fee" }], concepts: [{ id: "same", pattern: "charge" }] })).not.toThrow();
  });

  it("identifies malformed patterns and browser-incompatible named capture duplication", () => {
    expect(() => validateConfigPatterns({ fees: [{ id: "broken", patterns: ["["] }] })).toThrow(/config.fees\[0\].patterns\[0\]/);
    expect(() => validateConfigPatterns({ resetPattern: "(?<months>1)|(?<months>2)" })).toThrow(/unique/);
  });

  it("rejects missing glossary definitions and unmapped product calculators", () => {
    expect(() => validateAnalysisConfig({ ...analysisRules, categoryGlossary: analysisRules.categoryGlossary.filter((entry) => entry.category !== "guaranty") })).toThrow(/missing category 'guaranty'/);
    expect(() => validateAnalysisConfig({ ...analysisRules, calculatorInputs: {} })).toThrow(/calculator inputs/);
  });
});
