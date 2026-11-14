"use client";
import { useState } from "react";
import { inspect, SAMPLE, type ResourceConfig } from "@/lib/inspector";
import { download } from "@/lib/store";

export default function Studio() {
  const [raw, setRaw] = useState("");
  const [name, setName] = useState("user");
  const [out, setOut] = useState<{ kind: string; resources: ResourceConfig[] } | null>(null);
  const [err, setErr] = useState("");

  const run = () => {
    try { setOut(inspect(raw, name)); setErr(""); } catch (e) { setOut(null); setErr((e as Error).message); }
  };

  return (
    <>
      <h1 className="admin__h">Schema Studio</h1>
      <p className="section__lead">Paste an OpenAPI JSON spec, a JSON sample or a CSV. Nexus infers types, relations and widgets, then generates Refine resources and Zod schemas.</p>
      <textarea className="textarea" rows={10} placeholder="Paste OpenAPI JSON / JSON sample / CSV…" value={raw} onChange={(e) => setRaw(e.target.value)} />
      <div className="row">
        <input className="input" style={{ maxWidth: 200 }} value={name} onChange={(e) => setName(e.target.value.replace(/\W/g, ""))} aria-label="Resource name" />
        <button className="btn btn--solid" style={{ width: "auto", padding: "14px 28px" }} onClick={run}>Analyze</button>
        <button className="btn btn--ghost" style={{ width: "auto", padding: "14px 28px" }} onClick={() => setRaw(SAMPLE)}>Load sample</button>
      </div>
      {err && <p className="form__status" role="alert">⚠ {err}</p>}
      {out && (
        <>
          <p className="section__eyebrow" style={{ marginTop: 32 }}>[ Detected: {out.kind} · {out.resources.length} resource(s) ]</p>
          {out.resources.map((r) => (
            <div key={r.name}>
              <h2 className="admin__h" style={{ fontSize: 24, marginTop: 24 }}>{r.name}</h2>
              <table className="table">
                <thead><tr><th>Field</th><th>Widget</th><th>Nullable</th><th>Relation</th><th>Notes</th></tr></thead>
                <tbody>
                  {r.fields.map((f) => (
                    <tr key={f.name}>
                      <td>{f.name}</td><td><span className="badge">{f.type}</span></td>
                      <td>{f.nullable ? "yes" : "no"}</td><td>{f.relation ?? "—"}</td>
                      <td>{[f.readOnly && "read-only", f.sensitive && "sensitive", f.enum && `enum(${f.enum.join("|")})`].filter(Boolean).join(", ") || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <pre className="pre">{r.zod}</pre>
              <div className="row">
                <button className="btn btn--ghost" style={{ width: "auto", padding: "12px 20px" }} onClick={() => download(`${r.name}.schema.ts`, `import { z } from "zod";\n\n${r.zod}\n`)}>Download Zod</button>
                <button className="btn btn--ghost" style={{ width: "auto", padding: "12px 20px" }} onClick={() => download(`${r.name}.resource.json`, JSON.stringify(r, null, 2), "application/json")}>Download Refine JSON</button>
              </div>
            </div>
          ))}
        </>
      )}
    </>
  );
}
