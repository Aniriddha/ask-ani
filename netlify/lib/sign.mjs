import { createHmac, timingSafeEqual } from "node:crypto";
import { voiceConfigured } from "./tts.mjs";

// Signs bot answers so the voice endpoint only ever speaks text the bot actually produced.
// purpose keeps the two uses apart: a signed bot answer can never double as an approval link signature.
export function sign(text, purpose = "answer") {
  const secret = process.env.ASK_ANI_SIGNING_SECRET;
  if (!secret) return null;
  return createHmac("sha256", secret).update(`${purpose}\n${text}`).digest("base64url");
}

export function verify(text, sig, purpose = "answer") {
  const expected = sign(text, purpose);
  if (!expected || typeof sig !== "string") return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(sig);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function voiceEnabled() {
  return Boolean(process.env.ASK_ANI_SIGNING_SECRET) && voiceConfigured();
}
