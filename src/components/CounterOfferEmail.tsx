import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Copy, Check, Mail, Send, Sparkles, RefreshCw } from "lucide-react";
import TerminalCard from "./TerminalCard";
import { regenerateCounterOfferEmail } from "@/lib/analyzeWithAI";

interface Props {
  initialEmail?: string;
  rawText: string;
}

export default function CounterOfferEmail({ initialEmail, rawText }: Props) {
  const [copied, setCopied] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [emailBody, setEmailBody] = useState(initialEmail);

  if (!emailBody) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(emailBody);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy!", err);
    }
  };

  const handleRegenerate = async () => {
    try {
      setIsGenerating(true);
      const newEmail = await regenerateCounterOfferEmail(rawText);
      setEmailBody(newEmail);
    } catch (err) {
      console.error("Failed to regenerate email:", err);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <TerminalCard title="AI COUNTER-OFFER EMAIL" icon={Mail} delay={1.0} className="border-primary/50 relative overflow-hidden group">
      {/* Decorative gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
      
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary animate-pulse" />
          <span className="text-xs font-mono text-primary/80 uppercase tracking-wider">
            Ready to Send
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleRegenerate}
            disabled={isGenerating}
            className="flex items-center gap-2 px-3 py-1.5 text-xs font-mono border border-border rounded hover:bg-muted text-muted-foreground transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isGenerating ? "animate-spin" : ""}`} />
            <span>{isGenerating ? "GENERATING..." : "CHANGE TEMPLATE"}</span>
          </button>
          
          <button
            onClick={handleCopy}
            className="flex items-center gap-2 px-3 py-1.5 text-xs font-mono border border-primary/30 rounded bg-primary/10 hover:bg-primary/20 text-primary transition-all active:scale-95"
          >
            <AnimatePresence mode="wait">
              {copied ? (
                <motion.div
                  key="check"
                  initial={{ opacity: 0, scale: 0.5 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.5 }}
                  className="flex items-center gap-1"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>COPIED</span>
                </motion.div>
              ) : (
                <motion.div
                  key="copy"
                  initial={{ opacity: 0, scale: 0.5 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.5 }}
                  className="flex items-center gap-1"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>COPY TEMPLATE</span>
                </motion.div>
              )}
            </AnimatePresence>
          </button>
        </div>
      </div>

      <div className="relative bg-background/50 border border-border/50 rounded-md p-4 font-mono text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed shadow-inner">
        {/* Subtle scanline effect inside the email body */}
        <div className="absolute inset-0 scanline opacity-30 pointer-events-none rounded-md" />
        <div className={`transition-opacity duration-300 ${isGenerating ? "opacity-30" : "opacity-100"}`}>
          {emailBody}
        </div>
      </div>

      <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground font-mono">
        <Send className="w-3.5 h-3.5 opacity-70" />
        <span>Don't accept the first offer. Send this to your lender to negotiate better terms.</span>
      </div>
    </TerminalCard>
  );
}
