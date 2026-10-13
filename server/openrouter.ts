interface CompletionRequest {
  messages: Array<{ role: "system" | "user"; content: string }>;
  max_tokens?: number;
  response_format?: { type: "json_object" };
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
});

/** Shared by the deployment function and Vite. Credentials never enter browser code. */
export async function handleOpenRouter(request: Request, env: Record<string, string | undefined>): Promise<Response> {
  if (request.method !== "POST") return json({ error: "Use POST to request AI assistance." }, 405);
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return json({ error: "Request origin is not allowed." }, 403);
  const key = env.OPENROUTER_API_KEY?.trim() || env.VITE_OPENROUTER_API_KEY?.trim();
  if (!key) return json({ error: "AI is not configured on the server. Set OPENROUTER_API_KEY in the deployment environment." }, 503);
  if (Number(request.headers.get("content-length")) > 300_000) return json({ error: "AI request is too large." }, 413);
  let body: CompletionRequest;
  try {
    const reader = request.body?.getReader();
    if (!reader) return json({ error: "Missing AI request." }, 400);
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > 300_000) { await reader.cancel(); return json({ error: "AI request is too large." }, 413); }
      chunks.push(chunk.value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    body = JSON.parse(new TextDecoder().decode(bytes));
    if (!body || !Array.isArray(body.messages) || body.messages.length < 1 || body.messages.length > 8 ||
      body.messages.some((message) => !message || !["system", "user"].includes(message.role) || typeof message.content !== "string")) {
      return json({ error: "Invalid AI messages." }, 400);
    }
  } catch { return json({ error: "Invalid AI request." }, 400); }

  const controller = new AbortController();
  const abort = () => controller.abort();
  request.signal.addEventListener("abort", abort, { once: true });
  if (request.signal.aborted) controller.abort();
  const timer = setTimeout(abort, 28_000);
  try {
    const upstream = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST", signal: controller.signal,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: env.OPENROUTER_MODEL || "openai/gpt-4o-mini",
        messages: body.messages.map(({ role, content }) => ({ role, content })), temperature: 0.2,
        max_tokens: Math.max(256, Math.min(8000, Math.floor(Number(body.max_tokens) || 2400))),
        ...(body.response_format?.type === "json_object" ? { response_format: { type: "json_object" } } : {}),
      }),
    });
    if (!upstream.ok) {
      const error = upstream.status === 429 ? "AI provider is busy. Please retry shortly."
        : upstream.status === 401 || upstream.status === 403 ? "AI server credentials were rejected by the provider."
          : upstream.status === 402 ? "AI provider credits are exhausted."
            : "AI provider could not complete this request. Please retry.";
      return json({ error }, upstream.status === 429 ? 429 : upstream.status >= 500 ? 503 : 502);
    }
    const payload = await upstream.json() as { choices?: unknown };
    return json({ choices: payload.choices });
  } catch {
    return json({ error: controller.signal.aborted ? "AI request timed out or was cancelled. Please retry." : "AI provider is temporarily unreachable. Please retry." }, controller.signal.aborted ? 504 : 503);
  } finally {
    clearTimeout(timer);
    request.signal.removeEventListener("abort", abort);
  }
}
