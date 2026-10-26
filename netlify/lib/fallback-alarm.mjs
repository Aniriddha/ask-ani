// Netlify Blobs is the only durable store. If it can't be reached we fall back to memory,
// which loses data on restart and isn't shared between function instances, so say so loudly.
const warned = new Set();

export const isLocalDev = () => process.env.ASK_ANI_LOCAL_DEV === "1";

export function blobsUnavailable(storeName, err) {
  if (warned.has(storeName)) return;
  warned.add(storeName);
  const note = isLocalDev()
    ? "expected in local dev"
    : "PRODUCTION DATA WILL BE LOST on restart and is not shared between instances";
  console.error(
    `\n!!!!!!!! ASK ANI STORAGE ALARM: Netlify Blobs unavailable for "${storeName}" (${err?.name}: ${err?.message}). ` +
    `Falling back to in-memory storage, ${note}. !!!!!!!!\n`,
  );
}
