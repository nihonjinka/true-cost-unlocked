import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { ArrowUpRight, Check } from "lucide-react";

const tiers = [
  {
    label: "FREE",
    title: "Analyzer",
    price: "Free",
    features: ["Document Analysis", "EMI Calculator", "Basic Risk Score"],
    cta: "Start Analyzing",
    ctaLink: "/analyze",
    highlight: false,
  },
  {
    label: "STANDARD",
    title: "AI Enhanced",
    price: "Pro",
    features: ["Everything in Free", "AI-Powered Insights", "Deep Fee Detection", "Comparison Reports"],
    cta: "Coming Soon",
    ctaLink: "#",
    highlight: true,
  },
  {
    label: "ENTERPRISE",
    title: "White-Label",
    price: "Custom",
    features: ["Full API Access", "Custom Integrations", "Bulk Processing", "On-premise Deployment"],
    cta: "Contact Us",
    ctaLink: "#",
    highlight: false,
  },
];

export function PricingSection() {
  return (
    <section id="pricing" className="px-4 sm:px-8 py-20">
      <motion.h2
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="font-display text-2xl sm:text-3xl lg:text-4xl font-bold text-foreground mb-2"
      >
        Access Tiers
      </motion.h2>
      <p className="font-mono text-[11px] tracking-widest text-primary uppercase mb-12">TRANSPARENT PRICING</p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-border">
        {tiers.map((tier, i) => (
          <motion.div
            key={tier.label}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.1 }}
            className={`p-8 ${tier.highlight ? "bg-card terminal-border-glow border-l border-r border-primary/20" : "bg-background"}`}
          >
            <span className="font-mono text-[10px] tracking-widest text-primary/60 block mb-4">{tier.label}</span>
            <h3 className="font-display text-xl font-bold text-foreground mb-1">{tier.title}</h3>
            <span className="font-display text-3xl font-bold text-primary block mb-6">{tier.price}</span>

            <ul className="space-y-3 mb-8">
              {tier.features.map((f) => (
                <li key={f} className="flex items-center gap-3 font-mono text-sm text-muted-foreground">
                  <Check className="w-4 h-4 text-primary flex-shrink-0" />
                  {f}
                </li>
              ))}
            </ul>

            <Link
              to={tier.ctaLink}
              className={`block text-center font-mono text-[11px] tracking-widest uppercase py-3 transition-all ${
                tier.highlight
                  ? "bg-primary text-primary-foreground hover:bg-primary/90 terminal-glow"
                  : "border border-border text-foreground hover:border-primary/30 hover:text-primary"
              }`}
            >
              {tier.cta}
            </Link>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
