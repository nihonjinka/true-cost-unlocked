import type { SupportedCurrency } from "./financial";

export interface GlossaryItem { term: string; definition: string }
export interface FairMarketBenchmark { marketAverage: number; differencePercent: number; assessment: string; source?: string; asOf?: string }
export interface AlternativeFunding { title: string; description: string; estimatedSavings?: string }
export interface DeceptionResult { urgencyTactics: string[]; fakeDiscounts: string[]; emotionalManipulation: string[] }
export interface AdviceResult {
  recommendation: "review_required" | "no_material_flags" | "insufficient_confidence";
  reasons: string[];
}

export interface InstallmentSchedule {
  count: number;
  amount: number;
  interval: number;
  intervalUnit: "day" | "week" | "month";
  total: number;
  totalWithKnownFees: number | null;
  source: string;
}

export type DocumentType =
  | "installment_loan" | "bnpl" | "auto_loan" | "mortgage" | "credit_card"
  | "payday" | "rent_to_own" | "gold_loan" | "subscription" | "advance_fee_scam" | "unknown";

export interface ExtractedCandidate<T = number> {
  value: T;
  label: string;
  source: string;
  position: number;
  confidence: number;
  score: number;
}

export interface ExtractedField<T = number> {
  value: T | null;
  source: string | null;
  confidence: number;
  alternatives: ExtractedCandidate<T>[];
  needsReview: boolean;
}

export interface CostFinding {
  id: string;
  label: string;
  category: string;
  severity: number;
  amount: number | null;
  percent: number | null;
  basis: string | null;
  frequency: string | null;
  conditions: string[];
  source: string;
  position: number;
  explanation: string;
  totalImpact: number | null;
  negated: boolean;
  /** True when the clause names a charge but does not quantify it. */
  amountNotStated?: boolean;
  /** Tax embedded in a composite expression such as "$100 + 18% GST". */
  taxAmount?: number | null;
  taxPercent?: number | null;
  taxBasis?: string | null;
  groupId?: string;
}

export interface LineItemGroup {
  id: string;
  label: string;
  items: Array<{ label: string; amount: number; source: string; position: number; category: string }>;
  aggregate: number;
  source: string;
  position: number;
}

export interface ReconciliationCheck {
  id: string;
  label: string;
  expression: string;
  calculated: number;
  expected: number;
  difference: number;
  matched: boolean;
  source: string;
  undisclosedItems: string[];
}

export interface CalculatorStatus {
  calculator: string;
  label: string;
  available: boolean;
  missingInputs: string[];
}

export interface AddOnImpact {
  amount: number;
  paymentIncrease: number;
  totalPaymentIncrease: number;
  interestIncrease: number;
}

export interface DetectedClaim {
  id: string;
  label: string;
  source: string;
  contradicted: boolean;
  contradiction: string | null;
}

export interface RiskBreakdownItem {
  category: string;
  points: number;
  reasons: string[];
}

export interface AnalysisContext {
  readonly docType: { type: DocumentType; label: string; confidence: number; signals: string[] };
  readonly region: string | null;
  readonly currency: SupportedCurrency | null;
  readonly currencyCode: SupportedCurrency;
  readonly principalField: ExtractedField<number>;
  readonly rateField: ExtractedField<number> & { rateType: "reducing" | "flat" | "deferred" | "revolving" | "unknown" };
  readonly termField: ExtractedField<number>;
  readonly statedEMI: ExtractedField<number>;
  readonly installmentSchedule: InstallmentSchedule | null;
  readonly principal: number | null;
  readonly fees: CostFinding[];
  readonly addOns: CostFinding[];
  readonly taxes: CostFinding[];
  readonly offsets: CostFinding[];
  readonly itemGroups: LineItemGroup[];
  readonly reconciliations: ReconciliationCheck[];
  readonly calculator: CalculatorStatus;
  readonly confidenceIssues: string[];
  readonly addOnImpact: AddOnImpact | null;
  readonly netExtraCost: number | null;
  readonly netExtraCostPercent: number | null;
  readonly claims: DetectedClaim[];
  readonly confidence: number;
  readonly warnings: string[];
  readonly riskScore: number;
  readonly riskBand: "low" | "medium" | "high" | "insufficient_confidence";
  readonly riskBreakdown: RiskBreakdownItem[];
  readonly summary: string;
  readonly hiddenFees: string[];
  readonly insights: string[];
  readonly aiInsights?: string[];
  readonly emi: number | null;
  readonly totalPayment: number | null;
  readonly totalInterest: number | null;
  readonly totalCost: number | null;
  readonly financialMetricsAvailable: boolean;
  readonly effectiveAPR: number | null;
  readonly netDisbursed: number | null;
  readonly deception: DeceptionResult;
  readonly advice: AdviceResult;
  readonly glossary: GlossaryItem[];
  readonly fairMarketComparison?: FairMarketBenchmark;
  readonly alternativeFunding: AlternativeFunding[];
  readonly simulator: {
    lateFeeAmount: number | null;
    lateFeePercent: number | null;
    lateFeeBasis: string | null;
    penaltyAPR: number | null;
    isAssumption: boolean;
  };
  readonly rawText: string;
}

export type AnalysisResult = AnalysisContext;

export function freezeAnalysisContext<T extends object>(context: T): Readonly<T> {
  const freeze = (value: unknown): void => {
    if (!value || typeof value !== "object" || Object.isFrozen(value)) return;
    Object.freeze(value);
    for (const child of Object.values(value)) freeze(child);
  };
  freeze(context);
  return context;
}
