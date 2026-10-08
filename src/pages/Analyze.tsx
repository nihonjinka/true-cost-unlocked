import { useRef, useState } from "react";
import { motion } from "framer-motion";
import { Shield, ArrowLeft, AlertCircle } from "lucide-react";
import { Link } from "react-router-dom";
import { AnalysisInput } from "@/components/AnalysisInput";
import { AnalysisPanels } from "@/components/AnalysisPanels";
import { ThemeToggle } from "@/components/ThemeToggle";
import { analyzeLocally } from "@/lib/analyzeLocally";
import { freezeAnalysisContext, type AnalysisContext } from "@/lib/analysisContext";
import { enhanceAnalysisWithAI, isAIEnhancementConfigured } from "@/lib/analyzeWithAI";
import type { AIEnhancementStatus } from "@/components/AnalysisPanels";
import type { SupportedCurrency } from "@/lib/financial";

export default function Analyze() {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<AnalysisContext | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [aiEnhancementStatus, setAIEnhancementStatus] = useState<AIEnhancementStatus>("unconfigured");
  const aiRequestVersion = useRef(0);

  const requestAIEnhancement = (analysis: AnalysisContext) => {
    const requestVersion = ++aiRequestVersion.current;
    if (!isAIEnhancementConfigured()) {
      setAIEnhancementStatus("unconfigured");
      return;
    }

    setAIEnhancementStatus("loading");
    void enhanceAnalysisWithAI(analysis)
      .then((enhancement) => {
        if (aiRequestVersion.current !== requestVersion) return;
        setResult((current) => current?.id === analysis.id
          ? freezeAnalysisContext({ ...current, ...enhancement }) as AnalysisContext
          : current);
        setAIEnhancementStatus("ready");
      })
      .catch((error: unknown) => {
        if (aiRequestVersion.current !== requestVersion) return;
        console.warn("OpenRouter insights could not be loaded; keeping deterministic analysis:", error);
        setAIEnhancementStatus("error");
      });
  };

  const handleAnalyze = (text: string, amount: number | null, rate: number | null, duration: number | null, currency: SupportedCurrency | null) => {
    aiRequestVersion.current += 1;
    setAIEnhancementStatus("unconfigured");
    setIsLoading(true);
    setAnalysisError(null);
    setResult(null);
    try {
      const analysis = analyzeLocally(text, amount, rate, duration, currency);
      setResult(analysis);
      requestAIEnhancement(analysis);
    } catch (error) {
      console.error("Analysis failed:", error);
      setAnalysisError(error instanceof Error ? error.message : "The document could not be analyzed.");
    } finally {
      setIsLoading(false);
    }
  };

  const selectPrincipal = (amount: number) => {
    if (!result) return;
    const rateOverride = result.rateField.source === "User override" ? result.rateField.value : null;
    const durationOverride = result.termField.source === "User override" ? result.termField.value : null;
    const next = analyzeLocally(result.rawText, amount, rateOverride, durationOverride, result.currency);
    setResult(next);
    requestAIEnhancement(next);
  };

  return (
    <div className="page-enter min-h-screen bg-background grid-bg scanline">
      <div className="max-w-5xl mx-auto px-4 py-8">
        <motion.header initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between mb-10">
          <div className="flex items-center gap-4">
            <Link to="/" className="interactive-button flex items-center gap-2 font-mono text-[11px] tracking-widest uppercase text-muted-foreground hover:text-primary transition-colors">
              <ArrowLeft className="w-4 h-4" /> BACK
            </Link>
            <div className="h-4 w-px bg-border" />
            <div className="flex items-center gap-3"><Shield className="w-5 h-5 text-primary" />
              <span className="font-display text-lg font-bold text-foreground">TRUE COST</span>
              <span className="font-mono text-[10px] text-primary/60 border border-primary/20 px-2 py-0.5">ANALYZER</span>
            </div>
          </div>
          <div className="flex items-center gap-4"><ThemeToggle /><div className="flex items-center gap-2">
            <span className="status-dot animate-pulse-dot" /><span className="font-mono text-[10px] text-muted-foreground tracking-widest">ENGINE ACTIVE</span>
          </div></div>
        </motion.header>

        <AnalysisInput onAnalyze={handleAnalyze} isLoading={isLoading} />
        <div className="mt-8 space-y-4">
          {analysisError && <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            className="flex items-start gap-3 px-4 py-3 border border-destructive/30 bg-destructive/5">
            <AlertCircle className="w-4 h-4 text-destructive mt-0.5 flex-shrink-0" /><p className="font-mono text-xs text-destructive">{analysisError}</p>
          </motion.div>}
          {result && !isLoading && (
            <AnalysisPanels key={result.id} context={result} onPrincipalSelect={selectPrincipal} aiEnhancementStatus={aiEnhancementStatus} />
          )}
        </div>
      </div>
    </div>
  );
}
