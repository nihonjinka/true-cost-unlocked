import { Link } from "react-router-dom";

export function Navbar() {
  return (
    <nav className="flex items-center justify-between px-4 sm:px-8 py-5 mt-8">
      <div className="flex items-center gap-3">
        <span className="font-display text-xl font-bold text-foreground tracking-tight">TRUE COST</span>
        <span className="font-mono text-[10px] border border-border px-2 py-0.5 text-muted-foreground">T-OS</span>
      </div>

      <div className="hidden md:flex items-center gap-8 font-mono text-[11px] tracking-widest uppercase text-muted-foreground">
        <a href="#features" className="hover:text-primary transition-colors">
          <span className="text-primary/50 mr-1">01</span> FEATURES
        </a>
        <a href="#architecture" className="hover:text-primary transition-colors">
          <span className="text-primary/50 mr-1">02</span> ARCHITECTURE
        </a>
        <a href="#pricing" className="hover:text-primary transition-colors">
          <span className="text-primary/50 mr-1">03</span> PRICING
        </a>
      </div>

      <Link
        to="/analyze"
        className="font-mono text-[11px] tracking-widest uppercase px-6 py-3 border border-foreground text-foreground hover:bg-foreground hover:text-background transition-all"
      >
        LAUNCH ANALYZER
      </Link>
    </nav>
  );
}
