import { afterEach, describe, expect, it, vi } from "vitest";
import type { AnalysisContext, AnalysisFinding } from "@/lib/analysisContext";
import { analyzeLocally } from "@/lib/analyzeLocally";
import { buildAIContext, enhanceAnalysisWithAI, hasActionableFindings, NO_NEGOTIATION_ISSUES, regenerateCounterOfferEmail, validateAIEnhancement } from "@/lib/analyzeWithAI";

function finding(overrides: Partial<AnalysisFinding> = {}): AnalysisFinding {
  return {
    id: "data_sharing", label: "Data-sharing permission", category: "privacy", severity: 3,
    polarity: "asserted", clauseSpan: [0, 53], evidence: "The lender may share personal data with its partners.",
    provenance: "stated-in-document", amount: null, percent: null, basis: null, frequency: null,
    conditions: [], source: "The lender may share personal data with its partners.", position: 0,
    explanation: "Personal information can be shared.", totalImpact: null, negated: false,
    ...overrides,
  };
}

function context(actionable = false): AnalysisContext {
  const base = analyzeLocally("Personal loan amount: $12,000. Fixed APR: 6%. Repayment term: 24 months.");
  const protection = finding({
    id: "no_processing", label: "No processing fee", category: "protection", severity: 0,
    polarity: "negated", amount: 0, evidence: "We do not charge any processing fee.", source: "We do not charge any processing fee.",
  });
  return { ...base, rawText: `${base.rawText}\nPRIVATE UNRELATED DOCUMENT CONTENT`, findings: actionable ? [finding(), protection] : [protection], protections: [protection] };
}

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe("Round-four AI grounding", () => {
  it("sends structured facts with provenance, filtered findings and protections without raw document text", () => {
    const result = buildAIContext(context());
    expect(JSON.stringify(result)).not.toContain("PRIVATE UNRELATED");
    expect(result).not.toHaveProperty("rawText");
    expect(result.findings).toHaveLength(0);
    expect(result.protections).toHaveLength(1);
    expect(result.facts.every((fact) => ["stated-in-document", "computed", "derived", "assumed"].includes(fact.provenance))).toBe(true);
    expect(result.facts.find((fact) => fact.name === "cost breakdown financing cost")?.provenance).toBe("computed");
    expect(result.unresolvedFields).toEqual([]);
  });

  it("strips unsupported numbers, invented quotations, false contradictions and computed-as-stated claims", () => {
    const result = validateAIEnhancement(context(), {
      aiInsights: [
        "The loan principal is $12,000.",
        "You owe an extra $9,876 fee.",
        'The agreement says "You must surrender your passport".',
        "The agreement contains binding arbitration.",
        "The fixed rate contradicts the reducing calculation basis.",
        "The financing cost is explicitly stated in the document.",
      ],
    });
    expect(result.aiInsights).toEqual(["The loan principal is $12,000."]);
  });

  it("labels manual values as assumptions without inventing document evidence", () => {
    const baseline = context();
    const result = buildAIContext({ ...baseline, principalField: { ...baseline.principalField, source: "User override" } });
    const principal = result.facts.find((fact) => fact.name === "principal loan amount");
    expect(principal?.provenance).toBe("assumed");
    expect(principal).not.toHaveProperty("evidence");
    const manual = { ...baseline, principalField: { ...baseline.principalField, value: 9321, source: "User override" } };
    expect(validateAIEnhancement(manual, { aiInsights: ["The document states loan amount is $9,321."] }).aiInsights).toEqual([]);
  });

  it("carries unresolved currency/basis and separates modeled impacts from stated evidence", () => {
    const baseline = context(true);
    const result = buildAIContext({ ...baseline, currency: null, rateField: { ...baseline.rateField, basisAssumption: "Reducing basis assumed" }, findings: [finding({ amount: 25, totalImpact: 100 })] });
    expect(result.unresolvedFields).toEqual(expect.arrayContaining(["currency", "rate calculation basis"]));
    expect(result.facts.find((fact) => fact.name === "currency")?.provenance).toBe("assumed");
    expect(result.findings[0].computedTotalImpact).toEqual({ value: 100, provenance: "computed" });
    expect(result.findings[0]).not.toHaveProperty("totalImpact");
  });

  it("keeps merged clause fee facts grounded for supplemental AI without splitting the canonical finding", () => {
    const result = analyzeLocally("Loan amount: $5000. APR: 8%. Term: 24 months. A processing fee of $200 and an origination fee of 3% of principal apply.");
    const clauseFindings = result.findings.filter((item) => item.evidence.includes("processing fee"));
    expect(clauseFindings).toHaveLength(1);
    const grounded = buildAIContext(result).findings.find((item) => item.evidence.includes("processing fee"));
    expect(grounded?.components?.map((item) => item.id)).toEqual(expect.arrayContaining(["processing", "origination"]));
    expect(grounded?.components?.find((item) => item.id === "origination")?.computedTotalImpact).toEqual({ value: 150, provenance: "computed" });
    expect(validateAIEnhancement(result, {
      aiInsights: ["The processing fee is $200 and the origination fee has a computed impact of $150."],
      aiNegotiationStrategies: ["Please review the origination fee."],
    }).aiInsights).toEqual(["The processing fee is $200 and the origination fee has a computed impact of $150."]);
  });

  it("suppresses questions resolved by positive terms or verified financial values", () => {
    const result = validateAIEnhancement(context(true), {
      aiInsights: ["Is the APR disclosed?", "Could you waive the processing fee?"],
      aiNegotiationStrategies: ["Please remove data-sharing permission.", "Please clarify the interest rate.", "Please waive the processing fee."],
      aiClausesToReview: ["Review data-sharing permission."],
    });
    expect(result.aiInsights).toEqual([]);
    expect(result.aiNegotiationStrategies).toEqual(["Please remove data-sharing permission."]);
    expect(result.aiClausesToReview).toEqual(["Review data-sharing permission."]);
  });

  it("allows action sections only for medium findings or unresolved fields", () => {
    expect(hasActionableFindings(context())).toBe(false);
    expect(hasActionableFindings(context(true))).toBe(true);
    expect(hasActionableFindings({ ...context(), findings: [finding({ severity: 1 })] })).toBe(false);
    expect(hasActionableFindings({ ...context(), principalField: { ...context().principalField, value: null } })).toBe(true);
    const result = validateAIEnhancement(context(), {
      aiNegotiationStrategies: ["Please remove data-sharing permission."],
      aiClausesToReview: ["Review data-sharing permission."],
      counterOfferEmail: "Dear [Lender Name],\nPlease remove data-sharing permission.\n[My Name]",
    });
    expect(result.aiNegotiationStrategies).toEqual([]);
    expect(result.aiClausesToReview).toEqual([]);
    expect(result.aiCounterOfferEmail).toBeUndefined();
  });

  it("validates mocked OpenRouter output and keeps model/key integration intact", async () => {
    vi.stubEnv("VITE_OPENROUTER_API_KEY", "mock-key");
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({
      aiInsights: ["Your principal is $12,000.", "The lender charges $9,876."],
      aiNegotiationStrategies: ["Please remove data-sharing permission."],
      counterOfferEmail: "Dear [Lender Name],\nPlease remove data-sharing permission.\nPlease refund $9,876.\n[My Name]",
    }) } }] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const result = await enhanceAnalysisWithAI(context(true));
    expect(result.aiInsights).toEqual(["Your principal is $12,000."]);
    expect(result.aiCounterOfferEmail).toContain("data-sharing permission");
    expect(result.aiCounterOfferEmail).not.toContain("9,876");
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe("/.netlify/functions/openrouter");
    const request = JSON.parse(options.body);
    expect(request).not.toHaveProperty("model");
    expect(options.headers).not.toHaveProperty("Authorization");
    expect(options.body).not.toContain("mock-key");
    expect(request.max_tokens).toBeGreaterThan(1200);
    expect(request.messages[0].content).toContain("TYPE");
    expect(request.messages[0].content).toContain("BASIS");
    expect(options.body).not.toContain("PRIVATE UNRELATED");
  });

  it("applies the same safeguards when regenerating an email", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ choices: [{ message: { content:
      "Dear [Lender Name],\nPlease remove data-sharing permission.\nPlease refund $9,876.\n[My Name]",
    } }] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    expect(await regenerateCounterOfferEmail(context())).toBe(NO_NEGOTIATION_ISSUES);
    expect(fetchMock).not.toHaveBeenCalled();
    vi.stubEnv("VITE_OPENROUTER_API_KEY", "mock-key");
    const email = await regenerateCounterOfferEmail(context(true));
    expect(email).toContain("data-sharing permission");
    expect(email).not.toContain("9,876");
  });

  it("allows negotiating a unilateral rate clause even when the initial rate is verified", () => {
    const baseline = context(true);
    const result = validateAIEnhancement({ ...baseline, findings: [finding({
      id: "unilateral_rate", label: "Unilateral interest rate changes", category: "unilateral_terms",
      evidence: "The lender may change the interest rate at its discretion.",
    })] }, { counterOfferEmail: "Dear [Lender Name],\n1. Please remove unilateral interest rate changes and require written consent.\n[My Name]" });
    expect(result.aiCounterOfferEmail).toContain("Please remove unilateral interest rate changes");
  });

  it("keeps useful insights and reports why a separate email failed", async () => {
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ aiInsights: ["Your principal is $12,000."] }) } }] })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: "AI provider credits are exhausted." }), { status: 502 })));
    const result = await enhanceAnalysisWithAI(context(true));
    expect(result.aiInsights).toEqual(["Your principal is $12,000."]);
    expect(result.aiEmailStatus).toBe("unavailable");
    expect(result.aiEmailError).toContain("credits are exhausted");
  });

  it("passes each schedule segment separately instead of implying a uniform balloon schedule", () => {
    const base = context();
    const source = "Make 11 monthly payments of $50 followed by one final payment of $3,050.";
    const grounded = buildAIContext({ ...base, installmentSchedule: {
      count: 12, amount: 50, interval: 1, intervalUnit: "month", total: 3600, totalWithKnownFees: 3600,
      source, firstPaymentTiming: "one period after agreement", segments: [
        { count: 11, amount: 50, interval: 1, intervalUnit: "month", total: 550, kind: "regular", source },
        { count: 1, amount: 3050, interval: 1, intervalUnit: "month", total: 3050, kind: "balloon", source },
      ],
    } });
    expect(grounded.facts).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: "installment schedule segment 1 count", value: 11 }),
      expect.objectContaining({ name: "installment schedule segment 2 amount", value: 3050 }),
      expect.objectContaining({ name: "sum of scheduled payments", value: 3600, provenance: "computed" }),
    ]));
    expect(grounded.facts.some((fact) => fact.name === "installment schedule count")).toBe(false);
  });
});
