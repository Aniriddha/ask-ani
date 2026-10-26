// Voice provider for Ask Ani. Pick with VOICE_PROVIDER=gemini (default) or elevenlabs.
// Callers use only: providerName(), voiceConfigured(), synthesize(text), createVoice(audio).

const SAMPLE_RATE = 24000;

export class TtsError extends Error {}

const gemini = {
  name: "gemini",
  voiceEnvKey: "GEMINI_VOICE_ID",
  model: () => process.env.ASK_ANI_TTS_MODEL || "gemini-3.8-flash-tts",
  style: "calm, warm and conversational, natural pace, like talking to someone over coffee",
  audioTokensPerSec: 25,
  // USD per 1M tokens, from ai.google.dev/gemini-api/docs/pricing. Prices double on 2027-01-01.
  prices: {
    "gemini-3.8-flash-tts": [{ until: "2027-01-01", in: 0.5, out: 9 }, { in: 1, out: 18 }],
    "gemini-3.8-flash-lite-tts": [{ until: "2027-01-01", in: 0.5, out: 6 }, { in: 1, out: 12 }],
  },

  configured() {
    return Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_VOICE_ID);
  },

  async synthesize(text) {
    const model = this.model();
    let res;
    try {
      res = await fetch("https://generativelanguage.googleapis.com/v1beta/interactions", {
        method: "POST",
        headers: { "x-goog-api-key": process.env.GEMINI_API_KEY, "content-type": "application/json" },
        signal: AbortSignal.timeout(25000),
        body: JSON.stringify({
          model,
          input: [{
            type: "user_input",
            content: [{ type: "text", text, annotations: [{ type: "speech_metadata", style: this.style }] }],
          }],
          response_format: { type: "audio", mime_type: "audio/wav", sample_rate: SAMPLE_RATE },
          generation_config: { speech_config: [{ voice: process.env.GEMINI_VOICE_ID }] },
        }),
      });
    } catch (err) {
      throw new TtsError(`network: ${err?.name} ${err?.message}`);
    }

    const data = await res.json().catch(() => null);
    if (!res.ok || !data) throw new TtsError(`http ${res.status}: ${JSON.stringify(data?.error || data)?.slice(0, 500)}`);

    const part = (data.steps || [])
      .filter((s) => s.type === "model_output")
      .flatMap((s) => s.content || [])
      .filter((c) => c.type === "audio" && c.data)
      .at(-1);
    if (!part) throw new TtsError(`no audio in response, keys: ${Object.keys(data).join(", ")}`);

    const audio = Buffer.from(part.data, "base64");
    const seconds = wavSeconds(audio);
    const usage = data.usage || {};
    const inTokens = usage.total_input_tokens ?? usage.input_tokens ?? Math.ceil(text.length / 4);
    const outTokens = usage.total_output_tokens ?? usage.output_tokens ?? Math.ceil(seconds * this.audioTokensPerSec);
    const today = new Date().toISOString().slice(0, 10);
    const price = (this.prices[model] || []).find((p) => !p.until || today < p.until);
    const usd = price ? (inTokens * price.in + outTokens * price.out) / 1e6 : null;

    return {
      audio,
      contentType: part.mime_type || "audio/wav",
      meta: { model, audio_s: +seconds.toFixed(1), in_tokens: inTokens, out_tokens: outTokens, usd },
    };
  },

  async createVoice({ source, consent, displayName }) {
    if (!process.env.GEMINI_API_KEY) throw new TtsError("GEMINI_API_KEY missing");
    const res = await fetch("https://generativelanguage.googleapis.com/v1beta/voices", {
      method: "POST",
      headers: { "x-goog-api-key": process.env.GEMINI_API_KEY, "content-type": "application/json" },
      body: JSON.stringify({
        store: true,
        voice: {
          model: this.model(),
          type: "replicated",
          display_name: displayName,
          language_code: "en-US",
          replicated: {
            source_audio: { mime_type: "audio/wav", data: source.toString("base64") },
            consent_audio: { mime_type: "audio/wav", data: consent.toString("base64") },
          },
        },
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new TtsError(`voices.create failed ${res.status}: ${JSON.stringify(data.error || data).slice(0, 600)}`);
    const id = data.replicated_voice?.id || data.id || data.voice?.id || data.name?.split("/").pop();
    if (!id) throw new TtsError(`no voice id in response, keys: ${Object.keys(data).join(", ")}`);
    return id;
  },
};

const elevenlabs = {
  name: "elevenlabs",
  voiceEnvKey: "ELEVENLABS_VOICE_ID",
  configured() {
    return false;
  },
  async synthesize() {
    throw new TtsError("elevenlabs voice provider not configured");
  },
  async createVoice() {
    throw new TtsError("elevenlabs voice provider not configured");
  },
};

const PROVIDERS = { gemini, elevenlabs };

function provider() {
  const name = (process.env.VOICE_PROVIDER || "gemini").trim().toLowerCase();
  const p = PROVIDERS[name];
  if (!p) throw new TtsError(`unknown VOICE_PROVIDER "${name}"`);
  return p;
}

export const providerName = () => provider().name;
export const voiceEnvKey = () => provider().voiceEnvKey;

export function voiceConfigured() {
  try {
    return provider().configured();
  } catch {
    return false;
  }
}

export const synthesize = (text) => provider().synthesize(text);
export const createVoice = (audio) => provider().createVoice(audio);

function wavSeconds(buf) {
  for (let i = 12; i + 8 <= buf.length; ) {
    const id = buf.toString("ascii", i, i + 4);
    const size = buf.readUInt32LE(i + 4);
    if (id === "data") return Math.min(size, buf.length - i - 8) / (SAMPLE_RATE * 2);
    i += 8 + size + (size % 2);
  }
  return buf.length / (SAMPLE_RATE * 2);
}
