import { useState } from "react";
import { motion } from "framer-motion";
import { Shield, ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { AnalysisInput } from "@/components/AnalysisInput";
import { AnalysisDashboard, AnalysisResult } from "@/components/AnalysisDashboard";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { WorstCaseSimulator } from "@/components/WorstCaseSimulator";
import { AmortizationTable } from "@/components/AmortizationTable";
import { DeceptionDetector } from "@/components/DeceptionDetector";
import { SmartAdvice } from "@/components/SmartAdvice";
import { LoanComparison } from "@/components/LoanComparison";
import { SavingsCalculator } from "@/components/SavingsCalculator";
import { ThemeToggle } from "@/components/ThemeToggle";
import { analyzeLocally } from "@/lib/analyzeLocally";
import type { DeceptionResult } from "@/components/DeceptionDetector";
import type { AdviceResult } from "@/components/SmartAdvice";

interface ExtendedResult extends AnalysisResult {
  deception: DeceptionResult;
  advice: AdviceResult;
}

export default function Analyze() {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<ExtendedResult | null>(null);
  const [loanParams, setLoanParams] = useState({ amount: 0, rate: 0, duration: 0 });

  const handleAnalyze = async (text: string, amount: number, rate: number, duration: number) => {
    setIsLoading(true);
    setResult(null);
    setLoanParams({ amount, rate, duration });
    await new Promise((r) => setTimeout(r, 1500));
    try {
      const analysis = analyzeLocally(text, amount, rate, duration);
      setResult(analysis);
    } catch (err) {
      console.error("Analysis failed:", err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background grid-bg scanline">
      <div className="max-w-5xl mx-auto px-4 py-8">
        <motion.header
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between mb-10"
        >
          <div className="flex items-center gap-4">
            <Link
              to="/"
              className="flex items-center gap-2 font-mono text-[11px] tracking-widest uppercase text-muted-foreground hover:text-primary transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              BACK
            </Link>
            <div className="h-4 w-px bg-border" />
            <div className="flex items-center gap-3">
              <Shield className="w-5 h-5 text-primary" />
              <span className="font-display text-lg font-bold text-foreground">TRUE COST</span>
              <span className="font-mono text-[10px] text-primary/60 border border-primary/20 px-2 py-0.5">ANALYZER</span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <ThemeToggle />
            <div className="flex items-center gap-2">
              <span className="status-dot animate-pulse-dot" />
              <span className="font-mono text-[10px] text-muted-foreground tracking-widest">ENGINE ACTIVE</span>
            </div>
          </div>
        </motion.header>

        <AnalysisInput onAnalyze={handleAnalyze} isLoading={isLoading} />

        <div className="mt-8 space-y-4">
          {isLoading && <LoadingSpinner />}
          {result && !isLoading && (
            <>
              <AnalysisDashboard result={result} />
              <DeceptionDetector deception={result.deception} />
              <SmartAdvice advice={result.advice} />
              <WorstCaseSimulator
                principal={result.principal}
                emi={result.emi}
                totalPayment={result.totalPayment}
                totalInterest={result.totalInterest}
                durationMonths={loanParams.duration}
              />
              <AmortizationTable
                principal={result.principal}
                annualRate={loanParams.rate}
                tenureMonths={loanParams.duration}
              />
              <SavingsCalculator
                principal={result.principal}
                annualRate={loanParams.rate}
                tenureMonths={loanParams.duration}
                totalInterest={result.totalInterest}
              />
              <LoanComparison />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
