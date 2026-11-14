import type { AccessControlProvider } from "@refinedev/core";
import { can, type Action } from "./resources";
import { useSession } from "./session";

/** Mirrors the server's role matrix (lib/resources.ts). The server still enforces every rule; this only hides what you can't do. */
export const accessControlProvider: AccessControlProvider = {
  can: async ({ resource, action }) => {
    if (!resource) return { can: true };
    const role = useSession.getState().user?.role;
    const mapped: Action = action === "list" || action === "show" ? "list" : action === "create" ? "create" : action === "delete" ? "delete" : "edit";
    const ok = can(role, resource, mapped);
    return { can: ok, reason: ok ? undefined : `Your role (${role ?? "signed out"}) cannot ${mapped} ${resource}` };
  },
};
