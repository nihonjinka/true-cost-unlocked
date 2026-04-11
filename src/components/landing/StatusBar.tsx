import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";

export function StatusBar() {
  const [time, setTime] = useState("");

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setTime(
        now.toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" })
      );
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 sm:px-6 py-2 border-b border-border bg-background/90 backdrop-blur-sm">
      <div className="flex items-center gap-4 font-mono text-[11px] tracking-widest uppercase text-muted-foreground">
        <span className="flex items-center gap-2">
          <span className="status-dot animate-pulse-dot" />
          SYS.ONLINE
        </span>
        <span className="hidden sm:inline">LATENCY: 8MS</span>
        <span className="hidden sm:inline">NODE: TC-01</span>
      </div>
      <div className="flex items-center gap-4 font-mono text-[11px] tracking-widest uppercase text-muted-foreground">
        <span>{time}</span>
        <Link to="/analyze" className="border border-primary/40 px-3 py-1 text-primary hover:bg-primary/10 transition-colors">
          ANALYZE <ArrowUpRight className="inline w-3 h-3" />
        </Link>
      </div>
    </div>
  );
}
