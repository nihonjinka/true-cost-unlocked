import { motion } from "framer-motion";

interface Props {
  score: number; // 0-100
}

export function RiskMeter({ score }: Props) {
  const getColor = () => {
    if (score < 30) return "hsl(142, 76%, 45%)";
    if (score < 60) return "hsl(45, 93%, 50%)";
    return "hsl(0, 72%, 55%)";
  };

  const getLabel = () => {
    if (score < 30) return "Low Risk";
    if (score < 60) return "Medium Risk";
    return "High Risk";
  };

  const rotation = (score / 100) * 180 - 90;

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative w-48 h-24 overflow-hidden">
        {/* Background arc */}
        <div className="absolute inset-0 rounded-t-full border-[12px] border-muted" style={{ borderBottom: "none" }} />
        {/* Colored arc overlay */}
        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 200 100">
          <defs>
            <linearGradient id="riskGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="hsl(142, 76%, 45%)" />
              <stop offset="50%" stopColor="hsl(45, 93%, 50%)" />
              <stop offset="100%" stopColor="hsl(0, 72%, 55%)" />
            </linearGradient>
          </defs>
          <path
            d="M 12 100 A 88 88 0 0 1 188 100"
            fill="none"
            stroke="url(#riskGrad)"
            strokeWidth="12"
            strokeLinecap="round"
            opacity="0.3"
          />
        </svg>
        {/* Needle */}
        <motion.div
          className="absolute bottom-0 left-1/2 origin-bottom"
          style={{ width: 3, height: 80, marginLeft: -1.5 }}
          initial={{ rotate: -90 }}
          animate={{ rotate: rotation }}
          transition={{ type: "spring", stiffness: 60, damping: 15 }}
        >
          <div className="w-full h-full rounded-full" style={{ backgroundColor: getColor() }} />
        </motion.div>
        {/* Center dot */}
        <div className="absolute bottom-0 left-1/2 w-4 h-4 -ml-2 -mb-2 rounded-full bg-foreground" />
      </div>
      <div className="text-center">
        <motion.span
          key={score}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-2xl font-display font-bold"
          style={{ color: getColor() }}
        >
          {score}/100
        </motion.span>
        <p className="text-sm text-muted-foreground font-medium">{getLabel()}</p>
      </div>
    </div>
  );
}
