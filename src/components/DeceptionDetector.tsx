import { motion } from "framer-motion";
import { Eye, AlertTriangle } from "lucide-react";

export interface DeceptionResult {
  urgencyTactics: string[];
  fakeDiscounts: string[];
  emotionalManipulation: string[];
}

interface Props {
  deception: DeceptionResult;
}

export function DeceptionDetector({ deception }: Props) {
  const totalFlags = deception.urgencyTactics.length + deception.fakeDiscounts.length + deception.emotionalManipulation.length;
  if (totalFlags === 0) return null;

  const sections = [
    { label: "URGENCY TACTICS", items: deception.urgencyTactics, color: "text-destructive" },
    { label: "FAKE DISCOUNTS", items: deception.fakeDiscounts, color: "text-yellow-500" },
    { label: "EMOTIONAL MANIPULATION", items: deception.emotionalManipulation, color: "text-orange-500" },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.75 }}
      className="terminal-card"
    >
      <div className="flex items-center justify-between px-4 py-2 border-b border-border">
        <div className="flex items-center gap-2">
          <Eye className="w-4 h-4 text-destructive" />
          <span className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">DECEPTION DETECTION</span>
        </div>
        <span className="font-mono text-[10px] font-semibold text-destructive">{totalFlags} FLAGS</span>
      </div>
      <div className="p-4 space-y-4">
        {sections.map(({ label, items, color }) =>
          items.length > 0 ? (
            <div key={label}>
              <p className={`font-mono text-[10px] tracking-widest uppercase mb-2 ${color}`}>{label}</p>
              <ul className="space-y-1">
                {items.map((item, i) => (
                  <motion.li
                    key={i}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.75 + i * 0.05 }}
                    className="flex items-start gap-2 font-mono text-sm"
                  >
                    <AlertTriangle className={`w-3 h-3 mt-1 flex-shrink-0 ${color}`} />
                    <span className="text-foreground">{item}</span>
                  </motion.li>
                ))}
              </ul>
            </div>
          ) : null
        )}
      </div>
    </motion.div>
  );
}
