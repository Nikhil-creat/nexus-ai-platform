"use client";
import { useEffect, useState } from "react";
import { applyTheme, DEFAULT_THEME, Theme } from "@/components/ThemeLoader";
import { download, load, save } from "@/lib/store";

export default function Settings() {
  const [t, setT] = useState<Theme>(DEFAULT_THEME);
  useEffect(() => { setT(load("nexus_theme", DEFAULT_THEME)); }, []);
  const set = (p: Partial<Theme>) => { const n = { ...t, ...p }; setT(n); save("nexus_theme", n); applyTheme(n); };

  const exportAll = () => {
    const dump: Record<string, unknown> = {};
    ["nexus_docs", "nexus_rules", "nexus_audit", "nexus_theme"].forEach((k) => (dump[k] = load(k, null)));
    download("nexus-export.json", JSON.stringify(dump, null, 2), "application/json");
  };
  const wipe = () => {
    if (!confirm("Delete all locally stored Nexus data (documents, rules, audit, theme)?")) return;
    ["nexus_docs", "nexus_rules", "nexus_audit", "nexus_theme"].forEach((k) => { try { localStorage.removeItem(k); } catch {} });
    location.reload();
  };

  return (
    <>
      <h1 className="admin__h">Settings</h1>
      <h2 className="section__eyebrow" style={{ marginTop: 32 }}>[ Theme studio ]</h2>
      <div className="row">
        <label className="admin__link">Accent<br /><input type="color" value={t.accent} onChange={(e) => set({ accent: e.target.value })} /></label>
        <label className="admin__link">Dim text ({Math.round(t.dim * 100)}%)<br /><input type="range" min="0.4" max="0.9" step="0.02" value={t.dim} onChange={(e) => set({ dim: Number(e.target.value) })} /></label>
        <label className="admin__link">Video scrim ({Math.round(t.scrim * 100)}%)<br /><input type="range" min="0" max="0.8" step="0.05" value={t.scrim} onChange={(e) => set({ scrim: Number(e.target.value) })} /></label>
        <button className="btn btn--ghost" style={{ width: "auto", padding: "12px 20px" }} onClick={() => set(DEFAULT_THEME)}>Reset</button>
      </div>
      <div className="grid" style={{ maxWidth: 640 }}>
        <article className="cell"><span className="cell__n">PREVIEW</span><h3 className="cell__t">Live tokens</h3><p className="cell__d">Changes apply instantly across the site and are saved in this browser.</p></article>
      </div>

      <h2 className="section__eyebrow" style={{ marginTop: 48 }}>[ Data ]</h2>
      <p className="section__lead">Documents, rules, audit entries and theme live only in this browser. Export a backup or wipe it.</p>
      <div className="row">
        <button className="btn btn--solid" style={{ width: "auto", padding: "14px 28px" }} onClick={exportAll}>Export JSON</button>
        <button className="btn btn--ghost" style={{ width: "auto", padding: "14px 28px" }} onClick={wipe}>Delete local data</button>
      </div>
      <p className="form__status" style={{ marginTop: 24 }}>Backend: {process.env.NEXT_PUBLIC_API_URL ?? "not connected (demo mode)"}</p>
    </>
  );
}
