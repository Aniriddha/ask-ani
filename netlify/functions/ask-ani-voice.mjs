import { limitsFromEnv, overLimit } from "../lib/rate-limit.mjs";
import { verify, voiceEnabled } from "../lib/sign.mjs";
import { isApproved } from "../lib/access.mjs";
import { providerName, synthesize } from "../lib/tts.mjs";

export const config = { path: "/api/ask-ani-voice" };

const MAX_WORDS = Number(process.env.ASK_ANI_VOICE_MAX_WORDS || 150);
const LIMITS = limitsFromEnv("ASK_ANI_VOICE");

function capWords(text) {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length <= MAX_WORDS) return { text, words: words.length, capped: false };
  let cut = words.slice(0, MAX_WORDS).join(" ");
  const lastStop = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("? "), cut.lastIndexOf("! "));
  if (lastStop > cut.length * 0.5) cut = cut.slice(0, lastStop + 1);
  return { text: cut, words: cut.split(/\s+/).length, capped: true };
}

function json(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

export default async (req, context) => {
  if (req.method !== "POST") return json(405, { error: "method not allowed" });
  if (!voiceEnabled()) return json(503, { error: "voice is off" });

  let body;
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "bad request" });
  }

  const email = String(body?.visitor?.email || "");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json(400, { error: "name and email required" });
  if (!(await isApproved(body?.visitor?.id))) return json(403, { error: "not approved" });

  const text = typeof body?.text === "string" ? body.text : "";
  if (!text || text.length > 2000 || !verify(text, body?.sig)) return json(403, { error: "can only voice answers from the bot" });

  const ip = context?.ip || req.headers.get("x-nf-client-connection-ip") || "unknown";
  const limited = await overLimit("voice", ip, LIMITS);
  if (limited) return json(429, { error: limited });

  const spoken = capWords(text);
  const started = Date.now();

  let result;
  try {
    result = await synthesize(spoken.text);
  } catch (err) {
    console.error(`ask-ani-voice ${providerName()} error:`, err?.message);
    return json(502, { error: "voice unavailable right now" });
  }

  const { usd, ...meta } = result.meta || {};
  console.log(JSON.stringify({
    evt: "ask-ani-voice", provider: providerName(), ...meta, words: spoken.words, capped: spoken.capped,
    usd: usd == null ? "unknown" : +usd.toFixed(5), ms: Date.now() - started,
  }));

  return new Response(result.audio, {
    status: 200,
    headers: { "content-type": result.contentType, "cache-control": "private, max-age=3600" },
  });
};
