import rules from "@/data/analysisRules.json";
import { calculateEMI, normalizeDuration, parseAmount, type ParsedDuration } from "./financial";
import type { CostFinding, DetectedClaim, DocumentType, ExtractedCandidate, ExtractedField, LineItemGroup, RiskBreakdownItem } from "./analysisContext";

type LabelRule = { id: string; pattern: string; score: number; kind: "principal" | "price" | "exclude" };
type DocumentRule = { id: DocumentType; label: string; signals: Array<{ pattern: string; weight: number }> };
type FeeRule = { id: string; label: string; patterns: string[]; category: string; severity: number; explanation: string };
type Clause = { text: string; start: number; end: number };
type ParsedValue = { amount: number | null; percent: number | null; basis: string | null; frequency: string | null; qualifier: string | null; currency: string | null; span: [number, number] };
const config = rules as {
  segmentation: { abbreviations: string[] };
  monetaryBases: Array<{ id: string; pattern: string }>;
  listCategories: Array<{ id: string; labelPattern: string; category: string }>;
  unquantifiedTerms: Array<{ id: string; label: string; pattern: string; category: string; severity: number }>;
  principalLabels: LabelRule[];
  documentTypes: DocumentRule[];
  feeCatalog: FeeRule[];
  claimCatalog: Array<{ id: string; label: string; pattern: string; predicates?: string[] }>;
  riskRules: Array<{ id: string; category: string; weight: number; pattern: string }>;
  riskCategoryCaps: Record<string, number>;
  glossary: Array<{ id: string; term: string; pattern: string; definition: string }>;
};

const CURRENCY_TOKEN = String.raw`US\$|C\$|A\$|S\$|\$|₹|€|£|¥|\bINR\b|\bUSD\b|\bEUR\b|\bGBP\b|\bCAD\b|\bAUD\b|\bSGD\b|\bAED\b|\bRs\.?`;
const NUMBER_TOKEN = String.raw`(?:\d{1,3}(?:,\d{2,3})+|\d+)(?:\.\d+)?`;
const MONEY_TOKEN = String.raw`(?<currency>${CURRENCY_TOKEN})?\s*(?<amount>${NUMBER_TOKEN})(?:\s*(?<unit>thousand|million|billion|lakh|lac|crore|k)\b)?(?!\s*%)`;
const MULTIPLIERS: Record<string, number> = { thousand: 1e3, k: 1e3, million: 1e6, billion: 1e9, lakh: 1e5, lac: 1e5, crore: 1e7 };

const CURRENCY_CODES: Record<string, string> = { "₹": "INR", INR: "INR", "Rs": "INR", "Rs.": "INR", "€": "EUR", EUR: "EUR", "£": "GBP", GBP: "GBP", "¥": "JPY", JPY: "JPY", "C$": "CAD", CAD: "CAD", "A$": "AUD", AUD: "AUD", "S$": "SGD", SGD: "SGD", AED: "AED", USD: "USD", "US$": "USD", "$": "USD" };

function sentenceBoundary(text: string, index: number): boolean {
  const char = text[index];
  if (!/[.!?;]/.test(char ?? "")) return false;
  if (char === "." && /\d/.test(text[index - 1] ?? "") && /\d/.test(text[index + 1] ?? "")) return false;
  if (char === ".") {
    const prefix = text.slice(Math.max(0, index - 12), index + 1);
    const abbreviation = config.segmentation.abbreviations.find((item) => prefix.toLowerCase().endsWith(item.toLowerCase()));
    if (abbreviation) return false;
  }
  return true;
}

/** Clause boundaries are shared by parsers, warnings, and evidence so snippets remain intact. */
export function segmentClauses(text: string): Clause[] {
  const clauses: Clause[] = [];
  const addLine = (line: string, offset: number) => {
    const labelStarts: number[] = [];
    const labels = new RegExp(String.raw`(?:^|[\s,;])([A-Za-z][A-Za-z0-9 /()_-]{1,42}):(?=\s*(?:${CURRENCY_TOKEN}|[$₹€£¥]?\s*\d))`, "g");
    for (const match of line.matchAll(labels)) {
      const labelStart = (match.index ?? 0) + (match[0].length - match[1].length - 1);
      if (labelStart > 0) labelStarts.push(labelStart);
    }
    const sorted = [0, ...labelStarts].sort((a, b) => a - b);
    const chunks = sorted.map((start, index) => ({ start, end: sorted[index + 1] ?? line.length }));
    for (const chunk of chunks) {
      let start = chunk.start;
      for (let i = chunk.start; i < chunk.end; i++) {
        if (sentenceBoundary(line, i)) {
          const value = line.slice(start, i + 1).trim();
          if (value) {
            const leading = line.slice(start, i + 1).search(/\S/);
            clauses.push({ text: value, start: offset + start + Math.max(0, leading), end: offset + i + 1 });
          }
          start = i + 1;
        }
      }
      const value = line.slice(start, chunk.end).trim();
      if (value) {
        const leading = line.slice(start, chunk.end).search(/\S/);
        clauses.push({ text: value, start: offset + start + Math.max(0, leading), end: offset + chunk.end });
      }
    }
  };
  const lines = /[^\r\n•]+/g;
  for (const match of text.matchAll(lines)) if (match.index !== undefined) addLine(match[0], match.index);
  return clauses;
}

