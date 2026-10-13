import type { ExtractedValues } from "./analyzeLocally";

export interface ExtractionRequest { id: number; text: string }
export type ExtractionResponse = { id: number; text: string } & ({ values: ExtractedValues; error?: never } | { error: string; values?: never });
