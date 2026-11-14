"use client";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { download } from "@/lib/store";

type Entry = { seq: number; ts: string; actor: string; action: string; resource: string; target: string; note: string; hash: string; prev: string; before: unknown; after: unknown };
type Audit = { intact: boolean; brokenAt: number | null; total: number; entries: Entry[] };

export default function AuditPage() {
  const [a, setA] = useState<Audit | null>(null);
  const [err, setErr] = useState("");
  const [open, setOpen] = useState<number | null>(null);
  const load = useCallback(() => api<Audit>("/audit").then(setA).catch((e) => setErr(e.message)), []);
  useEffect(() => { load(); }, [load]);

  return (
    <>
      <h1 className="admin__h">Audit trail</h1>
      <p className="section__lead">Append-only and hash-chained: each entry stores the SHA-256 of the one before it, and the whole chain is re-verified on every load. Editing history breaks the chain at that entry.</p>
      {err && <p className="form__status" role="alert">⚠ {err}</p>}
      {a && (
        <>
          <div className="kpis">
            <div className="stat"><b>{a.total}</b><span>Entries</span></div>
            <div className="stat"><b style={{ color: a.intact ? "#8ee3b5" : "#ff8a8a" }}>{a.total === 0 ? "—" : a.intact ? "Intact" : `Broken @ #${a.brokenAt}`}</b><span>Chain status</span></div>
          </div>
          <div className="row">
            <button className="btn btn--ghost btn--auto" onClick={load}>Refresh &amp; verify</button>
            <button className="btn btn--ghost btn--auto" onClick={() => download("audit.json", JSON.stringify(a.entries, null, 2), "application/json")}>Export JSON</button>
          </div>
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>#</th><th>Time</th><th>Actor</th><th>Action</th><th>Target</th><th>Hash</th></tr></thead>
              <tbody>
                {a.entries.map((e) => (
                  <>
                    <tr key={e.seq} style={{ cursor: "pointer" }} onClick={() => setOpen(open === e.seq ? null : e.seq)}>
                      <td>{e.seq}</td><td>{new Date(e.ts).toLocaleString()}</td><td>{e.actor}</td><td>{e.action}</td><td>{e.target || "—"}</td><td>{e.hash.slice(0, 10)}…</td>
                    </tr>
                    {open === e.seq && (
                      <tr key={`${e.seq}-d`}><td colSpan={6}><pre className="pre" style={{ margin: 0 }}>{JSON.stringify({ note: e.note || undefined, before: e.before, after: e.after, prev: e.prev, hash: e.hash }, null, 2)}</pre></td></tr>
                    )}
                  </>
                ))}
                {!a.entries.length && <tr><td colSpan={6}>No entries yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}
