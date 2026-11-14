"use client";
import { useEffect } from "react";
import { load } from "@/lib/store";

export type Theme = { accent: string; dim: number; scrim: number };
export const DEFAULT_THEME: Theme = { accent: "#ffffff", dim: 0.62, scrim: 0.45 };

export function applyTheme(t: Theme) {
  const r = document.documentElement.style;
  r.setProperty("--accent", t.accent);
  r.setProperty("--text-dim", `rgba(255,255,255,${t.dim})`);
  r.setProperty("--scrim", String(t.scrim));
}

/** Applies the saved theme and registers the offline service worker (production only). */
export default function ThemeLoader() {
  useEffect(() => {
    applyTheme(load("nexus_theme", DEFAULT_THEME));
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    }
  }, []);
  return null;
}
