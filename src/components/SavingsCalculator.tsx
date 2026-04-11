import { useState } from "react";
import { motion } from "framer-motion";
import { PiggyBank, Play } from "lucide-react";
import { calculateEMI, formatCurrency, getCurrencyLocale, getCurrencySymbol, type SupportedCurrency } from "@/lib/financial";
import { AnimatedCounter } from "./AnimatedCounter";

interface Props {
  principal: number;
  annualRate: number;
  tenureMonths: number;
  totalInterest: number;
  currencyCode?: SupportedCurrency;
}

export function SavingsCalculator({ principal, annualRate, tenureMonths, totalInterest, currencyCode = "USD" }: Props) {
  const [extraMonthly, setExtraMonthly] = useState(100);
  const [calculated, setCalculated] = useState(false);
  const currencySymbol = getCurrencySymbol(currencyCode);
  const currencyLocale = getCurrencyLocale(currencyCode);

  // Calculate how early you can pay off with extra payments
  const r = annualRate / 12 / 100;
  const originalEMI = calculateEMI(principal, annualRate, tenureMonths).emi;
  const newEMI = originalEMI + extraMonthly;

  let balance = principal;
  let months = 0;
  let totalPaidNew = 0;

  while (balance > 0 && months < tenureMonths * 2) {
    const interestComponent = balance * r;
    const principalComponent = Math.min(newEMI - interestComponent, balance);
    if (principalComponent <= 0) break;
    balance -= principalComponent;
    totalPaidNew += newEMI;
    months++;
  }

  const newTotalInterest = totalPaidNew - principal;
  const interestSaved = totalInterest - newTotalInterest;
  const monthsSaved = tenureMonths - months;

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 1.0 }}
      className="terminal-card"
    >
      <div className="flex items-center justify-between px-4 py-2 border-b border-border">
        <div className="flex items-center gap-2">
          <PiggyBank className="w-4 h-4 text-primary" />
          <span className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">EARLY REPAYMENT SAVINGS</span>
        </div>
      </div>
      <div className="p-4 space-y-4">
        <div>
          <label className="block font-mono text-[10px] tracking-widest text-muted-foreground uppercase mb-2">
            Extra Monthly Payment
          </label>
          <div className="flex items-center gap-4">
            <input
              type="range"
              min={50}
              max={Math.max(originalEMI * 2, 500)}
              step={25}
              value={extraMonthly}
              onChange={(e) => { setExtraMonthly(Number(e.target.value)); setCalculated(false); }}
              className="flex-1 accent-primary"
            />
            <span className="font-mono text-sm text-foreground w-20 text-right">{formatCurrency(extraMonthly, currencyCode)}</span>
          </div>
        </div>

        <button
          onClick={() => setCalculated(true)}
          className="flex items-center gap-2 px-5 py-2 bg-primary text-primary-foreground font-mono text-[10px] tracking-widest uppercase terminal-glow"
        >
          <Play className="w-3 h-3" />
          CALCULATE SAVINGS
        </button>

        {calculated && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
            <div className="bg-background border border-primary/30 p-3">
              <p className="font-mono text-[10px] text-muted-foreground uppercase">Interest Saved</p>
              <p className="font-display text-lg font-bold text-primary">
                <AnimatedCounter value={Math.max(interestSaved, 0)} prefix={currencySymbol} locale={currencyLocale} />
              </p>
            </div>
            <div className="bg-background border border-primary/30 p-3">
              <p className="font-mono text-[10px] text-muted-foreground uppercase">Months Saved</p>
              <p className="font-display text-lg font-bold text-primary">{Math.max(monthsSaved, 0)}</p>
            </div>
            <div className="bg-background border border-primary/30 p-3">
              <p className="font-mono text-[10px] text-muted-foreground uppercase">New Duration</p>
              <p className="font-display text-lg font-bold text-foreground">{months} months</p>
              <p className="font-mono text-[10px] text-muted-foreground">vs {tenureMonths} original</p>
            </div>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}
