// Local preview only: serves the static site and runs the Netlify function in-process.
import http from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import askAni from "./netlify/functions/ask-ani.mjs";
import askAniVoice from "./netlify/functions/ask-ani-voice.mjs";
import askAniAccess from "./netlify/functions/ask-ani-access.mjs";
import askAniApprove from "./netlify/functions/ask-ani-approve.mjs";
import askAniAdmin from "./netlify/functions/ask-ani-admin.mjs";

// --voice-stub: fake Gemini TTS with a tone, to test the voice UI before the real clone exists.
if (process.argv.includes("--voice-stub")) {
  process.env.GEMINI_API_KEY ||= "stub";
  process.env.GEMINI_VOICE_ID ||= "stub";
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    if (!String(url).includes("generativelanguage.googleapis.com")) return realFetch(url, init);
    const rate = 24000, secs = 3, pcm = Buffer.alloc(rate * 2 * secs);
    for (let i = 0; i < rate * secs; i++) pcm.writeInt16LE(Math.round(Math.sin((2 * Math.PI * 330 * i) / rate) * 6000 * Math.min(1, (rate * secs - i) / 2000)), i * 2);
    const h = Buffer.alloc(44);
    h.write("RIFF", 0); h.writeUInt32LE(36 + pcm.length, 4); h.write("WAVEfmt ", 8); h.writeUInt32LE(16, 16);
    h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22); h.writeUInt32LE(rate, 24); h.writeUInt32LE(rate * 2, 28);
    h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34); h.write("data", 36); h.writeUInt32LE(pcm.length, 40);
    const data = Buffer.concat([h, pcm]).toString("base64");
    return new Response(JSON.stringify({ steps: [{ type: "model_output", content: [{ type: "audio", mime_type: "audio/wav", data }] }] }));
  };
  console.log("voice stub ON: Gemini replaced by a 3s tone");
}

process.env.ASK_ANI_LOCAL_DEV = "1";
const PORT = Number(process.env.PORT || 8899);
const ROOT = path.dirname(fileURLToPath(import.meta.url));
process.chdir(ROOT);
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".svg": "image/svg+xml", ".pdf": "application/pdf", ".json": "application/json" };
const BLOCKED = [/^\/knowledge\//, /^\/netlify\//, /^\/node_modules\//, /^\/\.env/, /^\/package/, /^\/dev-server/, /^\/scripts\//];

async function readBody(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  return Buffer.concat(chunks);
}

http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  try {
    const fn = { "/api/ask-ani": askAni, "/api/ask-ani-voice": askAniVoice, "/api/ask-ani-access": askAniAccess, "/api/ask-ani-approve": askAniApprove, "/api/ask-ani-admin": askAniAdmin }[url.pathname];
    if (fn) {
      const body = req.method === "POST" ? await readBody(req) : undefined;
      const request = new Request(url, { method: req.method, headers: req.headers, body });
      const response = await fn(request, { ip: req.socket.remoteAddress });
      res.writeHead(response.status, Object.fromEntries(response.headers));
      return res.end(Buffer.from(await response.arrayBuffer()));
    }
    if (req.method === "POST" && url.pathname === "/") {
      const form = new URLSearchParams((await readBody(req)).toString());
      if (form.get("form-name") === "ask-ani-leads") console.log(`[lead email to Ani] ${form.get("name")} <${form.get("email")}> from ${form.get("page")}\n  approve: ${form.get("approve_link")}\n  deny:    ${form.get("deny_link")}`);
      else console.log(`[form "${form.get("form-name")}"] ${form.get("name")} <${form.get("email")}> (Netlify Forms stores this in production)`);
      res.writeHead(200);
      return res.end("ok");
    }
    const rel = decodeURIComponent(url.pathname);
    if (BLOCKED.some((r) => r.test(rel))) { res.writeHead(404); return res.end("not found"); }
    let file = path.join(ROOT, rel);
    if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
    if ((await stat(file).catch(() => null))?.isDirectory()) file = path.join(file, "index.html");
    const data = await readFile(file);
    res.writeHead(200, { "content-type": TYPES[path.extname(file).toLowerCase()] || "application/octet-stream" });
    res.end(data);
  } catch {
    res.writeHead(404);
    res.end("not found");
  }
}).listen(PORT, () => console.log(`Ask bot local preview on http://localhost:${PORT}`));
