import { useState } from "react";
import { motion } from "framer-motion";
import { Table, ChevronDown, ChevronUp } from "lucide-react";
import { formatCurrency, generateAmortizationSchedule } from "@/lib/financial";
import type { AnalysisContext } from "@/lib/analysisContext";

interface Props { context: AnalysisContext }

export function AmortizationTable({ context }: Props) {
  const [expanded, setExpanded] = useState(false);
  const principal = context.principal;
  const rate = context.rateField.value;
  const tenureMonths = context.termField.value;
  if (!context.financialMetricsAvailable || principal === null || rate === null || tenureMonths === null || context.rateField.rateType !== "reducing") return null;
  const schedule = generateAmortizationSchedule(principal, rate, tenureMonths);
  const displayRows = expanded ? schedule : schedule.slice(0, 6);

  return (
    <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.85 }} className="terminal-card">
      <div className="flex items-center justify-between px-4 py-2 border-b border-border">
        <div className="flex items-center gap-2"><Table className="w-4 h-4 text-primary" />
          <span className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">MONTHLY AMORTIZATION</span></div>
        <span className="font-mono text-[10px] text-muted-foreground">{tenureMonths} MONTHS</span>
      </div>
      <p className="px-4 pt-3 font-mono text-[10px] text-muted-foreground">Principal and interest schedule; modeled fees are shown in the analysis summary.</p>
      <div className="overflow-x-auto">
        <table className="w-full font-mono text-xs">
          <thead><tr className="border-b border-border text-muted-foreground">
            <th className="text-left px-4 py-2">Month</th><th className="text-right px-4 py-2">Payment</th>
            <th className="text-right px-4 py-2">Principal</th><th className="text-right px-4 py-2">Interest</th>
            <th className="text-right px-4 py-2">Balance</th>
          </tr></thead>
          <tbody>{displayRows.map((row) => (
            <tr key={row.month} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
              <td className="px-4 py-2 text-foreground">{row.month}</td>
              <td className="px-4 py-2 text-right text-foreground">{formatCurrency(row.emi, context.currencyCode)}</td>
              <td className="px-4 py-2 text-right text-primary">{formatCurrency(row.principalPaid, context.currencyCode)}</td>
              <td className="px-4 py-2 text-right text-destructive">{formatCurrency(row.interestPaid, context.currencyCode)}</td>
              <td className="px-4 py-2 text-right text-muted-foreground">{formatCurrency(row.remainingBalance, context.currencyCode)}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>
      {schedule.length > 6 && (
        <button onClick={() => setExpanded(!expanded)} className="w-full flex items-center justify-center gap-2 py-3 font-mono text-[10px] tracking-widest text-primary hover:text-foreground transition-colors border-t border-border">
          {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          {expanded ? "COLLAPSE" : "SHOW ALL " + schedule.length + " MONTHS"}
        </button>
      )}
    </motion.div>
  );
}
