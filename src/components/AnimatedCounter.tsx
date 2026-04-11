import { useEffect, useState } from "react";

interface Props {
  value: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  duration?: number;
  locale?: string;
}

export function AnimatedCounter({ value, prefix = "", suffix = "", decimals = 2, duration = 1.2, locale = "en-US" }: Props) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    const start = performance.now();
    const from = 0;
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
    <span
      key={value}
      className="count-pop font-mono font-bold tabular-nums"
    >
      {prefix}{display.toLocaleString(locale, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}{suffix}
    </span>
  );
}
