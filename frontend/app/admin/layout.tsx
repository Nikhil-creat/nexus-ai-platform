"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Refine } from "@refinedev/core";
import routerProvider from "@refinedev/nextjs-router";
import { QueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import Shell from "@/components/Shell";
import { usePresence } from "@/lib/presence";
import { accessControlProvider } from "@/lib/providers";
import { restProvider } from "@/lib/restProvider";
import { RESOURCES, can } from "@/lib/resources";
import { useSession } from "@/lib/session";

const TOOLS = [
  ["/admin/studio", "Schema Studio"],
  ["/admin/knowledge", "Knowledge"],
  ["/admin/workflows", "Workflows"],
  ["/admin/audit", "Audit trail"],
  ["/admin/settings", "Settings"],
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const { user, ready, refresh, logout } = useSession();
  const [qc] = useState(() => new QueryClient());
  const live = usePresence();
  const [menu, setMenu] = useState(false);

  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => { if (ready && !user) router.replace("/login"); }, [ready, user, router]);
  useEffect(() => { setMenu(false); }, [path]);

  if (!ready || !user) return <div className="auth"><p className="form__status">Loading…</p></div>;

  const visible = Object.values(RESOURCES).filter((r) => can(user.role, r.name, "list"));
  const link = (href: string, label: string) => (
    <Link key={href} href={href} className={`admin__link ${path === href ? "is-active" : ""}`}>{label}</Link>
  );
  const signOut = async () => { await logout(); router.push("/"); };

  return (
    <Refine
      dataProvider={restProvider}
      routerProvider={routerProvider}
      accessControlProvider={accessControlProvider}
      resources={visible.map((r) => ({ name: r.name, list: `/admin/${r.name}`, meta: { label: r.label } }))}
      options={{ syncWithLocation: false, warnWhenUnsavedChanges: false, reactQuery: { clientConfig: qc } }}
    >
      <Shell>
        {() => (
          <div className="admin">
            <header className="admin__top">
              <Link href="/" className="admin__brand">NEXUS</Link>
              <button className="admin__burger" aria-expanded={menu} aria-controls="sidenav" onClick={() => setMenu((m) => !m)}>{menu ? "Close" : "Menu"}</button>
            </header>
            <aside id="sidenav" className={`admin__side ${menu ? "is-open" : ""}`}>
              <Link href="/" className="admin__brand admin__brand--side">NEXUS</Link>
              {link("/admin", "Overview")}
              {visible.map((r) => link(`/admin/${r.name}`, r.label))}
              {TOOLS.map(([href, label]) => link(href, label))}
              <div className="admin__spacer" />
              <div className="admin__link" title="Open tabs of this app in this browser">
                <span className="live-dot" /> {live} {live === 1 ? "tab" : "tabs"} live
              </div>
              <div className="admin__link admin__who">
                {user.email}
                <span className={`badge ${user.role === "admin" ? "badge--ok" : ""}`} style={{ marginLeft: 8 }}>{user.role}</span>
              </div>
              <button className="admin__link admin__btn" onClick={signOut}>Sign out</button>
            </aside>
            <section className="admin__main">{children}</section>
          </div>
        )}
      </Shell>
    </Refine>
  );
}
