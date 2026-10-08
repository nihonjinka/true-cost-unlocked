import { motion } from "framer-motion";

interface Props {
  score: number;
  band?: "low" | "medium" | "high" | "incomplete_analysis";
}

export function RiskMeter({ score, band }: Props) {
  const getColor = () => {
    if (band === "incomplete_analysis") return "hsl(var(--muted-foreground))";
    if (score < 30) return "hsl(68, 100%, 45%)";
    if (score < 60) return "hsl(45, 93%, 50%)";
    return "hsl(0, 72%, 55%)";
  };

  const getLabel = () => {
    if (band === "incomplete_analysis") return "INCOMPLETE ANALYSIS";
    if (score < 30) return "LOW RISK";
    if (score < 60) return "MEDIUM RISK";
    return "HIGH RISK";
  };

  const rotation = (score / 100) * 180 - 90;

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative w-48 h-24 overflow-hidden">
        <div className="absolute inset-0 rounded-t-full border-[10px] border-border" style={{ borderBottom: "none" }} />
        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 200 100">
          <defs>
            <linearGradient id="riskGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="hsl(68, 100%, 45%)" />
              <stop offset="50%" stopColor="hsl(45, 93%, 50%)" />
              <stop offset="100%" stopColor="hsl(0, 72%, 55%)" />
            </linearGradient>
          </defs>
          <path d="M 12 100 A 88 88 0 0 1 188 100" fill="none" stroke="url(#riskGrad)" strokeWidth="10" strokeLinecap="round" opacity="0.25" />
        </svg>
        <motion.div
          className="absolute bottom-0 left-1/2 origin-bottom"
          style={{ width: 2, height: 75, marginLeft: -1 }}
          initial={{ rotate: -90 }}
          animate={{ rotate: rotation }}
          transition={{ type: "spring", stiffness: 60, damping: 15 }}
        >
          <div className="w-full h-full" style={{ backgroundColor: getColor() }} />
        </motion.div>
        <div className="absolute bottom-0 left-1/2 w-3 h-3 -ml-1.5 -mb-1.5 rounded-full bg-foreground" />
      </div>
      <div className="text-center">
        <motion.span
          key={score}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-2xl font-mono font-bold"
          style={{ color: getColor() }}
        >
          {band === "incomplete_analysis" ? "≥" : ""}{score}/100
        </motion.span>
        <p className="font-mono text-[10px] tracking-widest text-muted-foreground mt-1">{getLabel()}</p>
        {band === "incomplete_analysis" && <p className="font-mono text-[10px] text-muted-foreground">At least {score} points from detected findings</p>}
      </div>
    </div>
  );
}
