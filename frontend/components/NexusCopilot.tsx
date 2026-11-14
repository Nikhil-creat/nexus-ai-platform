"use client";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { api } from "@/lib/api";
import { useSession } from "@/lib/session";

type Msg =
  | { kind: "user" | "bot" | "sys"; text: string }
  | { kind: "approval"; id: string; action: string; resource: string; summary: string; targets?: unknown[]; changes?: unknown; resolved?: string };

const GUEST_HINTS = ["What is NEXUS?", "How is it secured?", "Who built this?"];
const USER_HINTS = ["Which orders are pending?", "Search the knowledge base for refund policy", "Flag orders over 1000 for review"];

function parseFrame(frame: string): { type: string; data: Record<string, any> } | null {
  const ev = /^event: (\w+)/m.exec(frame)?.[1];
  const raw = /^data: (.*)$/m.exec(frame)?.[1];
  if (!ev || !raw) return null;
  try { return { type: ev, data: JSON.parse(raw) }; } catch { return null; }
}

export default function NexusCopilot({ open, setOpen }: { open: boolean; setOpen: (v: boolean) => void }) {
  const user = useSession((s) => s.user);
  const refresh = useSession((s) => s.refresh);
  const ready = useSession((s) => s.ready);
  const route = usePathname();
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const history = useRef<{ role: "user" | "assistant"; content: string }[]>([]);

  useEffect(() => { if (!ready) refresh(); }, [ready, refresh]);
  useEffect(() => { logRef.current?.scrollTo({ top: 1e9 }); }, [msgs]);
  useEffect(() => () => abortRef.current?.abort(), []);

  const intro = user
    ? `Signed in as ${user.email} (${user.role}). I can read your data and search the knowledge base. Any change I propose waits for your approval.`
    : "Guest mode: I can answer questions about NEXUS and its builder. Sign in to let me work with live data.";

  const push = (m: Msg) => setMsgs((x) => [...x, m]);
  const appendBot = (t: string) =>
    setMsgs((x) => {
      const last = x[x.length - 1];
      if (last?.kind === "bot") return [...x.slice(0, -1), { kind: "bot", text: last.text + t }];
      return [...x, { kind: "bot", text: t }];
    });

  async function ask(text: string) {
    text = text.trim();
    if (!text || busy) return;
    setInput("");
    push({ kind: "user", text });
    setBusy(true);
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    let answer = "";
    try {
      const res = await fetch("/api/copilot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        signal: ctrl.signal,
        body: JSON.stringify({ message: text, route, history: history.current.slice(-10) }),
      });
      if (!res.ok || !res.body) {
        const j = await res.json().catch(() => ({}));
        throw new Error((j as { error?: string }).error ?? `Request failed (${res.status})`);
      }
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
          const e = parseFrame(f);
          if (!e) continue;
          const d = e.data;
          if (e.type === "token") { answer += d.t; appendBot(d.t); }
          else if (e.type === "guard") push({ kind: "sys", text: `Privacy: masked ${Object.keys(d.masked ?? {}).join(", ")} before sending to the model` });
          else if (e.type === "tool") push({ kind: "sys", text: String(d.summary ?? d.name) });
          else if (e.type === "approval") push({ kind: "approval", id: d.id, action: d.action, resource: d.resource, summary: d.summary, targets: d.targets, changes: d.changes });
          else if (e.type === "error") push({ kind: "sys", text: String(d.message) });
        }
      }
      history.current.push({ role: "user", content: text });
      if (answer) history.current.push({ role: "assistant", content: answer });
    } catch (err) {
      if ((err as Error).name !== "AbortError") push({ kind: "sys", text: `Error: ${(err as Error).message}` });
    } finally {
      setBusy(false);
    }
  }

  async function decide(i: number, id: string, approved: boolean) {
    try {
      const r = await api<{ status: string; succeeded: number; failed: string[] }>(`/approvals/${id}`, { body: { approved } });
      setMsgs((x) => x.map((m, j) => (j === i && m.kind === "approval" ? { ...m, resolved: approved ? "approved" : "rejected" } : m)));
      if (r.status === "executed") push({ kind: "sys", text: `Done: ${r.succeeded} change(s) applied${r.failed.length ? `, ${r.failed.length} failed (${r.failed.join("; ")})` : ""}.` });
    } catch (e) {
      push({ kind: "sys", text: (e as Error).message });
    }
  }

  function voice() {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return push({ kind: "sys", text: "Voice input is not supported in this browser." });
    const r = new SR();
    r.onresult = (ev: any) => setInput(ev.results[0][0].transcript);
    r.start();
  }

  const hints = user ? USER_HINTS : GUEST_HINTS;
  return (
    <>
      <button className="fab" onClick={() => setOpen(true)} aria-label="Open Nexus Copilot">Copilot</button>
      <aside className={`drawer ${open ? "is-open" : ""}`} aria-hidden={!open} aria-label="Nexus Copilot" ref={(el) => { el?.toggleAttribute("inert", !open); }}>
        <div className="drawer__head">
          <span>Nexus Copilot</span>
          <button className="nav__cta" onClick={() => setOpen(false)}>Close</button>
        </div>
        <div className="drawer__ctx">{user ? `${user.role} · ${route}` : `guest · ${route}`}</div>
        <div className="drawer__log" ref={logRef} aria-live="polite">
          <div className="msg msg--sys">{intro}</div>
          {msgs.length === 0 && (
            <div className="hints">
              {hints.map((h) => <button key={h} className="tag" onClick={() => ask(h)}>{h}</button>)}
            </div>
          )}
          {msgs.map((m, i) =>
            m.kind === "approval" ? (
              <div className="approval" key={i}>
                <span>Approval required · {m.action} {m.resource}</span>
                <span>{m.summary}</span>
                {m.changes ? <pre className="pre" style={{ margin: 0 }}>{JSON.stringify(m.changes, null, 1)}</pre> : null}
                {m.resolved ? (
                  <span className={`badge ${m.resolved === "approved" ? "badge--ok" : "badge--bad"}`}>{m.resolved}</span>
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
          {busy && <div className="msg msg--sys">Thinking…</div>}
        </div>
        <form className="drawer__form" onSubmit={(e) => { e.preventDefault(); ask(input); }}>
          <input className="input" aria-label="Message" value={input} onChange={(e) => setInput(e.target.value)} placeholder={user ? "Ask or command…" : "Ask about NEXUS…"} maxLength={user ? 4000 : 500} />
          <button type="button" onClick={voice} aria-label="Voice input">Mic</button>
          <button type="submit" disabled={busy}>Send</button>
        </form>
      </aside>
    </>
  );
}
