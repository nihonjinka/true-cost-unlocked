import { motion } from "framer-motion";
import React, { useState } from "react";

export function TestimonialSection() {
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [isHovering, setIsHovering] = useState(false);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  return (
    <section className="px-4 sm:px-8 py-20">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="terminal-card terminal-glow p-8 sm:p-12 max-w-3xl mx-auto text-center relative overflow-hidden"
        onMouseMove={handleMouseMove}
        onMouseEnter={() => setIsHovering(true)}
        onMouseLeave={() => setIsHovering(false)}
      >
        <div 
          className="pointer-events-none absolute inset-0 transition-opacity duration-300"
          style={{
            opacity: isHovering ? 1 : 0,
            background: `radial-gradient(400px circle at ${mousePos.x}px ${mousePos.y}px, hsl(68 100% 45% / 0.3), transparent 40%)`
          }}
        />
        <div className="absolute top-4 left-4 font-mono text-[10px] text-primary/40 z-10">TRANSMISSION INTERCEPTED</div>
        
        <blockquote className="font-display text-xl sm:text-2xl font-bold text-foreground leading-relaxed mb-6 relative z-10">
          "TRUE COST saved us from a loan agreement with $12,000 in hidden fees we never would have caught. 
          The risk analysis was eye-opening."
        </blockquote>
        <div className="space-y-1 relative z-10">
          <p className="font-mono text-sm text-muted-foreground">Financial Advisor</p>
          <p className="font-mono text-[11px] text-primary/60">Independent Consumer Advocacy Group</p>
        </div>
      </motion.div>
    </section>
  );
}
