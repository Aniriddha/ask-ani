// One-time, local only. Creates Ani's cloned voice with the provider in VOICE_PROVIDER (default gemini)
// and saves its ID to .env. Usage: npm run create-voice  (reads keys from .env)
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createVoice, providerName, voiceEnvKey } from "../netlify/lib/tts.mjs";

const SITE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const AUDIO_DIR = process.env.VOICE_AUDIO_DIR
  || path.join(SITE, "voice");
const RATE = 24000;

function find(base) {
  for (const ext of [".wav", ".m4a", ".aiff", ".mp3"]) {
    const p = path.join(AUDIO_DIR, base + ext);
    if (existsSync(p)) return p;
  }
  throw new Error(`missing ${base}.wav (or .m4a) in ${AUDIO_DIR}`);
}

function toWav(src, tmp, maxSeconds) {
  const out = path.join(tmp, path.basename(src).replace(/\.[^.]+$/, "") + ".wav");
  execFileSync("afconvert", ["-f", "WAVE", "-d", `LEI16@${RATE}`, "-c", "1", src, out]);
  let buf = readFileSync(out);
  let i = 12;
  while (buf.toString("ascii", i, i + 4) !== "data") i += 8 + buf.readUInt32LE(i + 4);
  const dataStart = i + 8;
  const dataLen = buf.readUInt32LE(i + 4);
  const seconds = dataLen / (RATE * 2);
  if (maxSeconds && seconds > maxSeconds) {
    const keep = maxSeconds * RATE * 2;
    buf = Buffer.concat([buf.subarray(0, dataStart), buf.subarray(dataStart, dataStart + keep)]);
    buf.writeUInt32LE(keep, i + 4);
    buf.writeUInt32LE(buf.length - 8, 4);
  }
  return { buf, seconds };
}

function saveEnv(key, value) {
  const envPath = path.join(SITE, ".env");
  const lines = existsSync(envPath) ? readFileSync(envPath, "utf8").split("\n").filter((l) => l && !l.startsWith(`${key}=`)) : [];
  lines.push(`${key}=${value}`);
  writeFileSync(envPath, lines.join("\n") + "\n", { mode: 0o600 });
}

const tmp = mkdtempSync(path.join(os.tmpdir(), "ask-ani-voice-"));
try {
  const ref = toWav(find("ani_reference"), tmp, 30);
  const consent = toWav(find("ani_consent"), tmp, 30);
  if (ref.seconds < 10) throw new Error(`reference is ${ref.seconds.toFixed(1)}s, needs at least 10s`);
  console.log(`reference ${ref.seconds.toFixed(1)}s${ref.seconds > 30 ? " (trimmed to 30s)" : ""}, consent ${consent.seconds.toFixed(1)}s`);

  const id = await createVoice({ source: ref.buf, consent: consent.buf, displayName: `${process.env.BOT_OWNER_NAME || "Owner"} (chatbot voice)` });
  saveEnv(voiceEnvKey(), id);
  console.log(`${providerName()} voice created and saved to .env as ${voiceEnvKey()} (${id.slice(0, 10)}...).`);
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
