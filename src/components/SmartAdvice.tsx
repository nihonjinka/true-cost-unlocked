import { motion } from "framer-motion";
import { Lightbulb, AlertTriangle, Minus } from "lucide-react";
import type { AnalysisContext } from "@/lib/analysisContext";

interface Props {
  context: AnalysisContext;
}

export function SmartAdvice({ context }: Props) {
  const iconByStatus = {
    review_required: { Icon: AlertTriangle, color: "text-destructive", label: "REVIEW TERMS" },
    no_material_flags: { Icon: Minus, color: "text-muted-foreground", label: "NO CONFIGURED FLAGS" },
    insufficient_confidence: { Icon: AlertTriangle, color: "text-yellow-500", label: "INSUFFICIENT CONFIDENCE" },
  } as const;
  const { Icon, color, label } = iconByStatus[context.advice.recommendation];

  return (
    <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.9 }} className="terminal-card">
      <div className="flex items-center justify-between px-4 py-2 border-b border-border">
        <div className="flex items-center gap-2">
          <Lightbulb className="w-4 h-4 text-primary" />
          <span className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">RULE-BASED REVIEW</span>
        </div>
        <div className={`flex items-center gap-1 font-mono text-[10px] font-semibold ${color}`}>
          <Icon className="w-3 h-3" />{label}
        </div>
      </div>
      <div className="p-4">
        <p className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase mb-2">EVIDENCE</p>
        <ul className="space-y-1">
          {context.advice.reasons.map((reason, i) => (
            <li key={i} className="flex items-start gap-2 font-mono text-sm">
              <span className="text-primary mt-0.5">▸</span><span className="text-foreground">{reason}</span>
            </li>
          ))}
        </ul>
      </div>
    </motion.div>
  );
}