export function parseMonetaryValues(text: string, baseOffset = 0): ParsedValue[] {
  const values: ParsedValue[] = [];
  const percentRegex = /(?<percent>\d+(?:\.\d+)?)\s*%/g;
  const percentMatches = Array.from(text.matchAll(percentRegex));
  const moneyRegex = new RegExp(MONEY_TOKEN, "gi");
  const moneyMatches = Array.from(text.matchAll(moneyRegex)).filter((match) => match.groups?.amount && match.index !== undefined);
  const frequency = /per\s+(?:installment|instalment|payment)/i.test(text) ? "per_installment"
    : /per\s+month|monthly/i.test(text) ? "monthly"
      : /per\s+year|annual|yearly/i.test(text) ? "annual"
        : /per\s+week|weekly/i.test(text) ? "weekly" : /per\s+day|daily/i.test(text) ? "daily" : null;
  const qualifier = /\b(up to|at least|at most|minimum|maximum|max(?:imum)?|min(?:imum)?|one[- ]time)\b/i.exec(text)?.[1]?.toLowerCase() ?? null;
  const basis = config.monetaryBases.find(({ pattern }) => new RegExp(pattern, "i").test(text))?.id ?? null;
  for (const match of moneyMatches) {
    const g = match.groups!;
    const amount = parseAmount(g.amount);
    if (amount === null) continue;
    const unit = g.unit?.toLowerCase();
    const parsed = amount * (unit ? MULTIPLIERS[unit] ?? 1 : 1);
    const token = g.currency?.trim() ?? "";
    values.push({ amount: parsed, percent: null, basis, frequency, qualifier, currency: token ? CURRENCY_CODES[token] ?? null : null, span: [baseOffset + match.index!, baseOffset + match.index! + match[0].length] });
  }
  for (const match of percentMatches) {
    if (match.index === undefined) continue;
    values.push({ amount: null, percent: Number(match.groups?.percent), basis, frequency, qualifier, currency: null, span: [baseOffset + match.index, baseOffset + match.index + match[0].length] });
  }
  return values.sort((a, b) => a.span[0] - b.span[0]);
}

function clauseAt(text: string, position: number): Clause {
  return segmentClauses(text).find((clause) => clause.start <= position && position < clause.end)
    ?? { text: text.slice(position), start: position, end: text.length };
}

function snippet(text: string, start: number, end: number): string {
  return clauseAt(text, start).text || text.slice(Math.max(0, start), Math.min(text.length, end)).trim();
}

function matches(pattern: string, text: string): RegExpMatchArray[] {
  const regex = new RegExp(pattern, "gi");
  return Array.from(text.matchAll(regex));
}

function labelForCandidate(text: string, position: number): { rule: LabelRule | null; label: string; score: number } {
  const clause = clauseAt(text, position);
  const region = text.slice(clause.start, position);
  const found: Array<{ rule: LabelRule; at: number; label: string }> = [];
  for (const rule of config.principalLabels) {
    const regex = new RegExp(rule.pattern, "gi");
    for (const match of region.matchAll(regex)) {
      found.push({ rule, at: match.index ?? 0, label: match[0] });
    }
  }
  found.sort((a, b) => a.at - b.at || b.rule.score - a.rule.score);
  const nearest = found[found.length - 1];
  return nearest
    ? { rule: nearest.rule, label: nearest.label, score: nearest.rule.score }
    : { rule: null, label: "Unlabeled amount", score: 0 };
}

