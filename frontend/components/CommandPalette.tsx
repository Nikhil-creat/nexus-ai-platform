"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Cmd = { label: string; hint: string; run: () => void };

export default function CommandPalette({ openCopilot }: { openCopilot: () => void }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const router = useRouter();

  const cmds: Cmd[] = useMemo(
    () => [
      { label: "Open admin dashboard", hint: "/admin", run: () => router.push("/admin") },
      { label: "Users", hint: "/admin/users", run: () => router.push("/admin/users") },
      { label: "Orders", hint: "/admin/orders", run: () => router.push("/admin/orders") },
      { label: "Schema Studio", hint: "/admin/studio", run: () => router.push("/admin/studio") },
      { label: "Knowledge search", hint: "/admin/knowledge", run: () => router.push("/admin/knowledge") },
      { label: "Audit trail", hint: "/admin/audit", run: () => router.push("/admin/audit") },
      { label: "Workflows", hint: "/admin/workflows", run: () => router.push("/admin/workflows") },
      { label: "Settings & theme", hint: "/admin/settings", run: () => router.push("/admin/settings") },
      { label: "Ask Nexus Copilot", hint: "AI", run: openCopilot },
      { label: "Go to Platform", hint: "#platform", run: () => (location.hash = "platform") },
      { label: "Go to Security", hint: "#security", run: () => (location.hash = "security") },
      { label: "Go to Contact", hint: "#contact", run: () => (location.hash = "contact") },
    ],
    [router, openCopilot]
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setOpen((o) => !o); setQ(""); }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (!open) return null;
  const list = cmds.filter((c) => c.label.toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="cmdk" onClick={() => setOpen(false)}>
      <div className="cmdk__box" role="dialog" aria-label="Command palette" onClick={(e) => e.stopPropagation()}>
        <input
          className="input" autoFocus placeholder="Type a command…" value={q} onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && list[0]) { list[0].run(); setOpen(false); } }}
        />
        {list.map((c, i) => (
          <button key={c.label} className={`cmdk__item ${i === 0 ? "is-active" : ""}`} onClick={() => { c.run(); setOpen(false); }}>
            <span>{c.label}</span><span>{c.hint}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
