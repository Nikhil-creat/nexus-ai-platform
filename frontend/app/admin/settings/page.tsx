"use client";
import { useEffect, useState } from "react";
import { applyTheme, DEFAULT_THEME, Theme } from "@/components/ThemeLoader";
import { api } from "@/lib/api";
import { CAPS } from "@/lib/resources";
import { useSession } from "@/lib/session";
import { load, save } from "@/lib/store";

type Health = { storage: string; persistent: boolean; sessionSecret: boolean; adminEmailSet: boolean; signupOpen: boolean; llm: Record<string, string> };
type Probe = { name: string; model: string; ok: boolean; ms?: number; error?: string };

const Check = ({ ok, label, fix }: { ok: boolean; label: string; fix?: string }) => (
  <tr><td>{label}</td><td><span className={`badge ${ok ? "badge--ok" : "badge--warn"}`}>{ok ? "ok" : "action needed"}</span></td><td>{ok ? "" : fix}</td></tr>
);

export default function Settings() {
  const role = useSession((s) => s.user?.role);
  const isAdmin = !!role && CAPS.seed.includes(role);
  const [t, setT] = useState<Theme>(DEFAULT_THEME);
  const [h, setH] = useState<Health | null>(null);
  const [probes, setProbes] = useState<Probe[] | null>(null);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { setT(load("nexus_theme", DEFAULT_THEME)); }, []);
  useEffect(() => { api<Health>("/health").then(setH).catch((e) => setMsg(e.message)); }, []);
  const set = (p: Partial<Theme>) => { const n = { ...t, ...p }; setT(n); save("nexus_theme", n); applyTheme(n); };

  const runProbe = async () => {
    setBusy(true); setMsg("");
    try { setProbes((await api<{ providers: Probe[] }>("/health/ai")).providers); } catch (e) { setMsg((e as Error).message); } finally { setBusy(false); }
  };
  const seed = async () => {
    setBusy(true); setMsg("");
    try {
      const r = await api<Record<string, unknown>>("/seed", { body: {} });
      setMsg(`Sample data loaded: ${JSON.stringify(r)}`);
    } catch (e) { setMsg((e as Error).message); } finally { setBusy(false); }
  };

  const providers = h ? Object.entries(h.llm) : [];
  return (
    <>
      <h1 className="admin__h">Settings</h1>

      <h2 className="section__eyebrow" style={{ marginTop: 32 }}>[ System status ]</h2>
      {h && (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Check</th><th>Status</th><th>How to fix</th></tr></thead>
            <tbody>
              <Check ok={h.sessionSecret} label="SESSION_SECRET set (16+ chars)" fix="Add SESSION_SECRET in Vercel → Settings → Environment Variables, then redeploy." />
              <Check ok={h.persistent} label={`Storage: ${h.storage}`} fix="Data resets on cold starts. Add Upstash Redis from Vercel → Storage and redeploy." />
              <Check ok={h.adminEmailSet} label="ADMIN_EMAIL set" fix="Set ADMIN_EMAIL so only your address becomes admin." />
              <Check ok={providers.length > 0} label={`LLM providers: ${providers.map(([n, m]) => `${n} (${m})`).join(", ") || "none"}`} fix="Add GROQ_API_KEY and/or GEMINI_API_KEY." />
              <tr><td>Public sign-up</td><td><span className="badge">{h.signupOpen ? "open" : "closed"}</span></td><td>{h.signupOpen ? "Set ALLOW_SIGNUP=false once your own account exists." : ""}</td></tr>
            </tbody>
          </table>
        </div>
      )}

      {isAdmin ? (
        <>
          <div className="row">
            <button className="btn btn--solid btn--auto" disabled={busy} onClick={runProbe}>Test AI providers</button>
            <button className="btn btn--ghost btn--auto" disabled={busy} onClick={seed}>Load sample data</button>
          </div>
          {probes && (
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Provider</th><th>Model</th><th>Result</th></tr></thead>
                <tbody>
                  {probes.map((p) => (
                    <tr key={p.name}><td>{p.name}</td><td>{p.model}</td><td><span className={`badge ${p.ok ? "badge--ok" : "badge--bad"}`}>{p.ok ? `ok · ${p.ms ?? "?"} ms` : "failed"}</span> {p.error}</td></tr>
                  ))}
                  {!probes.length && <tr><td colSpan={3}>No provider keys configured.</td></tr>}
                </tbody>
              </table>
            </div>
          )}
        </>
      ) : <p className="form__status">Provider tests and sample data are admin-only.</p>}
      {msg && <p className="form__status" role="status" style={{ marginTop: 16 }}>{msg}</p>}

      <h2 className="section__eyebrow" style={{ marginTop: 48 }}>[ Theme studio ]</h2>
      <div className="row">
        <label className="admin__link">Accent<br /><input type="color" value={t.accent} onChange={(e) => set({ accent: e.target.value })} /></label>
        <label className="admin__link">Dim text ({Math.round(t.dim * 100)}%)<br /><input type="range" min="0.4" max="0.9" step="0.02" value={t.dim} onChange={(e) => set({ dim: Number(e.target.value) })} /></label>
        <label className="admin__link">Video scrim ({Math.round(t.scrim * 100)}%)<br /><input type="range" min="0" max="0.8" step="0.05" value={t.scrim} onChange={(e) => set({ scrim: Number(e.target.value) })} /></label>
        <button className="btn btn--ghost btn--auto" onClick={() => set(DEFAULT_THEME)}>Reset</button>
      </div>
      <p className="section__lead">Theme choices are saved in this browser only. All other data is stored server-side.</p>
    </>
  );
}
