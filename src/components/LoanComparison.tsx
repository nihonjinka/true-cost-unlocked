import { useState } from "react";
import { motion } from "framer-motion";
import { GitCompareArrows, Play } from "lucide-react";
import { calculateEMI, formatCurrency } from "@/lib/financial";

export function LoanComparison() {
  const [loanA, setLoanA] = useState({ amount: 25000, rate: 24.99, duration: 36 });
  const [loanB, setLoanB] = useState({ amount: 25000, rate: 15, duration: 36 });
  const [compared, setCompared] = useState(false);

  const resultA = calculateEMI(loanA.amount, loanA.rate, loanA.duration);
  const resultB = calculateEMI(loanB.amount, loanB.rate, loanB.duration);

  const savings = resultA.totalPayment - resultB.totalPayment;

  const fields = [
    { label: "Amount ($)", key: "amount" as const },
    { label: "Rate (%)", key: "rate" as const },
    { label: "Months", key: "duration" as const },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.95 }}
      className="terminal-card"
    >
      <div className="flex items-center justify-between px-4 py-2 border-b border-border">
        <div className="flex items-center gap-2">
          <GitCompareArrows className="w-4 h-4 text-primary" />
          <span className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">LOAN COMPARISON</span>
        </div>
      </div>
      <div className="p-4 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          {/* Loan A */}
          <div className="space-y-3">
            <p className="font-mono text-[10px] tracking-widest text-destructive uppercase">LOAN A (CURRENT)</p>
            {fields.map((f) => (
              <div key={f.key}>
                <label className="block font-mono text-[9px] text-muted-foreground uppercase mb-1">{f.label}</label>
                <input
                  type="number"
                  step="any"
                  value={loanA[f.key]}
                  onChange={(e) => { setLoanA({ ...loanA, [f.key]: Number(e.target.value) }); setCompared(false); }}
                  className="w-full bg-background border border-border px-3 py-2 font-mono text-sm text-foreground focus:outline-none focus:border-primary/40"
                />
              </div>
            ))}
          </div>
          {/* Loan B */}
          <div className="space-y-3">
            <p className="font-mono text-[10px] tracking-widest text-primary uppercase">LOAN B (ALTERNATIVE)</p>
            {fields.map((f) => (
              <div key={f.key}>
                <label className="block font-mono text-[9px] text-muted-foreground uppercase mb-1">{f.label}</label>
                <input
                  type="number"
                  step="any"
                  value={loanB[f.key]}
                  onChange={(e) => { setLoanB({ ...loanB, [f.key]: Number(e.target.value) }); setCompared(false); }}
                  className="w-full bg-background border border-border px-3 py-2 font-mono text-sm text-foreground focus:outline-none focus:border-primary/40"
                />
              </div>
            ))}
          </div>
        </div>

        <button
          onClick={() => setCompared(true)}
          className="flex items-center gap-2 px-5 py-2 bg-primary text-primary-foreground font-mono text-[10px] tracking-widest uppercase terminal-glow"
        >
          <Play className="w-3 h-3" />
          COMPARE
        </button>

        {compared && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid grid-cols-2 gap-4 pt-2">
            <div className="bg-background border border-destructive/30 p-3 space-y-2">
              <p className="font-mono text-[10px] text-destructive uppercase">LOAN A</p>
              <p className="font-mono text-sm text-foreground">EMI: {formatCurrency(resultA.emi)}</p>
              <p className="font-mono text-sm text-foreground">Total: {formatCurrency(resultA.totalPayment)}</p>
              <p className="font-mono text-sm text-destructive">Interest: {formatCurrency(resultA.totalInterest)}</p>
            </div>
            <div className="bg-background border border-primary/30 p-3 space-y-2">
              <p className="font-mono text-[10px] text-primary uppercase">LOAN B</p>
              <p className="font-mono text-sm text-foreground">EMI: {formatCurrency(resultB.emi)}</p>
              <p className="font-mono text-sm text-foreground">Total: {formatCurrency(resultB.totalPayment)}</p>
              <p className="font-mono text-sm text-foreground">Interest: {formatCurrency(resultB.totalInterest)}</p>
            </div>
            {savings > 0 && (
              <div className="col-span-2 bg-primary/10 border border-primary/30 p-3 text-center">
                <p className="font-mono text-[10px] text-primary uppercase">POTENTIAL SAVINGS WITH LOAN B</p>
                <p className="font-display text-2xl font-bold text-primary">{formatCurrency(savings)}</p>
              </div>
            )}
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}