export function extractAmountCandidates(text: string): ExtractedCandidate[] {
  const regex = new RegExp(MONEY_TOKEN, "gi");
  const candidates: ExtractedCandidate[] = [];
  for (const match of text.matchAll(regex)) {
    const groups = match.groups;
    if (!groups || match.index === undefined) continue;
    const value = parseAmount(`${groups.amount}${groups.decimal ? `.${groups.decimal}` : ""}`);
    if (value === null || value <= 0) continue;
    const unit = groups.unit?.toLowerCase();
    const scaledValue = value * (unit ? MULTIPLIERS[unit] ?? 1 : 1);
    const position = match.index;
    const { rule, label, score } = labelForCandidate(text, position);
    candidates.push({
      value: scaledValue,
      label,
      source: clauseAt(text, position).text,
      position,
      confidence: score >= 120 ? 0.98 : score >= 60 ? 0.78 : score < 0 ? 0.05 : 0.25,
      score,
    });
  }
  return candidates;
}

export function classifyDocument(text: string): { type: DocumentType; label: string; confidence: number; signals: string[] } {
  const ranked = config.documentTypes.map((rule) => {
    const signals = rule.signals.filter(({ pattern }) => new RegExp(pattern, "i").test(text));
    return { rule, score: signals.reduce((sum, signal) => sum + signal.weight, 0), signals: signals.map((signal) => signal.pattern) };
  }).sort((a, b) => b.score - a.score);
  const best = ranked[0];
  const runnerUp = ranked[1]?.score ?? 0;
  if (!best || best.score < 3) return { type: "unknown", label: "Unclassified financial document", confidence: 0.2, signals: [] };
  const confidence = Math.min(0.99, 0.55 + best.score * 0.03 + Math.max(0, best.score - runnerUp) * 0.025);
  return { type: best.rule.id, label: best.rule.label, confidence, signals: best.signals };
}

export function resolvePrincipal(
  candidates: ExtractedCandidate[],
  rate: number | null,
  durationMonths: number | null,
  statedEMI: number | null,
  docType: DocumentType,
): ExtractedField<number> {
  let ranked = candidates.filter((candidate) => candidate.score > 0);
  let emiMatched = false;
  if (statedEMI && rate !== null && durationMonths) {
    ranked = ranked.map((candidate) => {
      const calculated = calculateEMI(candidate.value, rate, durationMonths);
      const matchesEMI = calculated && Math.abs(calculated.emi - statedEMI) / statedEMI <= 0.1;
      if (matchesEMI) emiMatched = true;
      return matchesEMI ? { ...candidate, score: candidate.score + 120, confidence: 0.99 } : candidate;
    });
  }
  ranked.sort((a, b) => b.score - a.score || a.position - b.position);
  const best = ranked[0];
  const next = ranked[1];
  const conflict = Boolean(best && next && Math.abs(best.value - next.value) / Math.max(best.value, next.value) > 0.05 && best.score - next.score <= 25);
  const emiMismatch = Boolean(statedEMI && rate !== null && durationMonths && !emiMatched);
  if (!best || conflict || emiMismatch) {
    return { value: null, source: null, confidence: 0, alternatives: ranked.slice(0, 8), needsReview: Boolean(conflict || emiMismatch) };
  }
  return { value: best.value, source: best.source, confidence: best.confidence, alternatives: ranked.slice(0, 8), needsReview: false };
}

export function extractStatedEMI(text: string, candidates = extractAmountCandidates(text)): ExtractedField<number> {
  const eligible = candidates.filter((candidate) => /\bemi\b|monthly\s+payment|payment\s+amount/i.test(candidate.label));
  const best = eligible[0];
  if (best) return { value: best.value, source: best.source, confidence: 0.9, alternatives: eligible, needsReview: false };
  const schedule = text.match(/\b(?:pay\s+in\s+)?\d+\s+(?:(?:interest[- ]free|equal|fixed)\s+)?installments?\s+of\s+(?:US\$|C\$|A\$|S\$|\$|₹|€|£|¥|INR\s*|USD\s*|EUR\s*|GBP\s*|Rs\.?\s*)?\s*(\d{1,3}(?:,\d{2,3})+|\d+)(?:\.(\d+))?/i);
  if (schedule) {
    const value = parseAmount(`${schedule[1]}${schedule[2] ? `.${schedule[2]}` : ""}`);
    if (value !== null) {
      const candidate = { value, label: "installment amount", source: schedule[0], position: schedule.index ?? 0, confidence: 0.85, score: 0 };
      return { value, source: schedule[0], confidence: 0.85, alternatives: [candidate], needsReview: false };
    }
  }
  return { value: null, source: null, confidence: 0, alternatives: [], needsReview: false };
}

