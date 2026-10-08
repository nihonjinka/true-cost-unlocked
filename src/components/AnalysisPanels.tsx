import type { ReactNode } from "react";
import { AnalysisDashboard } from "./AnalysisDashboard";
import { DeceptionDetector } from "./DeceptionDetector";
import { SmartAdvice } from "./SmartAdvice";
import { AmortizationTable } from "./AmortizationTable";
import { WorstCaseSimulator } from "./WorstCaseSimulator";
import { SavingsCalculator } from "./SavingsCalculator";
import { LoanComparison } from "./LoanComparison";
import { AICounterOfferEmail } from "./AICounterOfferEmail";
import type { AnalysisContext } from "@/lib/analysisContext";

export type AIEnhancementStatus = "unconfigured" | "loading" | "ready" | "error";

interface Props {
  context: AnalysisContext;
  onPrincipalSelect?: (amount: number) => void;
  aiEnhancementStatus?: AIEnhancementStatus;
}

interface PanelDescriptor {
  id: string;
  calculator?: string;
  render: (context: AnalysisContext, onPrincipalSelect?: (amount: number) => void, aiEnhancementStatus?: AIEnhancementStatus) => ReactNode;
}

const PANEL_REGISTRY: PanelDescriptor[] = [
  { id: "analysis-dashboard", render: (context, onPrincipalSelect, aiEnhancementStatus) => <AnalysisDashboard context={context} onPrincipalSelect={onPrincipalSelect} aiEnhancementStatus={aiEnhancementStatus} /> },
  { id: "deception-detector", render: (context) => <DeceptionDetector context={context} /> },
  { id: "smart-advice", render: (context) => <SmartAdvice context={context} /> },
  { id: "amortization", calculator: "amortization", render: (context) => <AmortizationTable context={context} /> },
  { id: "late-payment-scenario", calculator: "worst_case", render: (context) => <WorstCaseSimulator context={context} /> },
  { id: "early-repayment-scenario", calculator: "early_repayment", render: (context) => <SavingsCalculator context={context} /> },
  { id: "loan-comparison", calculator: "loan_comparison", render: (context) => <LoanComparison context={context} /> },
];

export function AnalysisPanels({ context, onPrincipalSelect, aiEnhancementStatus = "unconfigured" }: Props) {
  const ran = new Set(context.ranCalculators);
  const visiblePanels = PANEL_REGISTRY.filter((panel) => !panel.calculator || ran.has(panel.calculator));
  return (
    <section key={context.id} data-analysis-id={context.id} className="space-y-4">
      {visiblePanels.map((panel) => (
        <div key={panel.id} data-analysis-panel={panel.id}>
          {panel.render(context, onPrincipalSelect, aiEnhancementStatus)}
        </div>
      ))}
      {context.aiCounterOfferEmail && <AICounterOfferEmail key={`ai-email:${context.id}`} context={context} />}
    </section>
  );
}
