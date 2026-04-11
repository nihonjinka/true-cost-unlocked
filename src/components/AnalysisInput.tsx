import { useState } from "react";
import { motion } from "framer-motion";
import { FileText, Sparkles, Play, RotateCcw } from "lucide-react";
import { GlassCard } from "./GlassCard";
import { DEMO_TEXT, DEMO_LOAN } from "@/lib/financial";

interface AnalysisInputProps {
  onAnalyze: (text: string, amount: number, rate: number, duration: number) => void;
  isLoading: boolean;
}

export function AnalysisInput({ onAnalyze, isLoading }: AnalysisInputProps) {
  const [text, setText] = useState("");
  const [amount, setAmount] = useState<number | "">("");
  const [rate, setRate] = useState<number | "">("");
  const [duration, setDuration] = useState<number | "">("");

  const loadDemo = () => {
    setText(DEMO_TEXT);
    setAmount(DEMO_LOAN.amount);
    setRate(DEMO_LOAN.rate);
    setDuration(DEMO_LOAN.duration);
  };

  const reset = () => {
    setText("");
    setAmount("");
    setRate("");
    setDuration("");
  };

  const canAnalyze = text.trim().length > 0 && Number(amount) > 0 && Number(rate) >= 0 && Number(duration) > 0;

  return (
    <GlassCard className="w-full" delay={0.1}>
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 rounded-xl bg-primary/10">
          <FileText className="w-5 h-5 text-primary" />
        </div>
        <h2 className="text-xl font-display font-bold text-foreground">Document Analysis</h2>
      </div>

      <div className="space-y-5">
        <div>
          <label className="block text-sm font-medium text-muted-foreground mb-2">
            Paste your financial/legal text
          </label>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={6}
            placeholder="Paste loan agreement, credit card terms, BNPL contract..."
            className="w-full rounded-xl bg-muted/50 border border-border/50 px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none transition-all"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-2">Loan Amount ($)</label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value ? Number(e.target.value) : "")}
              placeholder="25000"
              className="w-full rounded-xl bg-muted/50 border border-border/50 px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-2">Interest Rate (%)</label>
            <input
              type="number"
              step="0.01"
              value={rate}
              onChange={(e) => setRate(e.target.value ? Number(e.target.value) : "")}
              placeholder="24.99"
              className="w-full rounded-xl bg-muted/50 border border-border/50 px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-2">Duration (months)</label>
            <input
              type="number"
              value={duration}
              onChange={(e) => setDuration(e.target.value ? Number(e.target.value) : "")}
              placeholder="36"
              className="w-full rounded-xl bg-muted/50 border border-border/50 px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all"
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-3 pt-2">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            disabled={!canAnalyze || isLoading}
            onClick={() => onAnalyze(text, Number(amount), Number(rate), Number(duration))}
            className="flex items-center gap-2 px-6 py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all neon-glow"
          >
            <Play className="w-4 h-4" />
            {isLoading ? "Analyzing..." : "Analyze"}
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={loadDemo}
            className="flex items-center gap-2 px-6 py-3 rounded-xl bg-secondary/15 text-secondary font-semibold text-sm border border-secondary/30 hover:bg-secondary/25 transition-all"
          >
            <Sparkles className="w-4 h-4" />
            Load Demo
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={reset}
            className="flex items-center gap-2 px-5 py-3 rounded-xl text-muted-foreground hover:text-foreground font-medium text-sm transition-all"
          >
            <RotateCcw className="w-4 h-4" />
            Reset
          </motion.button>
        </div>
      </div>
    </GlassCard>
  );
}
