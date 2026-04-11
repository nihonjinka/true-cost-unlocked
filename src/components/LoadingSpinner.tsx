import { motion } from "framer-motion";

export function LoadingSpinner() {
  return (
    <div className="flex flex-col items-center gap-4 py-12">
      <motion.div
        className="w-12 h-12 border-2 border-border border-t-primary"
        animate={{ rotate: 360 }}
        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
      />
      <motion.p
        className="font-mono text-[11px] tracking-widest text-muted-foreground uppercase"
        animate={{ opacity: [0.3, 1, 0.3] }}
        transition={{ duration: 1.5, repeat: Infinity }}
      >
        SCANNING DOCUMENT...
      </motion.p>
    </div>
  );
}
