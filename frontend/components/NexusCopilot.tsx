"use client";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

type Msg =
  | { kind: "user" | "bot" | "sys"; text: string }
  | { kind: "approval"; id: string; action: string; summary: string; resolved?: string };

const API = process.env.NEXT_PUBLIC_API_URL;

const mask = (t: string) =>
  t.replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, "[EMAIL_REDACTED]").replace(/\b\d{10}\b/g, "[PHONE_REDACTED]");

export default function NexusCopilot({ open, setOpen }: { open: boolean; setOpen: (v: boolean) => void }) {
  const [msgs, setMsgs] = useState<Msg[]>([{ kind: "sys", text: "Nexus Copilot ready. Destructive actions require your approval." }]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);
  const route = usePathname();

  useEffect(() => { logRef.current?.scrollTo({ top: 1e9 }); }, [msgs]);

  const push = (m: Msg) => setMsgs((x) => [...x, m]);
  const appendBot = (t: string) =>
    setMsgs((x) => {
      const last = x[x.length - 1];
      if (last?.kind === "bot") return [...x.slice(0, -1), { kind: "bot", text: last.text + t }];
      return [...x, { kind: "bot", text: t }];
    });

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    push({ kind: "user", text });
    setBusy(true);

    // No backend configured (e.g. static Vercel deploy): local demo with the same HITL behaviour.
    if (!API) {
      const destructive = /\b(delete|update|migrate|webhook)\b/i.test(text);
      await new Promise((r) => setTimeout(r, 400));
      if (destructive) push({ kind: "approval", id: "demo", action: text.match(/\b(delete|update|migrate|webhook)\b/i)![0].toLowerCase(), summary: mask(text) });
      else push({ kind: "bot", text: `Demo mode (no backend URL set). I'm aware you're on ${route}. Deploy the FastAPI service and set NEXT_PUBLIC_API_URL for live answers.` });
      setBusy(false);
      return;
    }

    try {
      const res = await fetch(`${API}/copilot/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${sessionStorage.getItem("nexus_token") ?? ""}` },
        body: JSON.stringify({ message: text, route }),
      });
      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const frames = buf.split("\n\n");
        buf = frames.pop() ?? "";
        for (const f of frames) {
          const ev = /event: (\w+)/.exec(f)?.[1];
          const data = JSON.parse(/data: (.*)/.exec(f)?.[1] ?? "{}");
          if (ev === "token") appendBot(data.t);
          if (ev === "guard") push({ kind: "sys", text: `PII masked: ${Object.keys(data.pii_masked).join(", ")}` });
          if (ev === "approval_required") push({ kind: "approval", id: data.id, action: data.action, summary: data.summary });
        }
      }
    } catch (err) {
      push({ kind: "sys", text: `Error: ${(err as Error).message}` });
    } finally {
      setBusy(false);
    }
  }

  async function decide(i: number, id: string, approved: boolean) {
    if (API && id !== "demo") {
      await fetch(`${API}/copilot/approve/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${sessionStorage.getItem("nexus_token") ?? ""}` },
        body: JSON.stringify({ approved }),
      }).catch(() => undefined);
    }
    setMsgs((x) => x.map((m, j) => (j === i && m.kind === "approval" ? { ...m, resolved: approved ? "approved" : "rejected" } : m)));
  }

  function voice() {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return push({ kind: "sys", text: "Voice input not supported in this browser." });
    const r = new SR();
    r.onresult = (ev: any) => setInput(ev.results[0][0].transcript);
    r.start();
  }

  return (
    <>
      <button className="fab" onClick={() => setOpen(true)} aria-label="Open Nexus Copilot">Copilot</button>
      <aside className={`drawer ${open ? "is-open" : ""}`} aria-hidden={!open} aria-label="Nexus Copilot">
        <div className="drawer__head">
          <span>Nexus Copilot</span>
          <button className="nav__cta" onClick={() => setOpen(false)}>Close</button>
        </div>
        <div className="drawer__ctx">Context · {route}</div>
        <div className="drawer__log" ref={logRef}>
          {msgs.map((m, i) =>
            m.kind === "approval" ? (
              <div className="approval" key={i}>
                <span>Approval required · {m.action}</span>
                <span>{m.summary}</span>
                {m.resolved ? (
                  <span>{m.resolved}</span>
                ) : (
                  <div className="approval__row">
                    <button className="btn btn--solid" onClick={() => decide(i, m.id, true)}>Approve</button>
                    <button className="btn btn--ghost" onClick={() => decide(i, m.id, false)}>Reject</button>
                  </div>
                )}
              </div>
            ) : (
              <div key={i} className={`msg msg--${m.kind}`}>{m.text}</div>
            )
          )}
        </div>
        <form className="drawer__form" onSubmit={send}>
          <input className="input" value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask or command…" maxLength={4000} />
          <button type="button" onClick={voice} aria-label="Voice input">Mic</button>
          <button type="submit" disabled={busy}>Send</button>
        </form>
      </aside>
    </>
  );
}
