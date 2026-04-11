import { useState } from "react";
import { motion } from "framer-motion";
import { AlertOctagon } from "lucide-react";
import { formatCurrency, getCurrencyLocale, getCurrencySymbol, type SupportedCurrency } from "@/lib/financial";
import { AnimatedCounter } from "./AnimatedCounter";

interface Props {
  principal: number;
  emi: number;
  totalPayment: number;
  totalInterest: number;
  durationMonths: number;
  currencyCode?: SupportedCurrency;
}

export function WorstCaseSimulator({ principal, emi, totalPayment, totalInterest, durationMonths, currencyCode = "USD" }: Props) {
  const [lateFeePercent, setLateFeePercent] = useState(5);
  const [missedPayments, setMissedPayments] = useState(3);
  const currencySymbol = getCurrencySymbol(currencyCode);
  const currencyLocale = getCurrencyLocale(currencyCode);

  const lateFeePerOccurrence = emi * (lateFeePercent / 100);
  const totalLateFees = lateFeePerOccurrence * missedPayments;
  const worstCaseTotal = totalPayment + totalLateFees;
  const increasePercent = ((worstCaseTotal - totalPayment) / totalPayment) * 100;

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.8 }}
      className="terminal-card"
    >
      <div className="flex items-center justify-between px-4 py-2 border-b border-border">
        <div className="flex items-center gap-2">
          <AlertOctagon className="w-4 h-4 text-destructive" />
          <span className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">WORST-CASE SCENARIO</span>
        </div>
        <span className="font-mono text-[10px] font-semibold text-destructive">SIMULATOR</span>
      </div>
      <div className="p-4 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block font-mono text-[10px] tracking-widest text-muted-foreground uppercase mb-2">
              Late Fee (% of EMI)
            </label>
            <input
              type="range"
              min={1}
              max={25}
              value={lateFeePercent}
              onChange={(e) => setLateFeePercent(Number(e.target.value))}
              className="w-full accent-destructive"
            />
            <span className="font-mono text-sm text-foreground">{lateFeePercent}%</span>
          </div>
          <div>
            <label className="block font-mono text-[10px] tracking-widest text-muted-foreground uppercase mb-2">
              Missed Payments
            </label>
            <input
              type="range"
              min={1}
              max={durationMonths}
              value={missedPayments}
              onChange={(e) => setMissedPayments(Number(e.target.value))}
              className="w-full accent-destructive"
            />
            <span className="font-mono text-sm text-foreground">{missedPayments} months</span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
          <div className="bg-background border border-border p-3">
            <p className="font-mono text-[10px] text-muted-foreground uppercase">Late Fee / Occurrence</p>
            <p className="font-display text-lg font-bold text-destructive">{formatCurrency(lateFeePerOccurrence, currencyCode)}</p>
          </div>
          <div className="bg-background border border-border p-3">
            <p className="font-mono text-[10px] text-muted-foreground uppercase">Total Late Fees</p>
            <p className="font-display text-lg font-bold text-destructive">{formatCurrency(totalLateFees, currencyCode)}</p>
          </div>
          <div className="bg-background border border-border p-3">
            <p className="font-mono text-[10px] text-muted-foreground uppercase">Worst-Case Total</p>
            <p className="font-display text-lg font-bold text-destructive">
              <AnimatedCounter value={worstCaseTotal} prefix={currencySymbol} locale={currencyLocale} />
            </p>
            <p className="font-mono text-[10px] text-destructive/70">+{increasePercent.toFixed(1)}% increase</p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
