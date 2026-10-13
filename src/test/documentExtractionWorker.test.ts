import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useDocumentExtraction } from "@/hooks/useDocumentExtraction";
import { extractValuesFromText } from "@/lib/analyzeLocally";
import type { ExtractionRequest, ExtractionResponse } from "@/lib/extractionWorkerTypes";

class MockWorker {
  static instances: MockWorker[] = [];
  constructor() { MockWorker.instances.push(this); }
  onmessage: ((event: MessageEvent<ExtractionResponse>) => void) | null = null;
  onerror: (() => void) | null = null;
  onmessageerror: (() => void) | null = null;
  postMessage = vi.fn<(request: ExtractionRequest) => void>();
  terminate = vi.fn();
  reply(text: string) {
    const id = this.postMessage.mock.calls.at(-1)![0].id;
    this.onmessage?.({ data: { id, text, values: extractValuesFromText(text) } } as MessageEvent<ExtractionResponse>);
  }
}
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); MockWorker.instances = []; });

describe("background input extraction", () => {
  it("debounces worker extraction and rejects results from an obsolete document", async () => {
    vi.useFakeTimers(); vi.stubGlobal("Worker", MockWorker);
    const first = "Principal: $1000. APR: 5%. Term: 12 months.";
    const second = "Principal: $2000. APR: 6%. Term: 24 months.";
    const { result, rerender, unmount } = renderHook(({ text }) => useDocumentExtraction(text, 50), { initialProps: { text: first } });
    expect(result.current.extracting).toBe(true);
    await act(() => vi.advanceTimersByTimeAsync(50));
    const obsolete = MockWorker.instances[0];
    rerender({ text: second });
    expect(obsolete.terminate).toHaveBeenCalledOnce();
    await act(() => vi.advanceTimersByTimeAsync(50));
    act(() => obsolete.reply(first));
    act(() => obsolete.onerror?.());
    expect(MockWorker.instances[1].terminate).not.toHaveBeenCalled();
    expect(result.current.extracting).toBe(true);
    act(() => MockWorker.instances[1].reply(second));
    expect(result.current.extractedValues.loanAmount).toBe(2000);
    expect(result.current.extracting).toBe(false);
    unmount();
    expect(MockWorker.instances[1].terminate).toHaveBeenCalledOnce();
  });

  it("keeps extraction usable when a browser or policy prevents workers", async () => {
    vi.useFakeTimers(); vi.stubGlobal("Worker", undefined);
    const { result } = renderHook(() => useDocumentExtraction("Principal: $3000. APR: 7%. Term: 36 months.", 10));
    await act(() => vi.advanceTimersByTimeAsync(10));
    expect(result.current.extractedValues.loanAmount).toBe(3000);
    expect(result.current.error).toBeNull();
  });

  it("recovers from worker initialization failure and cancels pending work on unmount", async () => {
    vi.useFakeTimers(); vi.stubGlobal("Worker", MockWorker);
    const { result, unmount } = renderHook(() => useDocumentExtraction("Principal: $4000. APR: 8%. Term: 48 months.", 10));
    await act(() => vi.advanceTimersByTimeAsync(10));
    act(() => MockWorker.instances[0].onerror?.());
    expect(result.current.extractedValues.loanAmount).toBe(4000);
    expect(result.current.extracting).toBe(false);
    expect(MockWorker.instances[0].terminate).toHaveBeenCalledOnce();
    unmount();
  });
});
