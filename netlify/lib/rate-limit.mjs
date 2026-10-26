import { blobsUnavailable } from "./fallback-alarm.mjs";

const memoryCounters = new Map();

async function counterStore() {
  try {
    const { getStore } = await import("@netlify/blobs");
    const store = getStore({ name: "ask-ani-rate", consistency: "strong" });
    return {
      async incr(key) {
        const n = ((await store.get(key, { type: "json" })) || 0) + 1;
        await store.setJSON(key, n);
        return n;
      },
    };
  } catch (err) {
    blobsUnavailable("ask-ani-rate", err);
    return {
      async incr(key) {
        const n = (memoryCounters.get(key) || 0) + 1;
        memoryCounters.set(key, n);
        return n;
      },
    };
  }
}

export function limitsFromEnv(prefix, defaults = { perIpHour: 15, perIpDay: 40, globalDay: 300 }) {
  const env = (k, d) => Number(process.env[`${prefix}_${k}`] || d);
  return {
    perIpHour: env("PER_IP_HOUR", defaults.perIpHour),
    perIpDay: env("PER_IP_DAY", defaults.perIpDay),
    globalDay: env("GLOBAL_DAY", defaults.globalDay),
  };
}

export async function overLimit(scope, ip, limits) {
  const store = await counterStore();
  const now = new Date().toISOString();
  const day = now.slice(0, 10);
  const hour = now.slice(0, 13);
  const [h, d, g] = await Promise.all([
    store.incr(`${scope}:ip:${ip}:${hour}`),
    store.incr(`${scope}:ip:${ip}:${day}`),
    store.incr(`${scope}:global:${day}`),
  ]);
  if (g > limits.globalDay) return `the chat is taking a break for today. email me at ${process.env.BOT_OWNER_EMAIL || "you@example.com"}`;
  if (h > limits.perIpHour || d > limits.perIpDay) return `you've hit the chat limit for now. try later, or email me at ${process.env.BOT_OWNER_EMAIL || "you@example.com"}`;
  return null;
}
