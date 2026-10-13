import { spawn } from "node:child_process";
import { existsSync, createReadStream } from "node:fs";
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { join, resolve, dirname, sep } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const chrome = process.env.CHROME_BIN || [
  "C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "/usr/bin/google-chrome", "/usr/bin/chromium", "/usr/bin/chromium-browser", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
].find(existsSync);
if (!chrome) throw new Error("Chrome/Chromium is required for real upload evaluation. Set CHROME_BIN to its executable.");

async function loadCases(directory) {
  if (!existsSync(directory)) return [];
  const cases = [];
  for (const name of (await readdir(directory)).filter((name) => name.endsWith(".json")).sort()) {
    const parsed = JSON.parse(await readFile(join(directory, name), "utf8"));
    cases.push(...(Array.isArray(parsed) ? parsed : [parsed]));
  }
  return cases;
}

function connect(url) {
  return new Promise((resolveConnection, reject) => {
    const socket = new WebSocket(url), pending = new Map();
    let id = 0;
    socket.addEventListener("error", reject, { once: true });
    socket.addEventListener("message", (event) => {
      const message = JSON.parse(event.data), command = pending.get(message.id);
      if (!command) return;
      clearTimeout(command.timer); pending.delete(message.id);
      if (message.error) command.reject(new Error(JSON.stringify(message.error))); else command.resolve(message.result);
    });
    socket.addEventListener("close", () => {
      for (const command of pending.values()) { clearTimeout(command.timer); command.reject(new Error("Browser connection closed")); }
    });
    socket.addEventListener("open", () => resolveConnection({
      close: () => socket.close(),
      send(method, params = {}, sessionId) {
        return new Promise((resolveCommand, rejectCommand) => {
          const commandId = ++id;
          const timer = setTimeout(() => { pending.delete(commandId); rejectCommand(new Error(`${method} timed out`)); }, 180_000);
          pending.set(commandId, { resolve: resolveCommand, reject: rejectCommand, timer });
          socket.send(JSON.stringify({ id: commandId, method, params, ...(sessionId ? { sessionId } : {}) }));
        });
      },
    }), { once: true });
  });
}

