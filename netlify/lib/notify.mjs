// Optional phone push through ntfy.sh. Set NTFY_TOPIC to a long random string, then subscribe to it in the ntfy app.
// Only a short heading is sent (never message text, links or keys).
export async function notify(title, message) {
  const topic = process.env.NTFY_TOPIC;
  if (!topic) return;
  try {
    await fetch(`https://ntfy.sh/${encodeURIComponent(topic)}`, {
      method: "POST",
      headers: { Title: title, Tags: "bell" },
      body: String(message).slice(0, 200),
      signal: AbortSignal.timeout(4000),
    });
  } catch (err) {
    console.error("notify failed:", err?.message);
  }
}
