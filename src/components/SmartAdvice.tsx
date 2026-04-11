import { motion } from "framer-motion";
import { Lightbulb, ThumbsUp, ThumbsDown, Minus } from "lucide-react";

export interface AdviceResult {
  recommendation: "take" | "avoid" | "caution";
  reasons: string[];
  alternatives: string[];
  tips: string[];
}

interface Props {
  advice: AdviceResult;
}

export function SmartAdvice({ advice }: Props) {
  const iconMap = {
    take: { Icon: ThumbsUp, color: "text-green-500", label: "GENERALLY SAFE" },
    avoid: { Icon: ThumbsDown, color: "text-destructive", label: "AVOID" },
    caution: { Icon: Minus, color: "text-yellow-500", label: "PROCEED WITH CAUTION" },
  };
  const { Icon, color, label } = iconMap[advice.recommendation];

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.9 }}
      className="terminal-card"
    >
      <div className="flex items-center justify-between px-4 py-2 border-b border-border">
        <div className="flex items-center gap-2">
          <Lightbulb className="w-4 h-4 text-primary" />
          <span className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">SMART AI ADVICE</span>
        </div>
        <div className={`flex items-center gap-1 font-mono text-[10px] font-semibold ${color}`}>
          <Icon className="w-3 h-3" />
          {label}
        </div>
      </div>
      <div className="p-4 space-y-4">
        <div>
          <p className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase mb-2">REASONING</p>
          <ul className="space-y-1">
            {advice.reasons.map((r, i) => (
              <li key={i} className="flex items-start gap-2 font-mono text-sm">
                <span className="text-primary mt-0.5">▸</span>
                <span className="text-foreground">{r}</span>
              </li>
            ))}
          </ul>
        </div>
        {advice.alternatives.length > 0 && (
          <div>
            <p className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase mb-2">SAFER ALTERNATIVES</p>
            <ul className="space-y-1">
              {advice.alternatives.map((a, i) => (
                <li key={i} className="flex items-start gap-2 font-mono text-sm">
                  <span className="text-green-500 mt-0.5">◆</span>
                  <span className="text-foreground">{a}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        <div>
          <p className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase mb-2">FINANCIAL TIPS</p>
          <ul className="space-y-1">
            {advice.tips.map((t, i) => (
              <li key={i} className="flex items-start gap-2 font-mono text-sm">
                <span className="text-yellow-500 mt-0.5">★</span>
                <span className="text-foreground">{t}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </motion.div>
  );
}
