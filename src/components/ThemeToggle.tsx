import { Moon, Sun } from "lucide-react";
import { motion } from "framer-motion";

interface Props {
  isDark: boolean;
  onToggle: () => void;
}

export function ThemeToggle({ isDark, onToggle }: Props) {
  return (
    <motion.button
      onClick={onToggle}
      className="glass-card p-2 rounded-full neon-glow cursor-pointer"
      whileTap={{ scale: 0.9 }}
      whileHover={{ scale: 1.1 }}
      aria-label="Toggle theme"
    >
      {isDark ? <Sun className="w-5 h-5 text-neon-cyan" /> : <Moon className="w-5 h-5 text-neon-purple" />}
    </motion.button>
  );
}
