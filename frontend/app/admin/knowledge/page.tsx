"use client";
import { useEffect, useMemo, useState } from "react";
import { Doc, hybridSearch, SEED_DOCS } from "@/lib/search";
import { load, save } from "@/lib/store";

export default function Knowledge() {
  const [docs, setDocs] = useState<Doc[]>(SEED_DOCS);
  const [q, setQ] = useState("");
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");

  useEffect(() => { setDocs(load<Doc[]>("nexus_docs", SEED_DOCS)); }, []);
  const hits = useMemo(() => hybridSearch(docs, q), [docs, q]);

  const add = () => {
    if (!title.trim() || !text.trim()) return;
    const next = [...docs, { id: crypto.randomUUID(), title: title.trim(), text: text.trim() }];
    setDocs(next); save("nexus_docs", next); setTitle(""); setText("");
  };
  const remove = (id: string) => { const next = docs.filter((d) => d.id !== id); setDocs(next); save("nexus_docs", next); };
  const upload = async (f?: File | null) => {
    if (!f) return;
    if (f.size > 1_000_000) return alert("Max 1 MB text files in the browser demo.");
    setTitle(f.name.replace(/\.\w+$/, "")); setText((await f.text()).slice(0, 20000));
  };

  return (
    <>
      <h1 className="admin__h">Knowledge (Hybrid RAG)</h1>
      <p className="section__lead">Ask a question. Results combine BM25 keyword search and vector similarity, fused with Reciprocal Rank Fusion. Documents stay in your browser.</p>
      <input className="input" style={{ maxWidth: 560, marginTop: 16 }} placeholder="e.g. who can delete records?" value={q} onChange={(e) => setQ(e.target.value)} />
      {q && !hits.length && <p className="form__status">No relevant passages.</p>}
      <div className="grid" style={{ marginTop: 24 }}>
        {hits.map((h) => (
          <article className="cell" key={h.id}>
            <span className="cell__n">RRF {h.rrf.toFixed(4)} · BM25 {h.bm25.toFixed(2)} · cos {h.dense.toFixed(2)}</span>
            <h3 className="cell__t">{h.title}</h3>
            <p className="cell__d">{h.text}</p>
          </article>
        ))}
      </div>

      <h2 className="admin__h" style={{ fontSize: 22, marginTop: 48 }}>Add a document</h2>
      <input className="input" placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
      <textarea className="textarea" rows={4} placeholder="Paste text…" value={text} onChange={(e) => setText(e.target.value)} />
      <div className="row">
        <button className="btn btn--solid" style={{ width: "auto", padding: "14px 28px" }} onClick={add}>Index</button>
        <label className="btn btn--ghost" style={{ width: "auto", padding: "14px 28px", cursor: "pointer" }}>
          Load .txt / .md<input type="file" accept=".txt,.md,text/plain" hidden onChange={(e) => upload(e.target.files?.[0])} />
        </label>
      </div>

      <table className="table">
        <thead><tr><th>Indexed documents ({docs.length})</th><th /></tr></thead>
        <tbody>{docs.map((d) => <tr key={d.id}><td>{d.title}</td><td><button className="badge badge--bad" style={{ border: 0, cursor: "pointer" }} onClick={() => remove(d.id)}>remove</button></td></tr>)}</tbody>
      </table>
    </>
  );
}