function findClause(text: string, start: number, end: number): { source: string; start: number } {
  const isDelimiter = (index: number) => {
    const character = text[index];
    if (character === "." && /\d/.test(text[index - 1] ?? "") && /\d/.test(text[index + 1] ?? "")) return false;
    return /[.!?;\n]/.test(character ?? "");
  };
  let clauseStart = start;
  let clauseEnd = end;
  while (clauseStart > 0 && !isDelimiter(clauseStart - 1)) clauseStart--;
  while (clauseEnd < text.length && !isDelimiter(clauseEnd)) clauseEnd++;
  return { source: text.slice(clauseStart, clauseEnd).trim(), start: clauseStart };
}

function isNegated(clause: string): boolean {
  if (/\bwaived\s+for\s+(?:the\s+)?first\s+(?:year|month)\b/i.test(clause)) return false;
  return /\b(?:no|none|not\s+(?:charged|applicable|apply|subject\s+to|assessed)|waived|free of|without)\b/i.test(clause)
    || /(?:\$|₹|€|£|Rs\.?\s*)\s*0(?:\.0+)?\b/i.test(clause)
    || /\b0(?:\.0+)?\s*%\b/i.test(clause);
}

function parseFindingAmount(clause: string, afterIndex: number): { amount: number | null; percent: number | null } {
  const localTerms = clause.slice(afterIndex);
  const percent = localTerms.match(/(\d+(?:\.\d+)?)\s*%/) ?? clause.match(/(\d+(?:\.\d+)?)\s*%/);
  const money = localTerms.match(new RegExp(MONEY_TOKEN, "i")) ?? clause.match(new RegExp(MONEY_TOKEN, "i"));
  const amount = money?.groups?.amount
    ? parseAmount(`${money.groups.amount}${money.groups.decimal ? `.${money.groups.decimal}` : ""}`)
    : null;
  const unit = money?.groups?.unit?.toLowerCase();
  return {
    amount: amount === null ? null : amount * (unit ? MULTIPLIERS[unit] ?? 1 : 1),
    percent: percent ? Number(percent[1]) : null,
  };
}

