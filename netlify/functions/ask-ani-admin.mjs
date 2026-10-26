import { timingSafeEqual } from "node:crypto";
import { actionSig, listAccess } from "../lib/access.mjs";

export const config = { path: "/api/ask-ani-admin" };

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

function keyOk(given) {
  const want = process.env.ASK_ANI_ADMIN_KEY;
  if (!want || want.length < 24 || typeof given !== "string") return false;
  const a = Buffer.from(want), b = Buffer.from(given);
  return a.length === b.length && timingSafeEqual(a, b);
}

function html(status, body) {
  return new Response(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Requests</title>
<body style="margin:0;background:#FAF9F5;font:16px/1.5 system-ui,sans-serif;color:#141413"><div style="max-width:720px;margin:0 auto;padding:32px 16px">${body}</div></body>`,
    { status, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "x-robots-tag": "noindex" } });
}

const btn = (id, action, label, bg) =>
  `<form method="POST" action="/api/ask-ani-approve" style="display:inline"><input type="hidden" name="id" value="${esc(id)}"><input type="hidden" name="action" value="${action}"><input type="hidden" name="sig" value="${esc(actionSig(id, action))}"><button style="font:600 14px system-ui;padding:8px 14px;border:0;border-radius:8px;background:${bg};color:#fff;cursor:pointer">${label}</button></form>`;

// Private list of access requests with approve and deny buttons. Bookmark /api/ask-ani-admin?key=YOUR_ADMIN_KEY
export default async (req) => {
  const url = new URL(req.url);
  if (!keyOk(url.searchParams.get("key"))) return html(404, "<p>Not found.</p>");
  const recs = await listAccess();
  const row = (r) => `<li style="list-style:none;border:1px solid #E3E0D5;border-radius:12px;padding:14px 16px;margin:0 0 10px;background:#fff">
    <b>${esc(r.name)}</b> &lt;${esc(r.email)}&gt;<br><small style="color:#666">${esc(r.created || "")} · ${esc(r.status)}</small>
    ${r.status === "pending" ? `<div style="margin-top:10px;display:flex;gap:8px">${btn(r.id, "approve", "Approve", "#2E6B45")}${btn(r.id, "deny", "Deny", "#8A3A2B")}</div>` : ""}</li>`;
  const pending = recs.filter((r) => r.status === "pending");
  const decided = recs.filter((r) => r.status !== "pending");
  return html(200, `<h1 style="font:600 26px Georgia,serif;margin:0 0 6px">Access requests</h1>
<p style="color:#555;margin:0 0 20px">${pending.length} waiting · reload to refresh</p>
<ul style="padding:0">${pending.map(row).join("") || "<li style='list-style:none;color:#666'>Nothing waiting.</li>"}</ul>
${decided.length ? `<h2 style="font:600 18px Georgia,serif;margin:28px 0 10px">Decided</h2><ul style="padding:0">${decided.slice(0, 50).map(row).join("")}</ul>` : ""}`);
};
