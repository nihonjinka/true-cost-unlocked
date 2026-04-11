import { motion } from "framer-motion";

const problems = [
  { code: "ERR_01", title: "Hidden Fee Structures", desc: "Buried in pages of legal text, fees silently inflate your true cost by 15-40%." },
  { code: "ERR_02", title: "Manipulative Clauses", desc: "Penalty APRs, indefinite terms, and unilateral change clauses trap borrowers." },
  { code: "ERR_03", title: "Opaque Calculations", desc: "Complex interest compounding obscures the real repayment amount you'll pay." },
];

export function ProblemSection() {
  return (
    <section id="features" className="px-4 sm:px-8 py-20">
      <motion.h2
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="font-display text-2xl sm:text-3xl lg:text-4xl font-bold text-foreground max-w-3xl leading-tight mb-12"
      >
        Financial agreements hide{" "}
        <span className="text-primary">billions in fees</span> behind complex language.
        We decode every clause.
      </motion.h2>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-border">
        {problems.map((p, i) => (
          <motion.div
            key={p.code}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.1 }}
            className="bg-background p-8 group hover:bg-card transition-colors"
          >
            <span className="font-mono text-[11px] tracking-widest text-destructive mb-4 block">{p.code}</span>
            <h3 className="font-display text-lg font-bold text-foreground mb-3">{p.title}</h3>
            <p className="font-mono text-sm text-muted-foreground leading-relaxed">{p.desc}</p>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