const work = await mkdtemp(join(tmpdir(), "true-cost-upload-eval-"));
let server, browser, cdp;
try {
  // Cache only the public English OCR model. No document is sent to this download host.
  const cache = resolve(process.env.TRUE_COST_OCR_CACHE || join(tmpdir(), "true-cost-ocr-models"));
  await mkdir(cache, { recursive: true });
  const languageFile = join(cache, "eng.traineddata.gz");
  if (!existsSync(languageFile)) {
    console.log("Downloading the public English OCR model (cached for later runs)...");
    const response = await fetch("https://tessdata.projectnaptha.com/4.0.0/eng.traineddata.gz", { signal: AbortSignal.timeout(60_000) });
    if (!response.ok) throw new Error(`OCR model download failed: ${response.status}`);
    await writeFile(languageFile, new Uint8Array(await response.arrayBuffer()));
  }
  server = await createServer({ root, server: { host: "127.0.0.1", port: 0, open: false }, logLevel: "error",
    plugins: [{ name: "upload-evaluation-assets", configureServer(vite) {
      vite.middlewares.use((request, response, next) => {
        const url = (request.url || "").split("?")[0];
        if (url === "/__upload_eval") { response.setHeader("Content-Type", "text/html"); response.end("<!doctype html><html><head></head><body></body></html>"); return; }
        if (!url.startsWith("/__upload_assets/")) return next();
        const name = url.slice("/__upload_assets/".length);
        const file = name === "worker.min.js" ? join(root, "node_modules/tesseract.js/dist/worker.min.js")
          : name === "eng.traineddata.gz" ? languageFile
          : /^tesseract-core[\w.-]+\.(?:js|wasm)$/.test(name) ? join(root, "node_modules/tesseract.js-core", name) : null;
        if (!file || !existsSync(file)) { response.statusCode = 404; response.end(); return; }
        response.setHeader("Content-Type", name.endsWith(".js") ? "application/javascript" : name.endsWith(".wasm") ? "application/wasm" : "application/octet-stream");
        createReadStream(file).pipe(response);
      });
    } }],
  });
  await server.listen();
  const address = server.httpServer.address();
  const origin = `http://127.0.0.1:${address.port}`;
  browser = spawn(chrome, ["--headless=new", "--remote-debugging-port=0", `--user-data-dir=${join(work, "profile")}`, "--no-first-run", "--no-default-browser-check",
    ...(process.getuid?.() === 0 ? ["--no-sandbox"] : []), "about:blank"], { windowsHide: true, stdio: ["ignore", "ignore", "pipe"] });
  const debuggerUrl = await new Promise((resolveUrl, reject) => {
    let stderr = "";
    const timer = setTimeout(() => reject(new Error("Chrome did not expose its debugging port")), 20_000);
    browser.once("error", reject);
    browser.stderr.on("data", (data) => { stderr += data.toString(); const match = stderr.match(/DevTools listening on (ws:\/\/\S+)/); if (match) { clearTimeout(timer); resolveUrl(match[1]); } });
  });
  cdp = await connect(debuggerUrl);
  const { targetId } = await cdp.send("Target.createTarget", { url: `${origin}/__upload_eval` });
  const { sessionId } = await cdp.send("Target.attachToTarget", { targetId, flatten: true });
  const send = (method, params) => cdp.send(method, params, sessionId);
  await send("Page.enable");
  async function evaluate(expression) {
    const result = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
    return result.result.value;
  }
  await evaluate(`new Promise(resolve => document.readyState === 'complete' ? resolve(true) : addEventListener('load', () => resolve(true), { once: true }))`);
  const { frameTree } = await send("Page.getFrameTree");
  const assetOptions = { workerPath: `${origin}/__upload_assets/worker.min.js`, corePath: `${origin}/__upload_assets`, langPath: `${origin}/__upload_assets` };
  let failed = false;
  for (const partition of ["dev", "heldout"]) {
    const samples = await loadCases(join(root, "tests", partition));
    console.log(`\n${partition.toUpperCase()} real PDF + phone-image evaluation (${samples.length} documents)`);
    if (!samples.length) { console.log("NOT EVALUATED: no owner documents supplied."); continue; }
    const results = [];
    for (const sample of samples) {
      const escaped = sample.text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      await send("Page.setDocumentContent", { frameId: frameTree.frame.id, html: `<!doctype html><html><head><style>@page {size: A4; margin: 18mm;} body {font: 14px Arial; line-height: 1.55; margin: 0;} pre {font: inherit; white-space: pre-wrap; overflow-wrap: break-word;}</style></head><body><pre>${escaped}</pre></body></html>` });
      const printed = await send("Page.printToPDF", { printBackground: true, preferCSSPageSize: true });
      const measured = await evaluate(`import('/tests/upload.browser.ts').then(module => module.evaluateUpload(${JSON.stringify(sample)}, ${JSON.stringify(printed.data)}, ${JSON.stringify(assetOptions)}))`);
      results.push(...measured);
      for (const item of measured) {
        console.log(`${sample.name} · ${item.format}: ${(item.similarity * 100).toFixed(2)}% · band ${item.originalBand} -> ${item.band} · confidently wrong ${item.confidentlyWrong}`);
        if (item.similarity < item.minimumSimilarity || item.originalBand !== item.band || item.confidentlyWrong > 0 || (partition === "dev" && item.fields.some((field) => !field.correct))) {
          failed = true;
          for (const field of item.fields.filter((field) => !field.correct)) console.log(`  ${field.field}: expected ${field.expected}, got ${field.actual} (${Math.round(field.confidence * 100)}% confidence)`);
          if (item.extractedText) console.log(`  Extracted: ${item.extractedText}`);
        }
      }
    }
    for (const format of ["pdf", "image"]) {
      const items = results.filter((item) => item.format === format);
      const fields = [...new Set(items.flatMap((item) => item.fields.map((field) => field.field)))];
      console.log(`${format.toUpperCase()} scoreboard`);
      for (const field of fields) {
        const measured = items.flatMap((item) => item.fields.filter((value) => value.field === field));
        console.log(`  ${field}: ${measured.filter((value) => value.correct).length}/${measured.length}`);
      }
      console.log(`  Unchanged bands: ${items.filter((item) => item.band === item.originalBand).length}/${items.length}; confidently wrong: ${items.reduce((sum, item) => sum + item.confidentlyWrong, 0)}`);
    }
  }
  if (failed) process.exitCode = 1;
} finally {
  if (cdp) { await cdp.send("Browser.close").catch(() => {}); cdp.close(); }
  browser?.kill();
  await server?.close();
  // Only remove this invocation's verified temporary directory.
  if (resolve(work).startsWith(resolve(tmpdir()) + sep) && work.includes("true-cost-upload-eval-")) await rm(work, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
}
