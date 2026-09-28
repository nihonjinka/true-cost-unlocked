import { motion } from "framer-motion";
import { Shield, AlertTriangle, DollarSign, Brain, FileWarning, TrendingUp } from "lucide-react";
import TerminalCard from "./TerminalCard";
import { AnimatedCounter } from "./AnimatedCounter";
import { RiskMeter } from "./RiskMeter";
import { formatCurrency, getCurrencyLocale, getCurrencySymbol, type SupportedCurrency } from "@/lib/financial";

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
  currencyCode: SupportedCurrency;
  negotiationStrategy?: string[];
  legalLoopholes?: string[];
  counterOfferEmail?: string;
  rawText: string;
}

interface Props {
  result: AnalysisResult;
}



export function AnalysisDashboard({ result }: Props) {
  const currencySymbol = getCurrencySymbol(result.currencyCode);
  const currencyLocale = getCurrencyLocale(result.currencyCode);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-4"
    >
      {/* Financial numbers row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <TerminalCard title="MONTHLY EMI" icon={DollarSign} delay={0.1}>
          <div className="text-2xl font-display font-bold text-foreground">
            <AnimatedCounter value={result.emi} prefix={currencySymbol} locale={currencyLocale} />
          </div>
        </TerminalCard>
        <TerminalCard title="TOTAL PAYMENT" icon={TrendingUp} delay={0.2}>
          <div className="text-2xl font-display font-bold text-foreground">
            <AnimatedCounter value={result.totalPayment} prefix={currencySymbol} locale={currencyLocale} />
          </div>
          <p className="font-mono text-[10px] text-muted-foreground mt-1">
            Principal: {formatCurrency(result.principal, result.currencyCode)}
          </p>
        </TerminalCard>
        <TerminalCard title="TOTAL INTEREST" icon={AlertTriangle} delay={0.3}>
          <div className="text-2xl font-display font-bold text-destructive">
            <AnimatedCounter value={result.totalInterest} prefix={currencySymbol} locale={currencyLocale} />
          </div>
          <p className="font-mono text-[10px] text-muted-foreground mt-1">
            {result.principal > 0 ? ((result.totalInterest / result.principal) * 100).toFixed(1) : "0.0"}% of principal
          </p>
        </TerminalCard>
      </div>

      {/* Risk + Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <TerminalCard title="RISK ASSESSMENT" icon={Shield} delay={0.35} className="flex flex-col">
          <div className="flex items-center justify-center py-2">
            <RiskMeter score={result.riskScore} />
          </div>
        </TerminalCard>
        <TerminalCard title="PLAIN ENGLISH SUMMARY" icon={FileWarning} delay={0.4} className="lg:col-span-2">
          <p className="font-mono text-sm leading-relaxed text-muted-foreground">{result.summary}</p>
        </TerminalCard>
      </div>

      {/* Hidden Fees */}
      {result.hiddenFees.length > 0 && (
        <TerminalCard title="HIDDEN FEES DETECTED" icon={Shield} delay={0.5} tag={`${result.hiddenFees.length} FOUND`}>
          <ul className="space-y-2">
            {result.hiddenFees.map((fee, i) => (
              <motion.li
                key={i}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.5 + i * 0.08 }}
                className="flex items-start gap-3 font-mono text-sm"
              >
                <AlertTriangle className="w-4 h-4 text-destructive mt-0.5 flex-shrink-0" />
                <span className="text-foreground">{fee}</span>
              </motion.li>
            ))}
          </ul>
        </TerminalCard>
      )}

      {/* Warnings */}
      {result.warnings.length > 0 && (
        <TerminalCard title="WARNINGS & RED FLAGS" icon={AlertTriangle} delay={0.6}>
          <ul className="space-y-2">
            {result.warnings.map((w, i) => (
              <motion.li
                key={i}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.6 + i * 0.08 }}
                className="flex items-start gap-3 font-mono text-sm"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-yellow-500 mt-2 flex-shrink-0" />
                <span className="text-foreground">{w}</span>
              </motion.li>
            ))}
          </ul>
        </TerminalCard>
      )}

      {/* AI Insights */}
      {result.insights.length > 0 && (
        <TerminalCard title="AI INSIGHTS" icon={Brain} delay={0.7}>
          <ul className="space-y-3">
            {result.insights.map((insight, i) => (
              <motion.li
                key={i}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.7 + i * 0.08 }}
                className="flex items-start gap-3 font-mono text-sm"
              >
                <span className="text-primary mt-0.5">▸</span>
                <span className="text-foreground">{insight}</span>
              </motion.li>
            ))}
          </ul>
        </TerminalCard>
      )}

      {/* Negotiation & Loopholes (AI Enhanced) */}
      {(result.negotiationStrategy && result.negotiationStrategy.length > 0) && (
        <TerminalCard title="NEGOTIATION PLAYBOOK" icon={Brain} delay={0.8}>
          <ul className="space-y-3">
            {result.negotiationStrategy.map((strategy, i) => (
              <motion.li
                key={i}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.8 + i * 0.08 }}
                className="flex items-start gap-3 font-mono text-sm"
              >
                <span className="text-green-500 mt-0.5">✔</span>
                <span className="text-foreground">{strategy}</span>
              </motion.li>
            ))}
          </ul>
        </TerminalCard>
      )}

      {(result.legalLoopholes && result.legalLoopholes.length > 0) && (
        <TerminalCard title="LEGAL LOOPHOLES & TRAPS" icon={FileWarning} delay={0.9} className="border-destructive/30">
          <ul className="space-y-3">
            {result.legalLoopholes.map((loophole, i) => (
              <motion.li
                key={i}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.9 + i * 0.08 }}
                className="flex items-start gap-3 font-mono text-sm"
              >
                <span className="text-destructive mt-0.5">☢</span>
                <span className="text-destructive/90">{loophole}</span>
              </motion.li>
            ))}
          </ul>
        </TerminalCard>
      )}
    </motion.div>
  );
}
