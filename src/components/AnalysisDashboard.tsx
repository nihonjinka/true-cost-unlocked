import { motion } from "framer-motion";
import { Shield, AlertTriangle, DollarSign, Brain, FileWarning, TrendingUp } from "lucide-react";
import { GlassCard } from "./GlassCard";
import { AnimatedCounter } from "./AnimatedCounter";
import { RiskMeter } from "./RiskMeter";
import { formatCurrency } from "@/lib/financial";

export interface AnalysisResult {
  summary: string;
  hiddenFees: string[];
  warnings: string[];
  riskScore: number;
  insights: string[];
  emi: number;
  totalPayment: number;
  totalInterest: number;
  principal: number;
}

interface Props {
  result: AnalysisResult;
}

export function AnalysisDashboard({ result }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
      className="space-y-6"
    >
      {/* Financial Summary Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <GlassCard delay={0.1} neon>
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 rounded-xl bg-primary/10">
              <DollarSign className="w-5 h-5 text-primary" />
            </div>
            <span className="text-sm font-medium text-muted-foreground">Monthly EMI</span>
          </div>
          <div className="text-2xl text-foreground">
            <AnimatedCounter value={result.emi} prefix="$" />
          </div>
        </GlassCard>

        <GlassCard delay={0.2} neon>
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 rounded-xl bg-secondary/10">
              <TrendingUp className="w-5 h-5 text-secondary" />
            </div>
            <span className="text-sm font-medium text-muted-foreground">Total Payment</span>
          </div>
          <div className="text-2xl text-foreground">
            <AnimatedCounter value={result.totalPayment} prefix="$" />
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Principal: {formatCurrency(result.principal)}
          </p>
        </GlassCard>

        <GlassCard delay={0.3} neon>
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 rounded-xl bg-destructive/10">
              <AlertTriangle className="w-5 h-5 text-destructive" />
            </div>
            <span className="text-sm font-medium text-muted-foreground">Total Interest</span>
          </div>
          <div className="text-2xl text-destructive">
            <AnimatedCounter value={result.totalInterest} prefix="$" />
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {((result.totalInterest / result.principal) * 100).toFixed(1)}% of principal
          </p>
        </GlassCard>
      </div>

      {/* Risk Score + Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <GlassCard delay={0.35} className="flex items-center justify-center">
          <RiskMeter score={result.riskScore} />
        </GlassCard>

        <GlassCard delay={0.4} className="lg:col-span-2">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-xl bg-neon-cyan/10">
              <FileWarning className="w-5 h-5 text-neon-cyan" />
            </div>
            <h3 className="font-display font-bold text-foreground">Plain English Summary</h3>
          </div>
          <p className="text-sm leading-relaxed text-muted-foreground">{result.summary}</p>
        </GlassCard>
      </div>

      {/* Hidden Fees */}
      {result.hiddenFees.length > 0 && (
        <GlassCard delay={0.5}>
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-xl bg-destructive/10">
              <Shield className="w-5 h-5 text-destructive" />
            </div>
            <h3 className="font-display font-bold text-foreground">Hidden Fees Detected</h3>
            <span className="ml-auto text-xs font-semibold px-3 py-1 rounded-full bg-destructive/15 text-destructive">
              {result.hiddenFees.length} found
            </span>
          </div>
          <ul className="space-y-2">
            {result.hiddenFees.map((fee, i) => (
              <motion.li
                key={i}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.5 + i * 0.1 }}
                className="flex items-start gap-3 text-sm"
              >
                <AlertTriangle className="w-4 h-4 text-destructive mt-0.5 flex-shrink-0" />
                <span className="text-foreground">{fee}</span>
              </motion.li>
            ))}
          </ul>
        </GlassCard>
      )}

      {/* Warnings */}
      {result.warnings.length > 0 && (
        <GlassCard delay={0.6}>
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-xl bg-yellow-500/10">
              <AlertTriangle className="w-5 h-5 text-yellow-500" />
            </div>
            <h3 className="font-display font-bold text-foreground">Warnings & Red Flags</h3>
          </div>
          <ul className="space-y-2">
            {result.warnings.map((w, i) => (
              <motion.li
                key={i}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.6 + i * 0.1 }}
                className="flex items-start gap-3 text-sm"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-yellow-500 mt-2 flex-shrink-0" />
                <span className="text-foreground">{w}</span>
              </motion.li>
            ))}
          </ul>
        </GlassCard>
      )}

      {/* AI Insights */}
      {result.insights.length > 0 && (
        <GlassCard delay={0.7} neon>
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-xl bg-primary/10">
              <Brain className="w-5 h-5 text-primary" />
            </div>
            <h3 className="font-display font-bold text-foreground">AI Insights</h3>
          </div>
          <ul className="space-y-3">
            {result.insights.map((insight, i) => (
              <motion.li
                key={i}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.7 + i * 0.1 }}
                className="flex items-start gap-3 text-sm"
              >
                <Sparkle index={i} />
                <span className="text-foreground">{insight}</span>
              </motion.li>
            ))}
          </ul>
        </GlassCard>
      )}
    </motion.div>
  );
}

function Sparkle({ index }: { index: number }) {
  const colors = ["text-primary", "text-neon-blue", "text-neon-cyan"];
  return <span className={`text-lg ${colors[index % colors.length]}`}>✦</span>;
}
