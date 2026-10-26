(() => {
  const API = "/api/ask-ani";
  const VOICE_API = "/api/ask-ani-voice";
  const ACCESS_API = "/api/ask-ani-access";
  const VOICE_LABEL = `AI voice of ${CFG.name}`;
  // Configure on your page before this script: <script>window.ASK_BOT = { name: "Ani", email: "you@example.com" }</script>
  const CFG = Object.assign({ name: "Ani", email: "you@example.com", subtitle: "answers from my career notes" }, window.ASK_BOT || {});
  const LEAD_KEY = "askani_visitor";
  const SUGGESTIONS = [
    "what did you do at reka?",
    "how did you grow the apple account?",
    "what did you build before tech?",
  ];

  const css = `
  .aa-btn{position:fixed;right:24px;bottom:24px;z-index:2000;background:var(--aa-accent,#A8482B);color:var(--aa-accent-ink,#fff);border:none;border-radius:999px;padding:.85rem 1.4rem;font:600 1rem Inter,system-ui,sans-serif;letter-spacing:.3px;cursor:pointer;box-shadow:0 6px 20px rgba(20,20,19,.18);transition:transform .2s,opacity .2s}
  .aa-btn:hover{transform:translateY(-2px)}
  .aa-panel{position:fixed;right:24px;bottom:90px;z-index:2001;width:370px;max-width:calc(100vw - 32px);height:540px;max-height:calc(100vh - 120px);background:#FAF9F5;border:1px solid #E3E0D5;border-radius:12px;box-shadow:0 12px 40px rgba(20,20,19,.18);display:none;flex-direction:column;overflow:hidden;font-family:Inter,system-ui,sans-serif;color:#141413}
  .aa-panel.open{display:flex}
  .aa-head{display:flex;justify-content:space-between;align-items:center;padding:.9rem 1.1rem;border-bottom:1px solid #E3E0D5;background:#F0EEE6}
  .aa-title{font:700 1.1rem 'Source Serif 4',Georgia,serif;color:var(--aa-accent-text,#A8482B)}
  .aa-sub{font-size:.75rem;color:#3D3B36;opacity:.75}
  .aa-x{background:none;border:none;font-size:1.4rem;line-height:1;color:#3D3B36;cursor:pointer;padding:.2rem .4rem}
  .aa-body{flex:1;overflow-y:auto;padding:1rem;display:flex;flex-direction:column;gap:.6rem}
  .aa-msg{max-width:85%;padding:.6rem .85rem;border-radius:12px;font-size:.95rem;line-height:1.5;white-space:pre-wrap;word-wrap:break-word}
  .aa-bot{align-self:flex-start;background:#fff;border:1px solid #E3E0D5;color:#3D3B36}
  .aa-me{align-self:flex-end;background:var(--aa-accent,#A8482B);color:var(--aa-accent-ink,#fff)}
  .aa-typing{opacity:.6;font-style:italic}
  .aa-vbox{display:flex;flex-direction:column;gap:.45rem;min-width:220px}
  .aa-vrow{display:flex;align-items:center;gap:.6rem}
  .aa-vbtn{width:34px;height:34px;flex:none;border-radius:50%;border:none;background:var(--aa-accent,#A8482B);color:var(--aa-accent-ink,#fff);font-size:.8rem;cursor:pointer}
  .aa-vlabel{font-size:.8rem;font-weight:500;color:var(--aa-accent-text,#A8482B)}
  .aa-playing .aa-vlabel::after{content:" · speaking"}
  .aa-vtext{margin-left:auto;background:none;border:none;padding:0;font:inherit;font-size:.75rem;color:#3D3B36;opacity:.75;text-decoration:underline;cursor:pointer}
  .aa-vtxt{border-top:1px solid #E3E0D5;padding-top:.45rem;font-size:.92rem;line-height:1.5;color:#3D3B36;white-space:pre-wrap}
  .aa-vtxt[hidden]{display:none}
  .aa-chips{display:flex;flex-wrap:wrap;gap:.4rem}
  .aa-chip{background:transparent;border:1px solid #E3E0D5;border-radius:999px;padding:.35rem .75rem;font-size:.82rem;color:#3D3B36;cursor:pointer}
  .aa-chip:hover{border-color:var(--aa-accent,#A8482B);color:var(--aa-accent-text,#A8482B)}
  .aa-foot{display:flex;gap:.5rem;padding:.75rem;border-top:1px solid #E3E0D5;background:#fff}
  .aa-in{flex:1;border:1px solid #E3E0D5;border-radius:8px;padding:.6rem .75rem;font:inherit;font-size:.95rem;background:#FAF9F5;color:#141413;min-width:0}
  .aa-in:focus{outline:none;border-color:var(--aa-accent,#A8482B)}
  .aa-send{background:var(--aa-accent,#A8482B);color:var(--aa-accent-ink,#fff);border:none;border-radius:8px;padding:0 1rem;font:600 .9rem Inter,system-ui,sans-serif;cursor:pointer}
  .aa-send:disabled{opacity:.5;cursor:default}
  .aa-gate{padding:1.25rem;display:flex;flex-direction:column;gap:.7rem}
  .aa-gate p{font-size:.95rem;line-height:1.6;color:#3D3B36}
  .aa-gate .aa-in{width:100%}
  .aa-gate .aa-send{padding:.7rem 1rem}
  .aa-err{color:var(--aa-accent-text,#A8482B);font-size:.85rem;min-height:1.1em}
  .aa-note{font-size:.72rem;color:#3D3B36;opacity:.7;line-height:1.5}
  @media (max-width:480px){.aa-panel{right:16px;bottom:84px;height:calc(100vh - 110px)}.aa-btn{right:16px;bottom:16px}}
  `;

  const style = document.createElement("style");
  style.textContent = css;
  document.head.appendChild(style);

  const el = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  };

  const store = {
    get() { try { return JSON.parse(localStorage.getItem(LEAD_KEY)); } catch { return null; } },
    set(v) { try { localStorage.setItem(LEAD_KEY, JSON.stringify(v)); } catch {} },
    clear() { try { localStorage.removeItem(LEAD_KEY); } catch {} },
  };

  let visitor = store.get();
  if (visitor && !visitor.id) visitor = null;
  const history = [];
  let busy = false;

  const btn = el("button", "aa-btn", `Ask ${CFG.name}`);
  btn.setAttribute("aria-label", `Open Ask ${CFG.name} chat`);
  const panel = el("div", "aa-panel");
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-label", `Ask ${CFG.name} chat`);

  const head = el("div", "aa-head");
  const titles = el("div");
  titles.append(el("div", "aa-title", `Ask ${CFG.name}`), el("div", "aa-sub", CFG.subtitle));
  const close = el("button", "aa-x", "×");
  close.setAttribute("aria-label", "Close chat");
  head.append(titles, close);
  const main = el("div");
  main.style.cssText = "flex:1;display:flex;flex-direction:column;min-height:0";
  panel.append(head, main);
  document.body.append(btn, panel);

  btn.addEventListener("click", () => {
    panel.classList.toggle("open");
    if (panel.classList.contains("open")) {
      render();
      refreshStatus().then(render);
    }
  });
  close.addEventListener("click", () => panel.classList.remove("open"));

  window.AskAni = { open() { if (!panel.classList.contains("open")) btn.click(); } };

  async function refreshStatus() {
    if (!visitor?.id) return;
    try {
      const r = await fetch(`${ACCESS_API}?id=${encodeURIComponent(visitor.id)}`, { cache: "no-store" });
      if (r.status === 404) { visitor = null; store.clear(); return; }
      const d = await r.json();
      if (d.status && d.status !== visitor.status) { visitor.status = d.status; store.set(visitor); }
    } catch {}
  }

  const modeNow = () => (!visitor ? "gate" : visitor.status === "approved" ? "chat" : visitor.status === "denied" ? "denied" : "pending");

  let rendered = null;
  let pollTimer = null;
  function render() {
    const mode = modeNow();
    if (rendered === mode) return;
    rendered = mode;
    clearInterval(pollTimer);
    main.replaceChildren();
    ({ gate: renderGate, chat: renderChat, pending: renderPending, denied: renderDenied })[mode]();
  }

  function startOver() {
    visitor = null;
    store.clear();
    render();
  }

  function renderPending() {
    const box = el("div", "aa-gate");
    const first = (visitor.name || "").split(" ")[0].toLowerCase();
    const again = el("button", "aa-chip", "used the wrong email? start over");
    again.type = "button";
    again.addEventListener("click", startOver);
    box.append(
      el("p", null, `thanks ${first}. i approve every request myself, usually within a day.`),
      el("p", null, "keep this open or come back to this page later. the chat opens right here once i approve."),
      again
    );
    main.append(box);
    pollTimer = setInterval(async () => {
      if (!panel.classList.contains("open")) return;
      await refreshStatus();
      render();
    }, 15000);
  }

  function renderDenied() {
    const box = el("div", "aa-gate");
    box.append(el("p", null, `this chat isn't open for you right now. you can reach me directly at ${CFG.email}.`));
    main.append(box);
  }

  function renderGate() {
    const gate = el("form", "aa-gate");
    gate.noValidate = true;
    const name = el("input", "aa-in");
    name.placeholder = "your name";
    name.autocomplete = "name";
    name.maxLength = 80;
    const email = el("input", "aa-in");
    email.type = "email";
    email.placeholder = "your email";
    email.autocomplete = "email";
    email.maxLength = 120;
    const hp = el("input");
    hp.name = "bot-field";
    hp.tabIndex = -1;
    hp.autocomplete = "off";
    hp.style.cssText = "position:absolute;left:-9999px";
    const err = el("div", "aa-err");
    const go = el("button", "aa-send", "start chatting");
    go.type = "submit";
    gate.append(
      el("p", null, `hey, i'm ${CFG.name.toLowerCase()}. i open this chat for recruiters i'm talking to. drop your name and email, i'll approve it, then ask me anything about my work.`),
      name, email, hp, err, go,
      el("div", "aa-note", "your name and email are shared only with me. answers play in an AI version of my voice and come from my own notes.")
    );
    gate.addEventListener("submit", async (e) => {
      e.preventDefault();
      const n = name.value.trim();
      const m = email.value.trim();
      if (!n) return (err.textContent = "add your name");
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(m)) return (err.textContent = "add a valid email");
      if (hp.value) return;
      unlockAudio();
      go.disabled = true;
      err.textContent = "";
      try {
        const r = await fetch(ACCESS_API, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: n, email: m, page: location.pathname }),
        });
        const d = await r.json().catch(() => ({}));
        if (!r.ok || !d.id) throw d.error;
        visitor = { name: n, email: m, id: d.id, status: d.status };
        store.set(visitor);
        render();
      } catch (msg) {
        go.disabled = false;
        err.textContent = typeof msg === "string" ? msg : "couldn't send that, try again";
      }
    });
    main.append(gate);
    name.focus();
  }

  let bodyEl, inputEl, sendEl;
  function renderChat() {
    bodyEl = el("div", "aa-body");
    const foot = el("form", "aa-foot");
    inputEl = el("input", "aa-in");
    inputEl.placeholder = "ask me something";
    inputEl.maxLength = 500;
    sendEl = el("button", "aa-send", "send");
    sendEl.type = "submit";
    foot.append(inputEl, sendEl);
    main.append(bodyEl, foot);

    const first = (visitor.name || "").split(" ")[0].toLowerCase();
    addMsg("bot", `hey ${first}, ask me anything about my work.`);
    const chips = el("div", "aa-chips");
    SUGGESTIONS.forEach((s) => {
      const c = el("button", "aa-chip", s);
      c.type = "button";
      c.addEventListener("click", () => { unlockAudio(); chips.remove(); ask(s); });
      chips.append(c);
    });
    bodyEl.append(chips);

    foot.addEventListener("submit", (e) => {
      e.preventDefault();
      const q = inputEl.value.trim();
      if (!q || busy) return;
      unlockAudio();
      inputEl.value = "";
      chips.remove();
      ask(q);
    });
    inputEl.focus();
  }

  function addMsg(who, text, extra) {
    const m = el("div", `aa-msg ${who === "me" ? "aa-me" : "aa-bot"}${extra ? " " + extra : ""}`, text);
    bodyEl.append(m);
    bodyEl.scrollTop = bodyEl.scrollHeight;
    return m;
  }

  const SILENT = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YQAAAAA=";
  const player = new Audio();
  let unlocked = false;
  let current = null;
  player.addEventListener("ended", () => current && current.idle());

  // Safari only lets audio play from a user gesture; priming the shared player on the first tap keeps later autoplay working.
  function unlockAudio() {
    if (unlocked) return;
    unlocked = true;
    player.src = SILENT;
    player.play().then(() => player.pause()).catch(() => {});
  }

  async function fetchVoice(text, sig) {
    const r = await fetch(VOICE_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ visitor, text, sig }),
    });
    if (!r.ok) throw r.status;
    return URL.createObjectURL(await r.blob());
  }

  function addVoiceMsg(text, url) {
    const box = el("div", "aa-msg aa-bot aa-vbox");
    const row = el("div", "aa-vrow");
    const btn = el("button", "aa-vbtn");
    btn.type = "button";
    const label = el("span", "aa-vlabel", VOICE_LABEL);
    label.title = "Synthetic audio made by AI from a sample of the owner's voice. Not a recording.";
    const toggle = el("button", "aa-vtext", "show text");
    toggle.type = "button";
    const txt = el("div", "aa-vtxt", text);
    txt.hidden = true;
    row.append(btn, label, toggle);
    box.append(row, txt);

    const v = {
      idle() {
        btn.textContent = "▶";
        btn.setAttribute("aria-label", "play answer");
        box.classList.remove("aa-playing");
      },
    };
    const play = () => {
      if (current && current !== v) current.idle();
      current = v;
      if (player.src !== url) player.src = url;
      player.play().then(() => {
        btn.textContent = "❚❚";
        btn.setAttribute("aria-label", "pause answer");
        box.classList.add("aa-playing");
      }).catch(v.idle);
    };
    btn.addEventListener("click", () => {
      if (current === v && !player.paused) { player.pause(); v.idle(); } else play();
    });
    toggle.addEventListener("click", () => {
      txt.hidden = !txt.hidden;
      toggle.textContent = txt.hidden ? "show text" : "hide text";
      bodyEl.scrollTop = bodyEl.scrollHeight;
    });
    v.idle();
    bodyEl.append(box);
    bodyEl.scrollTop = bodyEl.scrollHeight;
    return play;
  }

  async function ask(q) {
    busy = true;
    sendEl.disabled = true;
    addMsg("me", q);
    history.push({ role: "user", content: q });
    const typing = addMsg("bot", "thinking..", "aa-typing");
    let reply, sig;
    try {
      const res = await fetch(API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visitor, messages: history }),
      });
      const data = await res.json().catch(() => ({}));
      reply = data.reply || `something broke on my end. email me at ${CFG.email}`;
      sig = data.sig;
    } catch {
      reply = `can't reach the server right now. email me at ${CFG.email}`;
    }
    let spoken = false;
    if (sig) {
      try {
        const url = await fetchVoice(reply, sig);
        typing.remove();
        addVoiceMsg(reply, url)();
        spoken = true;
      } catch {}
    }
    if (!spoken) {
      typing.remove();
      addMsg("bot", reply);
    }
    history.push({ role: "assistant", content: reply });
    busy = false;
    sendEl.disabled = false;
    inputEl.focus();
  }
})();
