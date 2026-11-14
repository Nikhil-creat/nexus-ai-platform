"use client";
import { useEffect, useState } from "react";
import { useRole } from "@/lib/providers";
import { load, save, download } from "@/lib/store";

type Entry = { seq: number; ts: string; actor: string; action: string; detail: string; prev: string; hash: string };
const GENESIS = "0".repeat(64);
const KEY = "nexus_audit";

async function sha256(s: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
const body = (e: Omit<Entry, "hash" | "prev">) => JSON.stringify([e.seq, e.ts, e.actor, e.action, e.detail]);

async function verify(entries: Entry[]): Promise<number | null> {
  let prev = GENESIS;
  for (const e of entries) {
    if (e.prev !== prev || e.hash !== (await sha256(prev + body(e)))) return e.seq;
    prev = e.hash;
  }
  return null;
}

export default function Audit() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [bad, setBad] = useState<number | null>(null);
  const [action, setAction] = useState("user.update");
  const [detail, setDetail] = useState("");
  const role = useRole((s) => s.role);

  const persist = async (next: Entry[]) => { setEntries(next); save(KEY, next); setBad(await verify(next)); };
  useEffect(() => { const e = load<Entry[]>(KEY, []); setEntries(e); verify(e).then(setBad); }, []);

  const append = async (a = action, d = detail) => {
    const prev = entries.at(-1)?.hash ?? GENESIS;
    const base = { seq: entries.length + 1, ts: new Date().toISOString(), actor: `${role}@nexus.dev`, action: a, detail: d || "—" };
    await persist([...entries, { ...base, prev, hash: await sha256(prev + body(base)) }]);
    setDetail("");
  };
  const tamper = async () => {
    if (entries.length < 1) return;
    const i = Math.floor(entries.length / 2);
    const next = entries.map((e, j) => (j === i ? { ...e, detail: e.detail + " (edited)" } : e));
    setEntries(next); save(KEY, next); setBad(await verify(next));
  };

  return (
    <>
      <h1 className="admin__h">Audit trail</h1>
      <p className="section__lead">Every entry stores the SHA-256 of the previous entry. Change any past record and the chain breaks at that point. Computed with your browser&apos;s Web Crypto.</p>
      <div className="kpis">
        <div className="stat"><b>{entries.length}</b><span>Entries</span></div>
        <div className="stat"><b style={{ color: bad ? "#ff8a8a" : "#8ee3b5" }}>{entries.length === 0 ? "—" : bad ? `Broken @ #${bad}` : "Intact"}</b><span>Chain status</span></div>
      </div>
      <div className="row">
        <input className="input" style={{ maxWidth: 200 }} value={action} onChange={(e) => setAction(e.target.value)} aria-label="Action" />
        <input className="input" style={{ maxWidth: 360 }} placeholder="Detail (what changed)" value={detail} onChange={(e) => setDetail(e.target.value)} />
        <button className="btn btn--solid" style={{ width: "auto", padding: "14px 28px" }} onClick={() => append()}>Append</button>
        <button className="btn btn--ghost" style={{ width: "auto", padding: "14px 28px" }} onClick={tamper}>Tamper (test)</button>
        <button className="btn btn--ghost" style={{ width: "auto", padding: "14px 28px" }} onClick={() => download("audit.json", JSON.stringify(entries, null, 2), "application/json")}>Export</button>
        <button className="btn btn--ghost" style={{ width: "auto", padding: "14px 28px" }} onClick={() => persist([])}>Reset</button>
      </div>
      <table className="table">
        <thead><tr><th>#</th><th>Time</th><th>Actor</th><th>Action</th><th>Detail</th><th>Hash</th></tr></thead>
        <tbody>
          {entries.map((e) => (
            <tr key={e.seq} style={bad && e.seq >= bad ? { outline: "1px solid rgba(255,120,120,.5)" } : undefined}>
              <td>{e.seq}</td><td>{new Date(e.ts).toLocaleString()}</td><td>{e.actor}</td><td>{e.action}</td><td>{e.detail}</td><td>{e.hash.slice(0, 12)}…</td>
            </tr>
          ))}
          {!entries.length && <tr><td colSpan={6}>No entries yet. Append one.</td></tr>}
        </tbody>
      </table>
    </>
  );
}
