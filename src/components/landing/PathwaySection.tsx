import { motion } from "framer-motion";

const steps = [
  { num: "01", title: "Upload", desc: "Paste your loan agreement, credit card terms, or any financial contract text." },
  { num: "02", title: "Scan", desc: "Our engine parses every clause, identifying fees, rates, and risk patterns." },
  { num: "03", title: "Calculate", desc: "Precise EMI, total cost, and interest computations reveal the true price." },
  { num: "04", title: "Report", desc: "Get a clear dashboard with risk scores, plain English summary, and actionable insights." },
];

const stats = [
  { label: "Documents Analyzed", value: "142K+" },
  { label: "Fee Types Tracked", value: "48" },
  { label: "Accuracy", value: "99.2%" },
  { label: "Avg. Savings Found", value: "$4,200" },
];

export function PathwaySection() {
  return (
    <section className="px-4 sm:px-8 py-20">
      <motion.h2
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="font-display text-2xl sm:text-3xl lg:text-4xl font-bold text-foreground mb-12"
      >
        Analysis Pathway
      </motion.h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-px bg-border mb-16">
        {steps.map((step, i) => (
          <motion.div
            key={step.num}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.1 }}
            className="bg-background p-8 relative"
          >
            <span className="font-mono text-3xl font-bold text-primary/20 mb-4 block">{step.num}</span>
            <h4 className="font-display text-lg font-bold text-foreground mb-2">{step.title}</h4>
            <p className="font-mono text-sm text-muted-foreground leading-relaxed">{step.desc}</p>
          </motion.div>
        ))}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-border terminal-card">
        {stats.map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.1 }}
            className="bg-card p-6 text-center"
          >
            <span className="font-display text-2xl sm:text-3xl font-bold text-primary block">{stat.value}</span>
            <span className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase mt-2 block">{stat.label}</span>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
