import { readAccess, verifyAction, writeAccess } from "../lib/access.mjs";

export const config = { path: "/api/ask-ani-approve" };

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

function page(status, title, line) {
  return new Response(
    `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title>
<body style="margin:0;background:#FAF9F5;font:16px/1.6 Inter,system-ui,sans-serif;color:#141413;display:grid;place-items:center;min-height:100vh">
<div style="max-width:420px;padding:2rem;border:1px solid #E3E0D5;border-radius:12px;background:#fff">
<h1 style="font:700 1.4rem Georgia,serif;color:#A8482B;margin:0 0 .5rem">${esc(title)}</h1><p style="margin:0;color:#3D3B36">${esc(line)}</p></div></body>`,
    { status, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "x-robots-tag": "noindex" } },
  );
}

// Email scanners and link previewers open links with GET. A GET only shows a confirm button;
// the decision is written on POST, which scanners do not send.
function confirmPage(id, action, sig, rec) {
  const verb = action === "approve" ? "Approve" : "Deny";
  return new Response(
    `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${verb} request</title>
<body style="margin:0;background:#FAF9F5;font:16px/1.6 Inter,system-ui,sans-serif;color:#141413;display:grid;place-items:center;min-height:100vh">
<form method="POST" style="max-width:420px;padding:2rem;border:1px solid #E3E0D5;border-radius:12px;background:#fff">
<h1 style="font:700 1.4rem Georgia,serif;color:#A8482B;margin:0 0 .5rem">${verb} this request?</h1>
<p style="margin:0 0 1rem;color:#3D3B36">${esc(rec.name)} (${esc(rec.email)})</p>
<input type="hidden" name="id" value="${esc(id)}"><input type="hidden" name="action" value="${esc(action)}"><input type="hidden" name="sig" value="${esc(sig)}">
<button style="font:600 1rem Inter,system-ui,sans-serif;padding:.6rem 1.2rem;border:0;border-radius:8px;background:#A8482B;color:#fff;cursor:pointer">${verb}</button></form></body>`,
    { status: 200, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "x-robots-tag": "noindex" } },
  );
}

export default async (req) => {
  const url = new URL(req.url);
  let params = url.searchParams;
  if (req.method === "POST") {
    params = new URLSearchParams(await req.text().catch(() => ""));
  } else if (req.method !== "GET") {
    return page(405, "Not allowed", "Method not allowed.");
  }
  const id = params.get("id");
  const action = params.get("action");
  const sig = params.get("sig");
  if (!["approve", "deny"].includes(action) || !verifyAction(id, action, sig)) {
    return page(403, "Link not valid", "This approval link is invalid.");
  }
  const rec = await readAccess(id);
  if (!rec) return page(404, "Request not found", "This request no longer exists.");
  if (req.method === "GET") return confirmPage(id, action, sig, rec);

  const status = action === "approve" ? "approved" : "denied";
  await writeAccess(id, { ...rec, status, decided: new Date().toISOString() });
  console.log(JSON.stringify({ evt: "ask-ani-access-decision", status, name: rec.name, email: rec.email }));
  return page(200, status === "approved" ? "Approved" : "Denied", `${rec.name} (${rec.email}) is ${status}.`);
};
