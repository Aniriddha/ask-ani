import { limitsFromEnv, overLimit } from "../lib/rate-limit.mjs";
import { actionSig, newAccessId, readAccess, writeAccess } from "../lib/access.mjs";
import { notify } from "../lib/notify.mjs";

export const config = { path: "/api/ask-ani-access" };

const LIMITS = limitsFromEnv("ASK_ANI_ACCESS", { perIpHour: 5, perIpDay: 10, globalDay: 100 });

function json(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

export default async (req, context) => {
  const url = new URL(req.url);

  if (req.method === "GET") {
    const rec = await readAccess(url.searchParams.get("id"));
    return rec ? json(200, { status: rec.status }) : json(404, { status: "unknown" });
  }
  if (req.method !== "POST") return json(405, { error: "method not allowed" });

  let body;
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "bad request" });
  }
  const name = String(body?.name || "").trim().slice(0, 80);
  const email = String(body?.email || "").trim().slice(0, 120);
  if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json(400, { error: "name and email required" });

  const ip = context?.ip || req.headers.get("x-nf-client-connection-ip") || "unknown";
  if (await overLimit("access", ip, LIMITS)) return json(429, { error: "too many requests, try later" });

  const id = newAccessId();
  const approve = actionSig(id, "approve");
  if (!approve) return json(503, { error: "access requests are off" });
  await writeAccess(id, { name, email, status: "pending", created: new Date().toISOString() });

  const link = (action) => `${url.origin}/api/ask-ani-approve?id=${id}&action=${action}&sig=${actionSig(id, action)}`;
  const approveLink = link("approve");
  const denyLink = link("deny");
  console.log(JSON.stringify({ evt: "ask-ani-access-request", name, email, approve: approveLink, deny: denyLink }));

  await notify("Ask Ani access request", `${name} wants access`);

  return json(200, { id, status: "pending" });
};
