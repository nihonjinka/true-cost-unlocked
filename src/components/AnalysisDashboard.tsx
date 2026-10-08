import { motion } from "framer-motion";
import { Shield, AlertTriangle, DollarSign, Brain, FileWarning, TrendingUp } from "lucide-react";
import TerminalCard from "./TerminalCard";
import { AnimatedCounter } from "./AnimatedCounter";
import { RiskMeter } from "./RiskMeter";
import { formatCurrency, getCurrencyLocale, getCurrencySymbol } from "@/lib/financial";
import type { AnalysisContext } from "@/lib/analysisContext";

export type AnalysisResult = AnalysisContext;

interface Props {
  context: AnalysisContext;
  onPrincipalSelect?: (amount: number) => void;
}

export function AnalysisDashboard({ context, onPrincipalSelect }: Props) {
  const currencySymbol = getCurrencySymbol(context.currencyCode);
  const currencyLocale = getCurrencyLocale(context.currencyCode);
  const hasMetrics = context.financialMetricsAvailable && context.emi !== null && context.totalPayment !== null && context.totalInterest !== null && context.totalCost !== null;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
      {hasMetrics && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <TerminalCard title="MONTHLY PAYMENT" icon={DollarSign} delay={0.1}>
            <div className="text-2xl font-display font-bold text-foreground">
              <AnimatedCounter value={context.emi!} prefix={currencySymbol} locale={currencyLocale} />
            </div>
          </TerminalCard>
          <TerminalCard title="SCHEDULED PAYMENTS" icon={TrendingUp} delay={0.2}>
            <div className="text-2xl font-display font-bold text-foreground">
              <AnimatedCounter value={context.totalPayment!} prefix={currencySymbol} locale={currencyLocale} />
            </div>
          </TerminalCard>
          <TerminalCard title="FINANCE COST" icon={TrendingUp} delay={0.25}>
            <div className="text-2xl font-display font-bold text-foreground">
              <AnimatedCounter value={context.totalCost!} prefix={currencySymbol} locale={currencyLocale} />
            </div>
            <p className="font-mono text-[10px] text-muted-foreground mt-1">Interest plus modeled fees</p>
            {context.netDisbursed !== null && <p className="font-mono text-[10px] text-muted-foreground">Net proceeds: {formatCurrency(context.netDisbursed, context.currencyCode)}</p>}
          </TerminalCard>
          <TerminalCard title="TOTAL INTEREST" icon={AlertTriangle} delay={0.3}>
            <div className="text-2xl font-display font-bold text-destructive">
              <AnimatedCounter value={context.totalInterest!} prefix={currencySymbol} locale={currencyLocale} />
            </div>
            <p className="font-mono text-[10px] text-muted-foreground mt-1">
              {context.principal ? ((context.totalInterest! / context.principal) * 100).toFixed(1) : "N/A"}% of principal
            </p>
          </TerminalCard>
          {context.effectiveAPR !== null && (
            <TerminalCard title="EFFECTIVE APR" icon={TrendingUp} delay={0.4}>
              <div className="text-2xl font-display font-bold text-foreground">{context.effectiveAPR.toFixed(2)}%</div>
              <p className="font-mono text-[10px] text-muted-foreground mt-1">Includes modeled fees</p>
            </TerminalCard>
          )}
        </div>
      )}

      {context.installmentSchedule && (
        <TerminalCard title="INSTALLMENT SCHEDULE" icon={DollarSign} delay={0.2}>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 font-mono text-sm">
            <p>{context.installmentSchedule.count} × {formatCurrency(context.installmentSchedule.amount, context.currencyCode)}</p>
            <p>Every {context.installmentSchedule.interval} {context.installmentSchedule.intervalUnit}{context.installmentSchedule.interval === 1 ? "" : "s"}</p>
            <p className="font-bold">Scheduled total: {formatCurrency(context.installmentSchedule.total, context.currencyCode)}</p>
            {context.installmentSchedule.totalWithKnownFees !== null && context.installmentSchedule.totalWithKnownFees > context.installmentSchedule.total && (
              <p className="sm:col-span-3 text-destructive">At least {formatCurrency(context.installmentSchedule.totalWithKnownFees, context.currencyCode)} including identified recurring charges; conditional penalties excluded.</p>
            )}
          </div>
        </TerminalCard>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <TerminalCard title="RISK ASSESSMENT" icon={Shield} delay={0.35} className="flex flex-col">
          <div className="flex items-center justify-center py-2"><RiskMeter score={context.riskScore} band={context.riskBand} /></div>
          <p className="text-center font-mono text-[10px] text-muted-foreground mt-1">Extraction confidence: {Math.round(context.confidence * 100)}%</p>
          {context.riskBreakdown.length > 0 && (
            <ul className="mt-3 space-y-1 border-t border-border pt-2">
              {context.riskBreakdown.map((item) => (
                <li key={item.category} className="font-mono text-[10px] text-muted-foreground">
                  {item.category.replace(/_/g, " ")}: {item.points} points
                </li>
              ))}
            </ul>
          )}
        </TerminalCard>
        <TerminalCard title="PLAIN ENGLISH SUMMARY" icon={FileWarning} delay={0.4} className="lg:col-span-2">
          <p className="font-mono text-sm leading-relaxed text-muted-foreground">{context.summary}</p>
          <p className="font-mono text-[10px] text-muted-foreground mt-3">
            {context.docType.label} · Currency: {context.currency ?? "not detected"}{context.currency ? " (automatic)" : " (USD display fallback)"}
          </p>
        </TerminalCard>
      </div>

      {context.principalField.needsReview && context.principalField.alternatives.length > 0 && (
        <TerminalCard title="SELECT PRINCIPAL AMOUNT" icon={AlertTriangle} delay={0.45}>
          <p className="font-mono text-xs text-muted-foreground mb-3">The amount is ambiguous or does not match the stated payment. Choose the amount labeled as the financed principal.</p>
          <div className="flex flex-wrap gap-2">
            {context.principalField.alternatives.map((candidate) => (
              <button key={candidate.position + ":" + candidate.value} onClick={() => onPrincipalSelect?.(candidate.value)}
                className="border border-border px-3 py-2 text-left font-mono text-xs hover:border-primary/50">
                <span className="block text-foreground">{candidate.label}: {formatCurrency(candidate.value, context.currencyCode)}</span>
                <span className="block text-muted-foreground">{candidate.source}</span>
              </button>
            ))}
          </div>
        </TerminalCard>
      )}

      {context.hiddenFees.length > 0 && (
        <TerminalCard title="FEES & ADD-ON COSTS DETECTED" icon={Shield} delay={0.5} tag={context.hiddenFees.length + " FOUND"}>
          <ul className="space-y-2">
            {context.hiddenFees.map((fee, i) => (
              <motion.li key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.5 + i * 0.08 }} className="flex items-start gap-3 font-mono text-sm">
                <AlertTriangle className="w-4 h-4 text-destructive mt-0.5 flex-shrink-0" />
                <span className="text-foreground">{fee}</span>
              </motion.li>
            ))}
          </ul>
        </TerminalCard>
      )}

      {context.warnings.length > 0 && (
        <TerminalCard title="WARNINGS & RED FLAGS" icon={AlertTriangle} delay={0.6}>
          <ul className="space-y-2">
            {context.warnings.map((warning, i) => (
              <motion.li key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.6 + i * 0.08 }} className="flex items-start gap-3 font-mono text-sm">
                <span className="w-1.5 h-1.5 rounded-full bg-yellow-500 mt-2 flex-shrink-0" />
                <span className="text-foreground">{warning}</span>
              </motion.li>
            ))}
          </ul>
        </TerminalCard>
      )}

      {context.insights.length > 0 && (
        <TerminalCard title="PATTERN-BASED INSIGHTS" icon={Brain} delay={0.7}>
          <ul className="space-y-3">
            {context.insights.map((insight, i) => (
              <motion.li key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.7 + i * 0.08 }} className="flex items-start gap-3 font-mono text-sm">
                <span className="text-primary mt-0.5">▸</span><span className="text-foreground">{insight}</span>
              </motion.li>
            ))}
          </ul>
        </TerminalCard>
      )}

      {!!context.aiInsights?.length && (
        <TerminalCard title="OPTIONAL AI INSIGHTS" icon={Brain} delay={0.72}>
          <ul className="space-y-3">
            {context.aiInsights.map((insight, i) => (
              <motion.li key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.72 + i * 0.08 }} className="flex items-start gap-3 font-mono text-sm">
                <span className="text-primary mt-0.5">▸</span><span className="text-foreground">{insight}</span>
              </motion.li>
            ))}
          </ul>
        </TerminalCard>
      )}

      {context.fairMarketComparison && (
        <TerminalCard title="FAIR MARKET BENCHMARK" icon={TrendingUp} delay={0.75}>
          <div className="font-mono text-sm space-y-2">
            <div className="flex justify-between items-center bg-secondary/30 p-3 rounded">
              <span>Matched market average:</span><span className="font-bold text-foreground">{context.fairMarketComparison.marketAverage}% APR</span>
            </div>
            <p className="text-muted-foreground leading-relaxed">{context.fairMarketComparison.assessment}</p>
            <p className="text-[10px] text-muted-foreground">Source: {context.fairMarketComparison.source} · As of {context.fairMarketComparison.asOf}</p>
          </div>
        </TerminalCard>
      )}

      {context.glossary.length > 0 && (
        <TerminalCard title="JARGON GLOSSARY" icon={FileWarning} delay={0.78}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {context.glossary.map((item, i) => (
              <div key={i} className="bg-secondary/20 p-3 rounded border border-border/50 font-mono text-xs space-y-1">
                <div className="font-bold text-primary">{item.term}</div><div className="text-muted-foreground">{item.definition}</div>
              </div>
            ))}
          </div>
        </TerminalCard>
      )}

      {context.alternativeFunding.length > 0 && (
        <TerminalCard title="ALTERNATIVE FUNDING" icon={TrendingUp} delay={0.82}>
          <div className="space-y-3">
            {context.alternativeFunding.map((alternative, i) => (
              <div key={i} className="bg-secondary/20 p-3.5 rounded border border-border/50 font-mono text-xs space-y-1.5">
                <div className="flex items-center justify-between"><span className="font-bold text-primary text-sm">{alternative.title}</span>
                  {alternative.estimatedSavings && <span className="text-green-500 text-[10px]">{alternative.estimatedSavings}</span>}
                </div>
                <p className="text-muted-foreground leading-relaxed">{alternative.description}</p>
              </div>
            ))}
          </div>
        </TerminalCard>
      )}
    </motion.div>
  );
}
