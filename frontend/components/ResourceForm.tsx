"use client";
import { useState } from "react";
import type { FieldDef, ResourceDef } from "@/lib/resources";

type Values = Record<string, string>;

export default function ResourceForm({
  def, initial, busy, error, onSubmit, onCancel, title,
}: {
  def: ResourceDef;
  initial?: Record<string, unknown>;
  busy?: boolean;
  error?: string;
  title: string;
  onSubmit: (values: Record<string, unknown>) => void;
  onCancel: () => void;
}) {
  const fields = def.fields.filter((f) => f.editable);
  const [v, setV] = useState<Values>(() =>
    Object.fromEntries(fields.map((f) => [f.name, initial?.[f.name] != null ? String(initial[f.name]) : f.type === "badge" && f.enum ? f.enum[0] : ""]))
  );
  const set = (k: string, val: string) => setV((x) => ({ ...x, [k]: val }));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const out: Record<string, unknown> = {};
    for (const f of fields) if (v[f.name] !== "" && v[f.name] !== undefined) out[f.name] = f.type === "number" || f.type === "currency" ? Number(v[f.name]) : v[f.name];
    onSubmit(out);
  };

  const input = (f: FieldDef) => {
    const id = `f_${f.name}`;
    if (f.type === "badge") return <select id={id} className="input select" value={v[f.name]} onChange={(e) => set(f.name, e.target.value)}>{f.enum?.map((o) => <option key={o}>{o}</option>)}</select>;
    if (f.type === "longtext") return <textarea id={id} className="textarea" rows={4} value={v[f.name]} maxLength={f.maxLength ?? 2000} onChange={(e) => set(f.name, e.target.value)} />;
    const num = f.type === "number" || f.type === "currency";
    return <input id={id} className="input" type={num ? "number" : f.type === "email" ? "email" : "text"} step={f.type === "currency" ? "0.01" : undefined} min={f.min} max={f.max} maxLength={f.maxLength} required={f.required} value={v[f.name]} onChange={(e) => set(f.name, e.target.value)} />;
  };

  return (
    <div className="modal" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}>
      <form className="modal__box" onSubmit={submit}>
        <h2 className="admin__h" style={{ fontSize: 24 }}>{title}</h2>
        {fields.map((f) => (
          <div className="field" key={f.name}>
            <label htmlFor={`f_${f.name}`}>{f.label ?? f.name}{f.required ? " *" : ""}</label>
            {input(f)}
          </div>
        ))}
        {error && <div className="form__status" role="alert">⚠ {error}</div>}
        <div className="row">
          <button type="submit" className="btn btn--solid btn--auto" disabled={busy}>{busy ? "Saving…" : "Save"}</button>
          <button type="button" className="btn btn--ghost btn--auto" onClick={onCancel}>Cancel</button>
        </div>
      </form>
    </div>
  );
}
