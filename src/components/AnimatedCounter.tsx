import { useEffect, useState } from "react";
import { motion } from "framer-motion";

interface Props {
  value: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  duration?: number;
}

export function AnimatedCounter({ value, prefix = "", suffix = "", decimals = 2, duration = 1.2 }: Props) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    const start = performance.now();
    const from = display;
    const to = value;

    function tick(now: number) {
      const elapsed = (now - start) / (duration * 1000);
      if (elapsed >= 1) {
        setDisplay(to);
        return;
      }
      const eased = 1 - Math.pow(1 - elapsed, 3);
      setDisplay(from + (to - from) * eased);
      requestAnimationFrame(tick);
    }

    requestAnimationFrame(tick);
  }, [value, duration]);

  return (
    <motion.span
      key={value}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="font-display font-bold tabular-nums"
    >
      {prefix}{display.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}{suffix}
    </motion.span>
  );
}
