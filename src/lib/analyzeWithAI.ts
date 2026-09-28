import type { AnalysisResult } from "@/components/AnalysisDashboard";
import type { AdviceResult } from "@/components/SmartAdvice";
import type { DeceptionResult } from "@/components/DeceptionDetector";

interface AIEnhancementResponse {
  summary?: string;
  insights?: string[];
  hiddenFees?: string[];
  warnings?: string[];
  negotiationStrategy?: string[];
  legalLoopholes?: string[];
  riskScore?: number;
  counterOfferEmail?: string;
  deception?: Partial<DeceptionResult>;
  advice?: Partial<AdviceResult>;
}

type FullAnalysis = AnalysisResult & {
  deception: DeceptionResult;
  advice: AdviceResult;
  negotiationStrategy?: string[];
  legalLoopholes?: string[];
  counterOfferEmail?: string;
};

const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";

export function isAIEnhancementConfigured(): boolean {
  const apiKey = import.meta.env.VITE_OPENROUTER_API_KEY as string | undefined;
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
    choices?: Array<{
      message?: {
        content?: string;
      };
    }>;
  };

  return data.choices?.[0]?.message?.content ?? "";
}

function parseEnhancement(text: string): AIEnhancementResponse | null {
  if (!text) return null;

  const jsonCandidate = text.match(/\{[\s\S]*\}/)?.[0] ?? text;
  try {
    return JSON.parse(jsonCandidate) as AIEnhancementResponse;
  } catch (err) {
    console.error("JSON parsing failed for AI response:", err);
    console.error("Original text:", text);
    console.error("Matched JSON candidate:", jsonCandidate);
    return null;
  }
}

function buildPrompt(text: string, local: FullAnalysis): string {
  return [
    "You are an expert fintech contract analysis assistant.",
    "Your job is to thoroughly analyze the provided financial document and improve the deterministic analysis.",
    "Return JSON only. No markdown formatting, no code fences, no conversational text.",
    "CRITICAL RULES:",
    "1. Keep advice conservative and factual. Do not invent fees or rates not supported by the text.",
    "2. If you find hidden fees or warnings in the text that the deterministic analysis missed, ADD them to the arrays.",
    "3. Provide a clear, professional summary of the true cost and risks.",
    "4. Provide 2-4 Negotiation Strategies: suggest tactical ways the user can negotiate this contract to lower costs or improve terms.",
    "5. Find Legal Loopholes & Traps: point out 2-4 specific terms that give the lender an unfair advantage or allow them to change rates/fees unilaterally.",
    "6. Generate a Counter-Offer Email: Write a polite, professional, and firm email template that the user can send to the lender to negotiate the removal of the specific hidden fees and predatory terms you found. Use placeholders like [My Name] and [Lender Name]. Keep it concise.",
    "7. Calculate a Risk Score (0-100): based on the severity of hidden fees, predatory terms like Rule of 78s or factor rates, give a risk score. 0 is very safe, 100 is an extreme scam.",
    "Use this exact JSON structure:",
    JSON.stringify({
      summary: "string",
      riskScore: "number",
      insights: ["string"],
      hiddenFees: ["string"],
      warnings: ["string"],
      negotiationStrategy: ["string"],
      legalLoopholes: ["string"],
      counterOfferEmail: "string",
      deception: {
        urgencyTactics: ["string"],
        fakeDiscounts: ["string"],
        emotionalManipulation: ["string"],
      },
      advice: {
        recommendation: "take | caution | avoid",
        reasons: ["string"],
        alternatives: ["string"],
        tips: ["string"],
      },
    }),
    "Document text:",
    text,
    "Deterministic analysis context (use this as a baseline):",
    JSON.stringify(local, null, 2),
  ].join("\n\n");
}

export async function enhanceAnalysisWithAI(text: string, local: FullAnalysis): Promise<FullAnalysis> {
  const apiKey = import.meta.env.VITE_OPENROUTER_API_KEY as string | undefined;
  if (!apiKey) return local;

  let response;
  let retries = 3;
  while (retries > 0) {
    response = await fetch(OPENROUTER_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "openai/gpt-4o-mini",
        response_format: { type: "json_object" },
        messages: [
          {
            role: "user",
            content: buildPrompt(text, local),
          },
        ],
      }),
    });

    if (response.ok) break;
    if (response.status === 503 || response.status === 429) {
      retries--;
      if (retries > 0) await new Promise((r) => setTimeout(r, 1000));
    } else {
      break;
    }
  }

  if (!response || !response.ok) {
    throw new Error(`OpenRouter request failed with status ${response?.status}`);
  }

  const payload = await response.json();
  const parsed = parseEnhancement(extractResponseText(payload));
  if (!parsed) return local;

  // Merge AI-discovered fees and warnings with deterministic ones
  return {
    ...local,
    summary: typeof parsed.summary === "string" && parsed.summary.trim() ? parsed.summary.trim() : local.summary,
    insights: mergeUnique(local.insights, sanitizeList(parsed.insights, 6), 8),
    hiddenFees: mergeUnique(local.hiddenFees, sanitizeList(parsed.hiddenFees, 10), 12),
    warnings: mergeUnique(local.warnings, sanitizeList(parsed.warnings, 10), 12),
    riskScore: typeof parsed.riskScore === "number" ? Math.max(local.riskScore, Math.min(100, Math.max(0, parsed.riskScore))) : local.riskScore,
    negotiationStrategy: sanitizeList(parsed.negotiationStrategy, 4),
    legalLoopholes: sanitizeList(parsed.legalLoopholes, 4),
    counterOfferEmail: typeof parsed.counterOfferEmail === "string" ? parsed.counterOfferEmail.trim() : undefined,
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

export async function regenerateCounterOfferEmail(text: string): Promise<string> {
  const apiKey = import.meta.env.VITE_OPENROUTER_API_KEY as string | undefined;
  if (!apiKey) throw new Error("API Key not found");

  const prompt = [
    "You are an expert contract negotiator.",
    "The user is dealing with a predatory financial contract.",
    "Write a completely new, polite, professional, and firm counter-offer email template that the user can send to the lender.",
    "Negotiate the removal of hidden fees and predatory terms based on the document provided.",
    "Use placeholders like [My Name] and [Lender Name]. Keep it concise.",
    "Return ONLY the email text, no markdown formatting or extra dialogue."
  ].join("\n");

  const response = await fetch(OPENROUTER_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "openai/gpt-4o-mini",
      messages: [
        { role: "system", content: prompt },
        { role: "user", content: text },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to generate email: ${response.status}`);
  }

  const payload = await response.json();
  const emailText = extractResponseText(payload);
  return emailText.trim();
}

