// Local readiness check for Ask Ani. Prints names and pass/fail only, never values.
// Usage: npm run preflight
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SITE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const AUDIO_DIR = process.env.VOICE_AUDIO_DIR
  || path.join(SITE, "voice");

let failures = 0;
const ok = (msg) => console.log(`  ok    ${msg}`);
const todo = (msg) => console.log(`  todo  ${msg}`);
const fail = (msg) => { failures++; console.log(`  FAIL  ${msg}`); };

function readEnvFile() {
  const p = path.join(SITE, ".env");
  if (!existsSync(p)) return null;
  const env = {};
  for (const line of readFileSync(p, "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) env[m[1]] = (env[m[1]] === undefined ? "" : env[m[1]] + "\n") + m[2];
  }
  return env;
}

function checkValue(name, value, shape) {
  if (value === undefined) return fail(`${name} missing from .env`);
  if (value.includes("\n")) return fail(`${name} appears more than once in .env`);
  if (!value.trim()) return fail(`${name} is empty`);
  if (/\s/.test(value)) return fail(`${name} contains spaces, likely a paste problem`);
  if (shape && !shape.test(value)) return fail(`${name} doesn't look right (wrong length or format, maybe pasted twice)`);
  ok(`${name} set`);
}

function seconds(file) {
  const out = execFileSync("afinfo", [file], { encoding: "utf8" });
  const m = out.match(/estimated duration:\s*([\d.]+)/);
  return m ? Number(m[1]) : NaN;
}

function findClip(base) {
  for (const ext of [".wav", ".m4a", ".aiff", ".mp3"]) {
    const p = path.join(AUDIO_DIR, base + ext);
    if (existsSync(p)) return p;
  }
  return null;
}

console.log("\nAsk Ani preflight\n");

console.log(".env (local)");
const env = readEnvFile();
const provider = (env?.VOICE_PROVIDER || "gemini").trim().toLowerCase();
if (!env) {
  fail(".env not found");
} else {
  checkValue("ANTHROPIC_API_KEY", env.ANTHROPIC_API_KEY, /^sk-ant-[A-Za-z0-9_-]{80,120}$/);
  checkValue("ASK_ANI_SIGNING_SECRET", env.ASK_ANI_SIGNING_SECRET, /^.{32,}$/);
  if (provider === "gemini") {
    checkValue("GEMINI_API_KEY", env.GEMINI_API_KEY, /^\S{30,120}$/);
    if (env.GEMINI_VOICE_ID?.trim()) ok("GEMINI_VOICE_ID set");
    else todo("GEMINI_VOICE_ID not set yet, run `npm run create-voice` once the clips pass");
  } else if (provider === "elevenlabs") {
    fail("VOICE_PROVIDER=elevenlabs but the elevenlabs provider is still a stub");
  } else {
    fail(`unknown VOICE_PROVIDER "${provider}"`);
  }
}

console.log("\nknowledge file");
const kb = path.join(SITE, process.env.KNOWLEDGE_FILE || "knowledge/profile.md");
if (!existsSync(kb)) fail("knowledge file missing");
else if (statSync(kb).size < 2000) fail(`knowledge file is only ${statSync(kb).size} bytes`);
else ok(`knowledge file present (${Math.round(statSync(kb).size / 1024)} KB)`);
const qa = path.join(SITE, "knowledge/questions-to-answer.md");
if (existsSync(qa)) {
  const answers = readFileSync(qa, "utf8").match(/^\s*A:(.*)$/gm) || [];
  const filled = answers.filter((a) => a.replace(/^\s*A:/, "").trim()).length;
  (filled ? ok : todo)(`questions-to-answer.md: ${filled} of ${answers.length} answered`);
}

console.log(`\nvoice clips (${AUDIO_DIR})`);
const ref = findClip("ani_reference");
if (!ref) fail("ani_reference (.wav or .m4a) missing");
else {
  const s = seconds(ref);
  if (s >= 10 && s <= 30) ok(`${path.basename(ref)}: ${s.toFixed(1)}s`);
  else fail(`${path.basename(ref)}: ${s.toFixed(1)}s, needs 10 to 30 seconds`);
}
const consent = findClip("ani_consent");
if (!consent) fail("ani_consent (.wav or .m4a) missing");
else {
  // The consent sentence takes about 6 seconds to say; Google sets no minimum for it.
  const s = seconds(consent);
  if (s >= 3 && s <= 30) ok(`${path.basename(consent)}: ${s.toFixed(1)}s`);
  else fail(`${path.basename(consent)}: ${s.toFixed(1)}s, expected 3 to 30 seconds for the consent sentence`);
}

console.log("\nNetlify environment variables to set before deploy (can't be checked from here)");
const netlifyVars = ["ANTHROPIC_API_KEY", "ASK_ANI_SIGNING_SECRET"];
if (provider === "gemini") netlifyVars.push("GEMINI_API_KEY", "GEMINI_VOICE_ID");
for (const name of netlifyVars) todo(`${name}  (Site configuration > Environment variables, same value as .env)`);
todo("VOICE_PROVIDER  (optional, defaults to gemini)");


console.log(failures ? `\n${failures} check(s) failed.\n` : "\nall local checks passed.\n");
process.exit(failures ? 1 : 0);
