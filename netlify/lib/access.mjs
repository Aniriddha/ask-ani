import { randomBytes } from "node:crypto";
import { sign, verify } from "./sign.mjs";
import { blobsUnavailable, isLocalDev } from "./fallback-alarm.mjs";

const memory = new Map();

async function store() {
  try {
    const { getStore } = await import("@netlify/blobs");
    return getStore({ name: "ask-ani-access", consistency: "strong" });
  } catch (err) {
    blobsUnavailable("ask-ani-access", err);
    return {
      async get(key) { return memory.get(key) ?? null; },
      async list({ prefix }) { return { blobs: [...memory.keys()].filter((k) => k.startsWith(prefix)).map((key) => ({ key })) }; },
      async setJSON(key, value) {
        memory.set(key, value);
        if (!isLocalDev()) console.error(`ASK ANI STORAGE ALARM: ${key} (status ${value?.status}) saved in memory only and will be lost`);
      },
    };
  }
}

export const newAccessId = () => randomBytes(16).toString("base64url");

export async function readAccess(id) {
  if (typeof id !== "string" || !/^[\w-]{16,40}$/.test(id)) return null;
  return (await store()).get(`req:${id}`, { type: "json" });
}

export async function writeAccess(id, record) {
  await (await store()).setJSON(`req:${id}`, record);
}

export async function isApproved(id) {
  return (await readAccess(id))?.status === "approved";
}

export const actionSig = (id, action) => sign(`${action}:${id}`, "access");
export const verifyAction = (id, action, sig) => verify(`${action}:${id}`, sig, "access");

export async function listAccess() {
  const st = await store();
  const { blobs } = await st.list({ prefix: "req:" });
  const recs = await Promise.all(blobs.map(async ({ key }) => ({ id: key.slice(4), ...((await st.get(key, { type: "json" })) || {}) })));
  return recs.sort((a, b) => String(b.created).localeCompare(String(a.created)));
}
