import { useState } from "react";
import { motion } from "framer-motion";
import { PiggyBank, Play } from "lucide-react";
import { calculateEMI, formatCurrency } from "@/lib/financial";
import type { AnalysisContext } from "@/lib/analysisContext";

interface Props { context: AnalysisContext }

export function SavingsCalculator({ context }: Props) {
  const [extraMonthly, setExtraMonthly] = useState<number | "">("");
  const [calculated, setCalculated] = useState(false);
  const principal = context.principal;
  const annualRate = context.rateField.value;
  const tenureMonths = context.termField.value;
  const totalInterest = context.totalInterest;
  if (!context.financialMetricsAvailable || principal === null || annualRate === null || tenureMonths === null || totalInterest === null) return null;

  const base = calculateEMI(principal, annualRate, tenureMonths);
  if (!base) return null;
  const additional = extraMonthly === "" ? 0 : extraMonthly;
  const monthlyRate = annualRate / 1200;
  let balance = principal;
  let months = 0;
  let newInterest = 0;
  while (balance > 0.005 && months < 1200) {
    const interest = balance * monthlyRate;
    const payment = Math.min(base.emi + additional, balance + interest);
    if (payment <= interest) break;
    balance = Math.max(0, balance + interest - payment);
    newInterest += interest;
    months++;
  }
  const interestSaved = Math.min(totalInterest, Math.max(0, totalInterest - newInterest));
  const monthsSaved = Math.max(0, Math.ceil(tenureMonths) - months);

  return (
    <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.0 }} className="terminal-card">
      <div className="flex items-center justify-between px-4 py-2 border-b border-border">
        <div className="flex items-center gap-2"><PiggyBank className="w-4 h-4 text-primary" />
          <span className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">EARLY REPAYMENT SCENARIO</span></div>
      </div>
      <div className="p-4 space-y-4">
        <div>
          <label className="block font-mono text-[10px] tracking-widest text-muted-foreground uppercase mb-2">Extra monthly payment (your assumption)</label>
          <input type="number" min="0" step="any" value={extraMonthly}
            onChange={(event) => { setExtraMonthly(event.target.value === "" ? "" : Number(event.target.value)); setCalculated(false); }}
            placeholder="Enter an amount" className="w-full bg-background border border-border px-3 py-2 font-mono text-sm text-foreground" />
        </div>
        <p className="font-mono text-[10px] text-muted-foreground">Estimate uses the extracted principal and rate, excludes separate fees, and assumes extra payments reduce principal each month.</p>
        <button onClick={() => setCalculated(true)} disabled={additional <= 0}
          className="interactive-button flex items-center gap-2 px-5 py-2 bg-primary text-primary-foreground font-mono text-[10px] tracking-widest uppercase terminal-glow disabled:opacity-40">
          <Play className="w-3 h-3" /> CALCULATE SAVINGS
        </button>
        {calculated && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
            <div className="bg-background border border-primary/30 p-3"><p className="font-mono text-[10px] text-muted-foreground uppercase">Estimated Interest Saved</p>
              <p className="font-mono text-lg font-bold text-primary">{formatCurrency(interestSaved, context.currencyCode)}</p></div>
            <div className="bg-background border border-primary/30 p-3"><p className="font-mono text-[10px] text-muted-foreground uppercase">Months Saved</p>
              <p className="font-mono text-lg font-bold text-primary">{monthsSaved}</p></div>
            <div className="bg-background border border-primary/30 p-3"><p className="font-mono text-[10px] text-muted-foreground uppercase">Estimated New Term</p>
              <p className="font-mono text-lg font-bold text-foreground">{months} months</p><p className="font-mono text-[10px] text-muted-foreground">vs {tenureMonths} months</p></div>
          </div>
        )}
      </div>
    </motion.div>
  );
}
