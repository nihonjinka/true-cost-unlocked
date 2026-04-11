import { useState } from "react";
import { motion } from "framer-motion";
import { Shield, Zap } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { AnalysisInput } from "@/components/AnalysisInput";
import { AnalysisDashboard, AnalysisResult } from "@/components/AnalysisDashboard";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { useTheme } from "@/hooks/useTheme";
import { analyzeLocally } from "@/lib/analyzeLocally";

export default function Index() {
  const { isDark, toggle } = useTheme();
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);

  const handleAnalyze = async (text: string, amount: number, rate: number, duration: number) => {
    setIsLoading(true);
    setResult(null);

    // Simulate brief processing time for UX
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
    <div className="min-h-screen gradient-bg relative overflow-hidden">
      {/* Ambient background orbs */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full bg-neon-blue/10 blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-neon-cyan/5 blur-3xl" />
      </div>

      <div className="relative z-10 max-w-5xl mx-auto px-4 py-8">
        {/* Header */}
        <motion.header
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between mb-10"
        >
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-primary/10 neon-glow">
              <Shield className="w-7 h-7 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-display font-bold text-gradient">TRUE COST</h1>
              <p className="text-xs text-muted-foreground font-medium tracking-wider uppercase">Financial Transparency Portal</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/10 text-xs font-semibold text-primary">
              <Zap className="w-3.5 h-3.5" />
              AI Powered
            </div>
            <ThemeToggle isDark={isDark} onToggle={toggle} />
          </div>
        </motion.header>

        {/* Hero */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="text-center mb-10"
        >
          <h2 className="text-3xl sm:text-4xl font-display font-bold text-foreground mb-3">
            Uncover the <span className="text-gradient">True Cost</span> of Any Financial Agreement
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Paste your loan agreement, credit card terms, or BNPL contract. We'll break it down into plain English, detect hidden fees, and calculate your real costs.
          </p>
        </motion.div>

        {/* Input Section */}
        <AnalysisInput onAnalyze={handleAnalyze} isLoading={isLoading} />

        {/* Results */}
        <div className="mt-8">
          {isLoading && <LoadingSpinner />}
          {result && !isLoading && <AnalysisDashboard result={result} />}
        </div>

        {/* Footer */}
        <motion.footer
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="text-center mt-16 mb-8 text-xs text-muted-foreground"
        >
          TRUE COST — Financial Transparency Portal • Built for informed decisions
        </motion.footer>
      </div>
    </div>
  );
}
