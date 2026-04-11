import { useState } from "react";
import { motion } from "framer-motion";
import { Table, ChevronDown, ChevronUp } from "lucide-react";
import { formatCurrency, generateAmortizationSchedule, type SupportedCurrency } from "@/lib/financial";

interface Props {
  principal: number;
  annualRate: number;
  tenureMonths: number;
  currencyCode?: SupportedCurrency;
}

export function AmortizationTable({ principal, annualRate, tenureMonths, currencyCode = "USD" }: Props) {
  const [expanded, setExpanded] = useState(false);
  const schedule = generateAmortizationSchedule(principal, annualRate, tenureMonths);
  const displayRows = expanded ? schedule : schedule.slice(0, 6);

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.85 }}
      className="terminal-card"
    >
      <div className="flex items-center justify-between px-4 py-2 border-b border-border">
        <div className="flex items-center gap-2">
          <Table className="w-4 h-4 text-primary" />
          <span className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">MONTHLY AMORTIZATION</span>
        </div>
        <span className="font-mono text-[10px] text-muted-foreground">{tenureMonths} MONTHS</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full font-mono text-xs">
          <thead>
            <tr className="border-b border-border text-muted-foreground">
              <th className="text-left px-4 py-2">Month</th>
              <th className="text-right px-4 py-2">EMI</th>
              <th className="text-right px-4 py-2">Principal</th>
              <th className="text-right px-4 py-2">Interest</th>
              <th className="text-right px-4 py-2">Balance</th>
            </tr>
          </thead>
          <tbody>
            {displayRows.map((row) => (
              <tr key={row.month} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                <td className="px-4 py-2 text-foreground">{row.month}</td>
                <td className="px-4 py-2 text-right text-foreground">{formatCurrency(row.emi, currencyCode)}</td>
                <td className="px-4 py-2 text-right text-primary">{formatCurrency(row.principalPaid, currencyCode)}</td>
                <td className="px-4 py-2 text-right text-destructive">{formatCurrency(row.interestPaid, currencyCode)}</td>
                <td className="px-4 py-2 text-right text-muted-foreground">{formatCurrency(row.remainingBalance, currencyCode)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {schedule.length > 6 && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center justify-center gap-2 py-3 font-mono text-[10px] tracking-widest text-primary hover:text-foreground transition-colors border-t border-border"
        >
          {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          {expanded ? "COLLAPSE" : `SHOW ALL ${schedule.length} MONTHS`}
        </button>
      )}
    </motion.div>
  );
}
