"use client";
import { use, useState } from "react";
import { useCan, useDelete, useList } from "@refinedev/core";
import { RESOURCES, type Field } from "@/lib/demoData";
import { download, toCsv } from "@/lib/store";

const BADGE: Record<string, string> = {
  active: "badge--ok", paid: "badge--ok", admin: "badge--ok",
  inactive: "badge--warn", pending: "badge--warn", review: "badge--warn",
  suspended: "badge--bad", refunded: "badge--bad",
};

function Cell({ f, v }: { f: Field; v: any }) {
  if (v == null) return <>—</>;
  switch (f.type) {
    case "badge": return <span className={`badge ${BADGE[v] ?? ""}`}>{v}</span>;
    case "currency": return <>${Number(v).toLocaleString(undefined, { minimumFractionDigits: 2 })}</>;
    case "datetime": return <>{new Date(v).toLocaleDateString()}</>;
    case "number": return <>{Number(v).toLocaleString()}</>;
    default: return <>{String(v)}</>;
  }
}

export default function ResourcePage({ params }: { params: Promise<{ resource: string }> }) {
  const { resource } = use(params);
  const cfg = RESOURCES[resource];
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<{ field: string; order: "asc" | "desc" }>({ field: "id", order: "asc" });
  const searchField = cfg?.fields.find((f) => ["email", "text"].includes(f.type))?.name ?? "id";

  const list = useList({
    resource,
    sorters: [sort],
    filters: q ? [{ field: searchField, operator: "contains", value: q }] : [],
  });
  const canDelete = useCan({ resource, action: "delete" });
  const { mutate: del } = useDelete();

  if (!cfg) return <h1 className="admin__h">Unknown resource</h1>;

  return (
    <>
      <h1 className="admin__h">{cfg.label}</h1>
      <input className="input" style={{ maxWidth: 360, marginTop: 16 }} placeholder={`Filter by ${searchField}`} value={q} onChange={(e) => setQ(e.target.value)} />
      <button className="btn btn--ghost" style={{ width: "auto", padding: "12px 20px", marginLeft: 12 }}
        onClick={() => download(`${resource}.csv`, toCsv((list.data?.data ?? []) as Record<string, unknown>[]), "text/csv")}>
        Export CSV
      </button>
      <table className="table">
        <thead>
          <tr>
            {cfg.fields.map((f) => (
              <th key={f.name} style={{ cursor: "pointer" }} onClick={() => setSort({ field: f.name, order: sort.field === f.name && sort.order === "asc" ? "desc" : "asc" })}>
                {f.name.replace("_", " ")}{sort.field === f.name ? (sort.order === "asc" ? " ↑" : " ↓") : ""}
              </th>
            ))}
            <th />
          </tr>
        </thead>
        <tbody>
          {(list.data?.data ?? []).map((row: any) => (
            <tr key={row.id}>
              {cfg.fields.map((f) => <td key={f.name}><Cell f={f} v={row[f.name]} /></td>)}
              <td>
                {canDelete.data?.can ? (
                  <button className="badge badge--bad" style={{ border: 0, cursor: "pointer" }}
                    onClick={() => { if (confirm(`Delete #${row.id}? This will be recorded in the audit trail.`)) del({ resource, id: row.id }); }}>
                    delete
                  </button>
                ) : (
                  <span title={canDelete.data?.reason} className="badge">locked</span>
                )}
              </td>
            </tr>
          ))}
          {list.isLoading && <tr><td colSpan={cfg.fields.length + 1}>Loading…</td></tr>}
        </tbody>
      </table>
    </>
  );
}
