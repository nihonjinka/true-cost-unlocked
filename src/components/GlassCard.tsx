import { motion } from "framer-motion";
import { ReactNode } from "react";

interface Props {
  children: ReactNode;
  className?: string;
  delay?: number;
  neon?: boolean;
}

export function GlassCard({ children, className = "", delay = 0, neon = false }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay, ease: "easeOut" }}
      className={`glass-card rounded-2xl p-6 ${neon ? "neon-glow" : ""} ${className}`}
    >
      {children}
    </motion.div>
  );
}
