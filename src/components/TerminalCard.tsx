import React from "react";
import { motion } from "framer-motion";

export default function TerminalCard({ children, className = "", title, icon: Icon, tag, delay = 0 }: {
  children: React.ReactNode;
  className?: string;
  title: string;
  icon: React.ElementType;
  tag?: string;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4 }}
      className={`terminal-card ${className}`}
    >
      <div className="flex items-center justify-between px-4 py-2 border-b border-border">
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4 text-primary" />
          <span className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">{title}</span>
        </div>
        {tag && <span className="font-mono text-[10px] font-semibold text-destructive">{tag}</span>}
      </div>
      <div className="p-4 relative">
        {children}
      </div>
    </motion.div>
  );
}
