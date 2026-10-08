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
  aiEnhancementStatus?: "unconfigured" | "loading" | "ready" | "error";
}

export function AnalysisDashboard({ context, onPrincipalSelect, aiEnhancementStatus = "unconfigured" }: Props) {
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

      {context.cashPriceAnalysis && (
        <TerminalCard title="CASH PRICE VS TOTAL" icon={TrendingUp} delay={0.24}>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 font-mono text-sm">
            <p>Total paid: <strong>{formatCurrency(context.cashPriceAnalysis.totalPaid, context.currencyCode)}</strong></p>
            <p>Cash-price multiple: <strong>{context.cashPriceAnalysis.multiple.toFixed(2)}×</strong></p>
            <p>Extra cost: <strong>{formatCurrency(context.cashPriceAnalysis.extraCost, context.currencyCode)}</strong></p>
            <p className="sm:col-span-3">
              Implied nominal APR: <strong>{context.cashPriceAnalysis.impliedNominalAPR === null ? "not solvable" : context.cashPriceAnalysis.impliedNominalAPR.toFixed(1) + "%"}</strong>
              {" · "}IRR assumes the first payment is one payment period after agreement.
            </p>
          </div>
        </TerminalCard>
      )}

      {(context.netExtraCost !== null || context.costBreakdown.optionalProducts > 0) && (
        <TerminalCard title="FINANCING COST BREAKDOWN" icon={TrendingUp} delay={0.26}>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 font-mono text-xs">
            <p>Interest: {formatCurrency(context.costBreakdown.interest, context.currencyCode)}</p>
            <p>Taxes: {formatCurrency(context.costBreakdown.taxes, context.currencyCode)}</p>
            <p>Fees: {formatCurrency(context.costBreakdown.fees, context.currencyCode)}</p>
            <p>Offsets: −{formatCurrency(context.costBreakdown.offsets, context.currencyCode)}</p>
            <p className="font-bold">Financing cost: {formatCurrency(context.costBreakdown.financingCost, context.currencyCode)}</p>
            <p>Optional products: {formatCurrency(context.costBreakdown.optionalProducts, context.currencyCode)} · shown separately</p>
          </div>
        </TerminalCard>
      )}

      {!context.calculator.available && (
        <TerminalCard title="PARTIAL CALCULATION" icon={AlertTriangle} delay={0.3}>
          <p className="font-mono text-sm text-muted-foreground">
            {context.calculator.unsupportedReason
              ? context.calculator.unsupportedReason
              : context.calculator.label + " needs: " + context.calculator.missingInputs.join(", ") + "."}
          </p>
          <p className="font-mono text-[10px] text-muted-foreground mt-2">
            Findings still contribute to the risk score. Calculation-dependent results appear when their inputs are available.
          </p>
        </TerminalCard>
      )}

      {context.confidenceIssues.length > 0 && (
        <TerminalCard title="FIELDS TO VERIFY" icon={AlertTriangle} delay={0.32}>
          <ul className="space-y-1">
            {context.confidenceIssues.map((issue, index) => (
              <li key={index} className="font-mono text-xs text-muted-foreground">{issue}</li>
            ))}
          </ul>
        </TerminalCard>
      )}

      {context.itemGroups.length > 0 && (
        <TerminalCard title="EXPANDED ITEM LISTS" icon={FileWarning} delay={0.34}>
          {context.itemGroups.map((group) => (
            <div key={group.id} className="space-y-2 mb-4 last:mb-0">
              <div className="flex justify-between gap-3 font-mono text-xs">
                <span className="text-foreground">{group.label}</span>
                <span className="font-bold">{formatCurrency(group.aggregate, context.currencyCode)} total</span>
              </div>
              <ul className="space-y-1">
                {group.items.map((item, index) => (
                  <li key={group.id + ":" + index} className="flex justify-between gap-3 font-mono text-[11px] text-muted-foreground">
                    <span>{item.label || "Unclassified item"} · {item.source}</span>
                    <span className="shrink-0">{formatCurrency(item.amount, context.currencyCode)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </TerminalCard>
      )}

      {context.reconciliations.length > 0 && (
        <TerminalCard title="AMOUNT RECONCILIATION" icon={TrendingUp} delay={0.36}>
          <ul className="space-y-2">
            {context.reconciliations.map((check) => (
              <li key={check.id} className="font-mono text-xs">
                <span className={check.matched ? "text-primary" : "text-destructive"}>{check.expression} {check.matched ? "matches" : "does not match"}</span>
                {check.undisclosedItems.length > 0 && (
                  <p className="mt-1 text-muted-foreground">Stated but unquantified: {check.undisclosedItems.join(", ")}</p>
                )}
              </li>
            ))}
          </ul>
        </TerminalCard>
      )}

      {context.addOnImpact && (
        <TerminalCard title="FINANCED ADD-ON IMPACT" icon={TrendingUp} delay={0.38}>
          <p className="font-mono text-sm">
            {formatCurrency(context.addOnImpact.amount, context.currencyCode)} in listed add-ons adds about {formatCurrency(context.addOnImpact.paymentIncrease, context.currencyCode)} per month and {formatCurrency(context.addOnImpact.totalPaymentIncrease, context.currencyCode)} over the term, including {formatCurrency(context.addOnImpact.interestIncrease, context.currencyCode)} in additional interest.
          </p>
        </TerminalCard>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <TerminalCard title="RISK ASSESSMENT" icon={Shield} delay={0.35} className="flex flex-col">
          <div className="flex items-center justify-center py-2"><RiskMeter score={context.riskScore} band={context.riskBand} /></div>
          <p className="text-center font-mono text-[10px] text-muted-foreground mt-1">Risk from detected findings · extraction confidence: {Math.round(context.confidence * 100)}%</p>
          {context.riskBreakdown.length > 0 && (
            <ul className="mt-3 space-y-1 border-t border-border pt-2">
              {context.riskBreakdown.map((item) => (
                <li key={item.category} className="font-mono text-[10px] text-muted-foreground">
                  {item.category.replace(/_/g, " ")}: {item.points} points
                  {item.reasons.length > 0 && <ul className="mt-1 list-disc pl-4">{item.reasons.map((reason, index) => <li key={index}>{reason}</li>)}</ul>}
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

      {(!!context.aiInsights?.length || aiEnhancementStatus !== "ready") && (
        <TerminalCard title="AI INSIGHTS" icon={Brain} delay={0.72}>
          {aiEnhancementStatus === "loading" && (
            <p className="font-mono text-sm text-muted-foreground">Generating supplemental insights from the agreement…</p>
          )}
          {aiEnhancementStatus === "unconfigured" && !context.aiInsights?.length && (
            <p className="font-mono text-xs text-muted-foreground">OpenRouter is not configured for this build. Rule-based analysis is available.</p>
          )}
          {aiEnhancementStatus === "error" && !context.aiInsights?.length && (
            <p className="font-mono text-xs text-muted-foreground">AI insights could not be loaded. The rule-based analysis is still available.</p>
          )}
          {aiEnhancementStatus === "ready" && !context.aiInsights?.length && (
            <p className="font-mono text-xs text-muted-foreground">No additional AI observations were returned for this agreement.</p>
          )}
          <ul className="space-y-3">
            {(context.aiInsights ?? []).map((insight, i) => (
              <motion.li key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.72 + i * 0.08 }} className="flex items-start gap-3 font-mono text-sm">
                <span className="text-primary mt-0.5">▸</span><span className="text-foreground">{insight}</span>
              </motion.li>
            ))}
          </ul>
        </TerminalCard>
      )}

      {!!context.aiNegotiationStrategies?.length && (
        <TerminalCard title="AI NEGOTIATION PLAYBOOK" icon={Brain} delay={0.74}>
          <ul className="space-y-2">
            {context.aiNegotiationStrategies.map((strategy, i) => (
              <li key={i} className="flex items-start gap-3 font-mono text-sm">
                <span className="text-primary mt-0.5">▸</span><span className="text-foreground">{strategy}</span>
              </li>
            ))}
          </ul>
        </TerminalCard>
      )}

      {!!context.aiClausesToReview?.length && (
        <TerminalCard title="AI CLAUSES TO REVIEW" icon={FileWarning} delay={0.76} className="border-yellow-500/30">
          <ul className="space-y-2">
            {context.aiClausesToReview.map((clause, i) => (
              <li key={i} className="flex items-start gap-3 font-mono text-sm">
                <span className="text-yellow-500 mt-0.5">▸</span><span className="text-foreground">{clause}</span>
              </li>
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
