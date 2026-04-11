import { motion } from "framer-motion";

export function TestimonialSection() {
  return (
    <section className="px-4 sm:px-8 py-20">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="terminal-card terminal-glow p-8 sm:p-12 max-w-3xl mx-auto text-center relative overflow-hidden"
      >
        <div className="absolute top-4 left-4 font-mono text-[10px] text-primary/40">TRANSMISSION INTERCEPTED</div>
        
        <blockquote className="font-display text-xl sm:text-2xl font-bold text-foreground leading-relaxed mb-6">
          "TRUE COST saved us from a loan agreement with $12,000 in hidden fees we never would have caught. 
          The risk analysis was eye-opening."
        </blockquote>
        <div className="space-y-1">
          <p className="font-mono text-sm text-muted-foreground">Financial Advisor</p>
          <p className="font-mono text-[11px] text-primary/60">Independent Consumer Advocacy Group</p>
        </div>
      </motion.div>
    </section>
  );
}
