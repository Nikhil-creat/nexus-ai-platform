import { create } from "zustand";
import type { Role } from "./resources";

export type SessionUser = { id: string; email: string; role: Role; status: string; created_at: string };

type SessionState = {
  user: SessionUser | null;
  ready: boolean;
  refresh: () => Promise<void>;
  setUser: (u: SessionUser | null) => void;
  logout: () => Promise<void>;
};

export const useSession = create<SessionState>()((set) => ({
  user: null,
  ready: false,
  refresh: async () => {
    try {
      const r = await fetch("/api/auth/me", { credentials: "same-origin", cache: "no-store" });
      const j = (await r.json()) as { user: SessionUser | null };
      set({ user: j.user ?? null, ready: true });
    } catch {
      set({ user: null, ready: true });
    }
  },
  setUser: (user) => set({ user, ready: true }),
  logout: async () => {
    try { await fetch("/api/auth/logout", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}", credentials: "same-origin" }); } catch { /* ignore */ }
    set({ user: null, ready: true });
  },
}));
