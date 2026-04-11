import { useState } from "react";
import { motion } from "framer-motion";
import { FileText, Sparkles, Play, RotateCcw } from "lucide-react";
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
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
      className="terminal-card p-6"
    >
      <div className="flex items-center gap-3 mb-6 border-b border-border pb-4">
        <FileText className="w-5 h-5 text-primary" />
        <span className="font-mono text-[11px] tracking-widest text-muted-foreground uppercase">DOCUMENT INPUT</span>
      </div>

      <div className="space-y-5">
        <div>
          <label className="block font-mono text-[10px] tracking-widest text-muted-foreground uppercase mb-2">
            Financial / Legal Text
          </label>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={6}
            placeholder="Paste loan agreement, credit card terms, BNPL contract..."
            className="w-full bg-background border border-border px-4 py-3 font-mono text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/40 resize-none transition-colors"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { label: "Loan Amount ($)", value: amount, set: setAmount, ph: "25000" },
            { label: "Interest Rate (%)", value: rate, set: setRate, ph: "24.99" },
            { label: "Duration (months)", value: duration, set: setDuration, ph: "36" },
          ].map((field) => (
            <div key={field.label}>
              <label className="block font-mono text-[10px] tracking-widest text-muted-foreground uppercase mb-2">
                {field.label}
              </label>
              <input
                type="number"
                step="any"
                value={field.value}
                onChange={(e) => field.set(e.target.value ? Number(e.target.value) : "")}
                placeholder={field.ph}
                className="w-full bg-background border border-border px-4 py-3 font-mono text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/40 transition-colors"
              />
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-3 pt-2">
          <motion.button
            whileTap={{ scale: 0.97 }}
            disabled={!canAnalyze || isLoading}
            onClick={() => onAnalyze(text, Number(amount), Number(rate), Number(duration))}
            className="flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground font-mono text-[11px] tracking-widest uppercase disabled:opacity-40 disabled:cursor-not-allowed transition-all terminal-glow"
          >
            <Play className="w-4 h-4" />
            {isLoading ? "PROCESSING..." : "ANALYZE"}
          </motion.button>

          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={loadDemo}
            className="flex items-center gap-2 px-6 py-3 border border-primary/30 text-primary font-mono text-[11px] tracking-widest uppercase hover:bg-primary/5 transition-all"
          >
            <Sparkles className="w-4 h-4" />
            LOAD DEMO
          </motion.button>

          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={reset}
            className="flex items-center gap-2 px-5 py-3 text-muted-foreground hover:text-foreground font-mono text-[11px] tracking-widest uppercase transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            RESET
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
}
