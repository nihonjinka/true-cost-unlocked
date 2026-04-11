import type { AnalysisResult } from "@/components/AnalysisDashboard";
import type { AdviceResult } from "@/components/SmartAdvice";
import type { DeceptionResult } from "@/components/DeceptionDetector";

interface AIEnhancementResponse {
  summary?: string;
  insights?: string[];
  hiddenFees?: string[];
  warnings?: string[];
  deception?: Partial<DeceptionResult>;
  advice?: Partial<AdviceResult>;
}

type FullAnalysis = AnalysisResult & {
  deception: DeceptionResult;
  advice: AdviceResult;
};

const GEMINI_API_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

export function isAIEnhancementConfigured(): boolean {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY as string | undefined;
  return Boolean(apiKey);
}

function sanitizeList(items: unknown, limit = 6): string[] {
  if (!Array.isArray(items)) return [];
  return items
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, limit);
}

function sanitizeAdvice(advice: Partial<AdviceResult> | undefined, fallback: AdviceResult): AdviceResult {
  const recommendation =
    advice?.recommendation === "take" ||
    advice?.recommendation === "avoid" ||
    advice?.recommendation === "caution"
      ? advice.recommendation
      : fallback.recommendation;

  return {
    recommendation,
    reasons: sanitizeList(advice?.reasons, 5).length ? sanitizeList(advice?.reasons, 5) : fallback.reasons,
    alternatives: sanitizeList(advice?.alternatives, 5).length
      ? sanitizeList(advice?.alternatives, 5)
      : fallback.alternatives,
    tips: sanitizeList(advice?.tips, 5).length ? sanitizeList(advice?.tips, 5) : fallback.tips,
  };
}

function sanitizeDeception(
  deception: Partial<DeceptionResult> | undefined,
  fallback: DeceptionResult,
): DeceptionResult {
  return {
    urgencyTactics: sanitizeList(deception?.urgencyTactics, 5),
    fakeDiscounts: sanitizeList(deception?.fakeDiscounts, 5),
    emotionalManipulation: sanitizeList(deception?.emotionalManipulation, 5),
  };
}

function mergeUnique(primary: string[], secondary: string[], limit = 8): string[] {
  return Array.from(new Set([...primary, ...secondary])).slice(0, limit);
}

function extractResponseText(payload: unknown): string {
  const data = payload as {
    candidates?: Array<{
      content?: {
        parts?: Array<{ text?: string }>;
      };
    }>;
  };

  return data.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("").trim() ?? "";
}

function parseEnhancement(text: string): AIEnhancementResponse | null {
  if (!text) return null;

  const jsonCandidate = text.match(/\{[\s\S]*\}/)?.[0] ?? text;
  try {
    return JSON.parse(jsonCandidate) as AIEnhancementResponse;
  } catch {
    return null;
  }
}

function buildPrompt(text: string, local: FullAnalysis): string {
  return [
    "You are a fintech contract analysis assistant.",
    "Return JSON only. No markdown, no code fences, no commentary.",
    "Keep advice conservative and factual. Do not invent fees or rates not supported by the text.",
    "Use this exact JSON shape:",
    JSON.stringify({
      summary: "string",
      insights: ["string"],
      hiddenFees: ["string"],
      warnings: ["string"],
      deception: {
        urgencyTactics: ["string"],
        fakeDiscounts: ["string"],
        emotionalManipulation: ["string"],
      },
      advice: {
        recommendation: "take",
        reasons: ["string"],
        alternatives: ["string"],
        tips: ["string"],
      },
    }),
    "Document text:",
    text,
    "Deterministic analysis context:",
    JSON.stringify(local),
    "Improve the summary, insights, deception detection, and advice. Only include hidden fees or warnings if the document text clearly supports them.",
  ].join("\n\n");
}

export async function enhanceAnalysisWithAI(text: string, local: FullAnalysis): Promise<FullAnalysis> {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY as string | undefined;
  if (!apiKey) return local;

  const response = await fetch(GEMINI_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [{ text: buildPrompt(text, local) }],
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`Gemini request failed with status ${response.status}`);
  }

  const payload = await response.json();
  const parsed = parseEnhancement(extractResponseText(payload));
  if (!parsed) return local;

  // Keep compliance-critical fee/warning flags deterministic to avoid AI hallucinations.
  const deterministicHiddenFees = local.hiddenFees;
  const deterministicWarnings = local.warnings;

  return {
    ...local,
    summary: typeof parsed.summary === "string" && parsed.summary.trim() ? parsed.summary.trim() : local.summary,
    insights: mergeUnique(local.insights, sanitizeList(parsed.insights, 6), 8),
    hiddenFees: deterministicHiddenFees,
    warnings: deterministicWarnings,
    deception: (() => {
      const aiDeception = sanitizeDeception(parsed.deception, local.deception);
      return {
        urgencyTactics: mergeUnique(local.deception.urgencyTactics, aiDeception.urgencyTactics, 6),
        fakeDiscounts: mergeUnique(local.deception.fakeDiscounts, aiDeception.fakeDiscounts, 6),
        emotionalManipulation: mergeUnique(
          local.deception.emotionalManipulation,
          aiDeception.emotionalManipulation,
          6,
        ),
      };
    })(),
    advice: sanitizeAdvice(parsed.advice, local.advice),
  };
}
