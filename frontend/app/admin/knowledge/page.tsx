"use client";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { CAPS } from "@/lib/resources";
import { useSession } from "@/lib/session";

type Doc = { id: string; title: string; text: string; created_at: string; by: string };
type Hit = { id: string; title: string; text: string; rrf: number; bm25: number; dense: number };

export default function Knowledge() {
  const role = useSession((s) => s.user?.role);
  const canWrite = !!role && CAPS.knowledgeWrite.includes(role);
  const [docs, setDocs] = useState<Doc[]>([]);
  const [hits, setHits] = useState<Hit[] | null>(null);
  const [q, setQ] = useState("");
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [msg, setMsg] = useState("");

  const load = useCallback(() => api<{ docs: Doc[] }>("/knowledge").then((r) => setDocs(r.docs)).catch((e) => setMsg(e.message)), []);
  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!q.trim()) { setHits(null); return; }
    const t = setTimeout(() => { api<{ hits: Hit[] }>(`/knowledge?q=${encodeURIComponent(q)}`).then((r) => setHits(r.hits)).catch((e) => setMsg(e.message)); }, 250);
    return () => clearTimeout(t);
  }, [q]);

  const add = async () => {
    setMsg("");
    try { await api("/knowledge", { body: { title, text } }); setTitle(""); setText(""); setMsg("Indexed."); load(); } catch (e) { setMsg((e as Error).message); }
  };
  const remove = async (id: string) => {
    if (!confirm("Delete this document?")) return;
    try { await api(`/knowledge/${id}`, { method: "DELETE" }); load(); } catch (e) { setMsg((e as Error).message); }
  };
  const upload = async (f?: File | null) => {
    if (!f) return;
    if (f.size > 1_000_000) return setMsg("Max 1 MB text files.");
    setTitle(f.name.replace(/\.\w+$/, "")); setText((await f.text()).slice(0, 20000));
  };

  return (
    <>
      <h1 className="admin__h">Knowledge base</h1>
      <p className="section__lead">Hybrid retrieval (BM25 + vector similarity, fused with RRF). The Copilot searches this same index when answering policy questions.</p>
      <input className="input" style={{ maxWidth: 560, marginTop: 16 }} placeholder="Ask your documents, e.g. refund policy" aria-label="Search knowledge" value={q} onChange={(e) => setQ(e.target.value)} />
      {hits && !hits.length && <p className="form__status">No relevant passages.</p>}
      <div className="grid" style={{ marginTop: 24 }}>
        {hits?.map((h) => (
          <article className="cell" key={h.id}>
            <span className="cell__n">RRF {h.rrf.toFixed(4)} · BM25 {h.bm25.toFixed(2)} · cos {h.dense.toFixed(2)}</span>
            <h3 className="cell__t">{h.title}</h3>
            <p className="cell__d">{h.text}</p>
          </article>
        ))}
      </div>
      {msg && <p className="form__status" role="status">{msg}</p>}

      {canWrite && (
        <>
          <h2 className="admin__h" style={{ fontSize: 22, marginTop: 40 }}>Add a document</h2>
          <input className="input" placeholder="Title" value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} />
          <textarea className="textarea" rows={4} placeholder="Paste text…" value={text} onChange={(e) => setText(e.target.value)} />
          <div className="row">
            <button className="btn btn--solid btn--auto" onClick={add}>Index</button>
            <label className="btn btn--ghost btn--auto" style={{ cursor: "pointer" }}>Load .txt / .md<input type="file" accept=".txt,.md,text/plain" hidden onChange={(e) => upload(e.target.files?.[0])} /></label>
          </div>
        </>
      )}

      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>Indexed documents ({docs.length})</th><th>Added by</th><th /></tr></thead>
          <tbody>
            {docs.map((d) => (
              <tr key={d.id}><td>{d.title}</td><td>{d.by}</td><td className="actions">{canWrite && <button className="badge badge--bad" onClick={() => remove(d.id)}>remove</button>}</td></tr>
            ))}
            {!docs.length && <tr><td colSpan={3}>No documents yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
