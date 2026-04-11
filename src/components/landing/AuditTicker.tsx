import { motion } from "framer-motion";

const partners = [
  "CONSUMER FINANCIAL PROTECTION BUREAU: INTEGRATED",
  "SEC EDGAR: VERIFIED",
  "FDIC COMPLIANCE: ACTIVE",
  "OCC STANDARDS: VERIFIED",
  "FCA REGULATORY: ACTIVE",
  "ISO 27001: CERTIFIED",
];

export function AuditTicker() {
  const items = [...partners, ...partners];

  return (
    <div className="relative border-y border-border bg-card/50 py-2 overflow-hidden">
      <div className="flex items-center gap-8 whitespace-nowrap" style={{ animation: "ticker-scroll 40s linear infinite" }}>
        {items.map((item, i) => (
          <span key={i} className="font-mono text-[11px] tracking-wider text-muted-foreground flex items-center gap-3">
            <span className="text-primary font-bold">[SYS_CHK]</span>
            {item.split(":")[0]}:
            <span className="font-bold text-foreground">{item.split(":")[1]}</span>
          </span>
        ))}
      </div>
      <div className="absolute left-0 top-0 bottom-0 w-3 flex items-center">
        <span className="font-mono text-[9px] tracking-widest text-primary uppercase bg-primary/10 border border-primary/30 px-2 py-0.5">
          AUDIT LOG
        </span>
      </div>
    </div>
  );
}
