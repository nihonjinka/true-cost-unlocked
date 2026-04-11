import { motion } from "framer-motion";
import { FileSearch, Shield, Calculator, Brain } from "lucide-react";

const modules = [
  {
    id: "SYS.01",
    icon: FileSearch,
    title: "Document Decoder",
    desc: "Converts complex financial and legal text into plain English. Identifies key terms, obligations, and conditions automatically.",
  },
  {
    id: "SYS.02",
    icon: Shield,
    title: "Fee & Risk Scanner",
    desc: "Detects hidden fees, penalty clauses, and manipulative language patterns. Assigns a risk score based on 40+ financial red flags.",
  },
  {
    id: "SYS.03",
    icon: Calculator,
    title: "Precision Calculator",
    desc: "Computes EMI, total repayment, and interest using exact formulas. Shows the true cost gap between advertised and actual rates.",
  },
  {
    id: "SYS.04",
    icon: Brain,
    title: "AI Insights Engine",
    desc: "Provides optional AI-enhanced recommendations while deterministic local analysis remains the default reliability layer.",
    hasApiTag: true,
  },
];

export function ArchitectureSection() {
  return (
    <section id="architecture" className="px-4 sm:px-8 py-20">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="mb-12"
      >
        <h2 className="font-display text-2xl sm:text-3xl lg:text-4xl font-bold text-foreground mb-2">
          Core Architecture
        </h2>
        <p className="font-mono text-[11px] tracking-widest text-primary uppercase">
          MODULAR. TRANSPARENT.
        </p>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-border">
        {modules.map((mod, i) => (
          <motion.div
            key={mod.id}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.1 }}
            className="bg-background p-8 group hover:bg-card transition-colors relative"
          >
            <span className="font-mono text-[10px] tracking-widest text-primary/60 mb-6 block">{mod.id}</span>
            {mod.hasApiTag && (
              <div className="absolute top-6 right-6 font-mono text-[10px] text-muted-foreground space-y-1">
                <div className="text-primary/60">AI MODE: OPTIONAL</div>
                <div className="text-primary/40">LOCAL FALLBACK: ENABLED</div>
              </div>
            )}
            <div className="flex items-start gap-4">
              <mod.icon className="w-6 h-6 text-primary flex-shrink-0 mt-1" strokeWidth={1.5} />
              <div>
                <h3 className="font-display text-lg font-bold text-foreground mb-2">{mod.title}</h3>
                <p className="font-mono text-sm text-muted-foreground leading-relaxed">{mod.desc}</p>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
