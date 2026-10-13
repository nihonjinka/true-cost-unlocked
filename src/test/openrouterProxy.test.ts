import { afterEach, describe, expect, it, vi } from "vitest";
import { handleOpenRouter } from "../../server/openrouter";

const request = (body: unknown = { messages: [{ role: "user", content: "Review the documented clauses." }] }, origin = "https://truecost.example") =>
  new Request("https://truecost.example/.netlify/functions/openrouter", { method: "POST", headers: { origin }, body: JSON.stringify(body) });
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

describe("server AI proxy", () => {
  it("uses the deployment's existing key only on the server and limits requested output", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ choices: [{ message: { content: "Draft" } }], other: "not forwarded" })));
    vi.stubGlobal("fetch", fetchMock);
    const response = await handleOpenRouter(request({ messages: [{ role: "user", content: "Review" }], max_tokens: 99999, model: "client-cannot-choose" }), { VITE_OPENROUTER_API_KEY: "server-only-test-secret" });
    const [, options] = fetchMock.mock.calls[0];
    expect(options.headers.Authorization).toBe("Bearer server-only-test-secret");
    expect(JSON.parse(options.body)).toMatchObject({ model: "openai/gpt-4o-mini", max_tokens: 8000 });
    const text = await response.text();
    expect(text).not.toContain("secret");
    expect(text).not.toContain("not forwarded");
  });

  it("rejects cross-origin requests and malformed messages before contacting the provider", async () => {
    const fetchMock = vi.fn(); vi.stubGlobal("fetch", fetchMock);
    expect((await handleOpenRouter(request({}, "https://different.example"), { OPENROUTER_API_KEY: "test" })).status).toBe(403);
    expect((await handleOpenRouter(request({ messages: [{ role: "tool", content: "bad" }] }), { OPENROUTER_API_KEY: "test" })).status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("reports configuration failure and hides provider diagnostic bodies", async () => {
    const missing = await handleOpenRouter(request(), {});
    expect(missing.status).toBe(503);
    expect(await missing.text()).toContain("not configured");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("sensitive upstream diagnostic", { status: 401 })));
    const rejected = await handleOpenRouter(request(), { OPENROUTER_API_KEY: "test" });
    expect(rejected.status).toBe(502);
    expect(await rejected.text()).not.toContain("sensitive");
  });

  it("bounds chunked requests before calling the provider", async () => {
    const fetchMock = vi.fn(); vi.stubGlobal("fetch", fetchMock);
    const response = await handleOpenRouter(request({ messages: [{ role: "user", content: "x".repeat(300_001) }] }), { OPENROUTER_API_KEY: "test" });
    expect(response.status).toBe(413);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("marks transient provider failures retryable without exposing diagnostics", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("private trace", { status: 500 })));
    const response = await handleOpenRouter(request(), { OPENROUTER_API_KEY: "test" });
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain("private trace");
  });

  it("aborts the provider request after the server deadline", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn((_url, options: RequestInit) => new Promise<Response>((_resolve, reject) => {
      options.signal!.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
    }));
    vi.stubGlobal("fetch", fetchMock);
    const pending = handleOpenRouter(request(), { OPENROUTER_API_KEY: "test" });
    await vi.advanceTimersByTimeAsync(28_000);
    const response = await pending;
    expect(response.status).toBe(504);
    expect(await response.text()).toContain("timed out");
    expect(fetchMock.mock.calls[0][1].signal?.aborted).toBe(true);
  });
});
