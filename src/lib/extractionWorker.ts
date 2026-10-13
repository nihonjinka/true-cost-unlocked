import { extractValuesFromText } from "./analyzeLocally";
import type { ExtractionRequest, ExtractionResponse } from "./extractionWorkerTypes";

self.onmessage = ({ data }: MessageEvent<ExtractionRequest>) => {
  let response: ExtractionResponse;
  try { response = { id: data.id, text: data.text, values: extractValuesFromText(data.text) }; }
  catch (error) { response = { id: data.id, text: data.text, error: error instanceof Error ? error.message : "Unable to extract document fields." }; }
  self.postMessage(response);
};
