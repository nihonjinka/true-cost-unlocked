import type { AnalysisContext } from "@/lib/analysisContext";

// Optional cloud insights stay disabled until a user explicitly authorizes a destination and payload.
export function isAIEnhancementConfigured(): boolean {
  return false;
}

export async function enhanceAnalysisWithAI(_context: AnalysisContext): Promise<{ aiInsights: string[] }> {
  return { aiInsights: [] };
}