export function detectCosts(text: string, principal: number | null, installmentCount: number | null, termMonths: number | null): CostFinding[] {
  const findings: CostFinding[] = [];
  const seen = new Set<string>();
  for (const item of config.feeCatalog) {
    for (const pattern of item.patterns) {
      const regex = new RegExp(pattern, "gi");
      for (const match of text.matchAll(regex)) {
        if (match.index === undefined) continue;
        const { source, start } = findClause(text, match.index, match.index + match[0].length);
        const key = `${item.id}:${start}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const negated = isNegated(source);
        const relativeMatchPosition = Math.max(0, match.index - start + match[0].length);
        const parsed = parseFindingAmount(source, relativeMatchPosition);
        const frequency = /per\s+(?:installment|instalment|payment)/i.test(source)
          ? "per_installment"
          : /\/\s*month|per\s+month|monthly/i.test(source)
            ? "monthly"
            : /annual|yearly|per\s+year/i.test(source)
              ? "annual"
              : "once";
        const basis = parsed.percent !== null
          ? /emi/i.test(source) ? "emi" : /balance/i.test(source) ? "balance" : /principal|amount financed/i.test(source) ? "principal" : null
          : null;
        const conditions = source.match(/\b(?:if|unless|when|provided that|only if)\s+[^.;]+/gi)?.map((value) => value.trim()) ?? [];
        let totalImpact: number | null = parsed.amount;
        if (totalImpact !== null && frequency === "per_installment" && installmentCount) totalImpact *= installmentCount;
        if (totalImpact !== null && frequency === "monthly" && termMonths) totalImpact *= Math.ceil(termMonths);
        if (totalImpact !== null && frequency === "annual" && termMonths) {
          const annualCharges = Math.ceil(termMonths / 12);
          const waivedFirstYear = /waived\s+for\s+(?:the\s+)?first\s+year/i.test(source);
          totalImpact *= Math.max(0, annualCharges - (waivedFirstYear ? 1 : 0));
        }
        if (parsed.percent !== null && basis === "principal" && principal !== null) totalImpact = principal * parsed.percent / 100;
        if (parsed.percent !== null && basis === "emi") totalImpact = null;
        findings.push({
          id: item.id, label: item.label, category: item.category, severity: item.severity,
          amount: parsed.amount, percent: parsed.percent, basis, frequency, conditions,
          source, position: start, explanation: item.explanation, totalImpact: negated ? 0 : totalImpact, negated,
        });
      }
    }
  }
  return findings;
}

export function detectClaims(text: string, findings: CostFinding[], rate: number | null): DetectedClaim[] {
  return config.claimCatalog.flatMap((claim) => {
    const match = new RegExp(claim.pattern, "i").exec(text);
    if (!match || match.index === undefined) return [];
    const source = snippet(text, match.index, match.index + match[0].length + 60);
    const activeFindings = findings.filter((finding) => !finding.negated);
    let contradiction: string | null = null;
    if (claim.id === "no_cost" && (activeFindings.length > 0 || (rate ?? 0) > 0)) contradiction = "The document also lists financing costs or charges.";
    if (claim.id === "no_fees" && activeFindings.some((finding) => finding.totalImpact !== 0)) contradiction = "The document lists one or more non-waived fees or add-ons.";
    if (claim.id === "interest_free" && (rate ?? 0) > 0) contradiction = "An APR is stated elsewhere in the document.";
    if (claim.id === "optional" && activeFindings.some((finding) => /automatically added|included in the amount financed/i.test(finding.source))) contradiction = "The add-on is described as optional but is automatically included or added.";
    return [{ id: claim.id, label: claim.label, source, contradicted: contradiction !== null, contradiction }];
  });
}

export function detectGlossary(text: string): Array<{ term: string; definition: string }> {
  return config.glossary
    .filter((item) => new RegExp(item.pattern, "i").test(text))
    .map(({ term, definition }) => ({ term, definition }));
}

export function calculateRisk(text: string, docType: DocumentType, findings: CostFinding[], claims: DetectedClaim[], confidence: number): { score: number; band: "low" | "medium" | "high" | "insufficient_confidence"; breakdown: RiskBreakdownItem[] } {
  const categoryPoints: Record<string, number> = {};
  const reasons: Record<string, string[]> = {};
  const add = (category: string, points: number, reason: string) => {
    categoryPoints[category] = (categoryPoints[category] ?? 0) + points;
    (reasons[category] ??= []).push(reason);
  };

  for (const rule of config.riskRules) {
    if (rule.id === "claim_contradiction") {
      if (claims.some((claim) => claim.contradicted)) add(rule.category, rule.weight, "Document marketing claim conflicts with listed terms");
    } else if (rule.id === "high_apr") {
      const apr = text.match(/(?:apr|annual percentage rate)[^\d]{0,20}(\d+(?:\.\d+)?)\s*%|(\d+(?:\.\d+)?)\s*%\s*apr/i);
      if (apr && Number(apr[1] ?? apr[2]) >= 30) add(rule.category, rule.weight, `APR of ${apr[1] ?? apr[2]}%`);
    } else if (rule.id === "advance_fee_scam") {
      if (docType === "advance_fee_scam") add(rule.category, rule.weight, "Advance-fee scam signals detected");
    } else if (rule.pattern) {
      const pattern = new RegExp(rule.pattern, "gi");
      for (const match of text.matchAll(pattern)) {
        if (match.index === undefined) continue;
        const clause = findClause(text, match.index, match.index + match[0].length).source;
        if (isNegated(clause)) continue;
        add(rule.category, rule.weight, rule.id.replace(/_/g, " "));
        break;
      }
    }
  }

  const feeRisk = findings.filter((finding) => !finding.negated).reduce((sum, finding) => sum + finding.severity * 3, 0);
  if (feeRisk > 0) add("fees", feeRisk, `${findings.filter((finding) => !finding.negated).length} fee/add-on clause(s)`);
  if (["payday", "rent_to_own"].includes(docType)) add("document_type", 22, `${docType.replace(/_/g, " ")} pricing requires specialist review`);

  const breakdown = Object.entries(categoryPoints).map(([category, points]) => ({
    category,
    points: Math.min(points, config.riskCategoryCaps[category] ?? 20),
    reasons: reasons[category] ?? [],
  }));
  const score = Math.min(100, breakdown.reduce((sum, item) => sum + item.points, 0));
  const hasContradiction = claims.some((claim) => claim.contradicted);
  const band = confidence < 0.75
    ? "insufficient_confidence"
    : score >= 60 ? "high" : score >= 30 || hasContradiction ? "medium" : "low";
  return { score, band, breakdown };
}

export function scorePrincipalCandidates(
  candidates: ExtractedCandidate[], rate: number | null, term: ParsedDuration | null, statedEMI: number | null, docType: DocumentType,
): ExtractedField<number> {
  return resolvePrincipal(candidates, rate, term?.months ?? null, statedEMI, docType);
}
