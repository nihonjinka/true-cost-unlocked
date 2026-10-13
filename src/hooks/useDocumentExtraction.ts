import { useEffect, useRef, useState } from "react";
import { extractValuesFromText } from "@/lib/analyzeLocally";
import type { ExtractionResponse } from "@/lib/extractionWorkerTypes";

/** A dedicated worker keeps long OCR documents from blocking edits or animations. */
export function useDocumentExtraction(text: string, delay = 180) {
  const [result, setResult] = useState(() => ({ text: "", values: extractValuesFromText(""), error: null as string | null }));
  const worker = useRef<Worker | null>(null);
  const version = useRef(0);
  const active = useRef(false);
  const workerUnavailable = useRef(false);

  useEffect(() => {
    const id = ++version.current;
    // Cancel work for an obsolete document instead of accumulating a worker queue.
    if (active.current) { worker.current?.terminate(); worker.current = null; active.current = false; }
    const apply = (response: ExtractionResponse) => {
      if (response.id !== version.current) return;
      active.current = false;
      setResult({ text: response.text, values: response.values ?? extractValuesFromText(""), error: response.error ?? null });
    };
    const fallback = () => {
      if (id !== version.current) return;
      try { apply({ id, text, values: extractValuesFromText(text) }); }
      catch (error) { apply({ id, text, error: error instanceof Error ? error.message : "Unable to extract document fields." }); }
    };
    const timer = setTimeout(() => {
      if (!text.trim() || workerUnavailable.current || typeof Worker === "undefined") { fallback(); return; }
      try {
        if (!worker.current) worker.current = new Worker(new URL("../lib/extractionWorker.ts", import.meta.url), { type: "module" });
        worker.current.onmessage = ({ data }: MessageEvent<ExtractionResponse>) => apply(data);
        const failed = () => {
          if (id !== version.current) return;
          worker.current?.terminate(); worker.current = null;
          workerUnavailable.current = true;
          fallback();
        };
        worker.current.onerror = failed;
        worker.current.onmessageerror = failed;
        active.current = true;
        worker.current.postMessage({ id, text });
      } catch {
        worker.current?.terminate(); worker.current = null;
        workerUnavailable.current = true;
        fallback();
      }
    }, delay);
    return () => { clearTimeout(timer); version.current += 1; };
  }, [text, delay]);

  useEffect(() => () => { worker.current?.terminate(); worker.current = null; }, []);
  return { extractedValues: result.values, extracting: result.text !== text, error: result.error };
}
