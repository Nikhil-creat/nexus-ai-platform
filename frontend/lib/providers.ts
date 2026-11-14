import type { AccessControlProvider, AuthProvider } from "@refinedev/core";
import { create } from "zustand";

export type Role = "admin" | "editor" | "viewer";

export const useRole = create<{ role: Role; setRole: (r: Role) => void }>((set) => ({
  role: "admin",
  setRole: (role) => set({ role }),
}));

const MATRIX: Record<Role, string[]> = {
  admin: ["list", "show", "create", "edit", "delete"],
  editor: ["list", "show", "create", "edit"],
  viewer: ["list", "show"],
};

/** Mirrors backend/app/security.py RBAC. The server remains the source of truth. */
export const accessControlProvider: AccessControlProvider = {
  can: async ({ resource, action }) => {
    const role = useRole.getState().role;
    // Audit trail is read-only for everyone; FinOps hidden from viewers.
    if (resource === "audit" && action !== "list") return { can: false, reason: "Audit trail is append-only" };
    if (resource === "finops" && role === "viewer") return { can: false, reason: "Viewers cannot see FinOps" };
    const ok = MATRIX[role].includes(action);
    return { can: ok, reason: ok ? undefined : `${role} may not ${action}` };
  },
};

export const authProvider: AuthProvider = {
  login: async () => ({ success: true, redirectTo: "/admin" }),
  logout: async () => ({ success: true, redirectTo: "/" }),
  check: async () => ({ authenticated: true }),
  onError: async (error) => ({ error }),
  getPermissions: async () => useRole.getState().role,
};
