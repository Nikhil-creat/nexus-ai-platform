"use client";
import { use, useState } from "react";
import { useCreate, useDelete, useList, useUpdate } from "@refinedev/core";
import ResourceForm from "@/components/ResourceForm";
import { RESOURCES, can, type FieldDef } from "@/lib/resources";
import { useSession } from "@/lib/session";
import { download, toCsv } from "@/lib/store";

const BADGE: Record<string, string> = {
  active: "badge--ok", paid: "badge--ok", admin: "badge--ok",
  inactive: "badge--warn", pending: "badge--warn", review: "badge--warn", editor: "badge--warn",
  suspended: "badge--bad", refunded: "badge--bad", cancelled: "badge--bad",
};

function Cell({ f, v }: { f: FieldDef; v: unknown }) {
  if (v == null || v === "") return <>—</>;
  switch (f.type) {
    case "badge": return <span className={`badge ${BADGE[String(v)] ?? ""}`}>{String(v)}</span>;
    case "currency": return <>${Number(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })}</>;
    case "datetime": return <>{new Date(String(v)).toLocaleString()}</>;
    case "number": return <>{Number(v).toLocaleString()}</>;
    case "longtext": return <span title={String(v)}>{String(v).length > 90 ? String(v).slice(0, 90) + "…" : String(v)}</span>;
    default: return <>{String(v)}</>;
  }
}

export default function ResourcePage({ params }: { params: Promise<{ resource: string }> }) {
  const { resource } = use(params);
  const def = RESOURCES[resource];
  const role = useSession((s) => s.user?.role);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState(def ? def.defaultSort : { field: "id", order: "desc" as "asc" | "desc" });
  const [form, setForm] = useState<null | { mode: "create" } | { mode: "edit"; row: Record<string, unknown> }>(null);
  const [formError, setFormError] = useState("");
  const [notice, setNotice] = useState("");
  const pageSize = 10;
  const allowed = !!def && can(role, resource, "list");

  const list = useList({
    resource,
    pagination: { current: page, pageSize } as any,
    sorters: [sort],
    filters: q ? [{ field: "q", operator: "contains", value: q }] : [],
    queryOptions: { enabled: allowed },
  });
  const { mutate: create, isLoading: creating } = useCreate();
  const { mutate: update, isLoading: updating } = useUpdate();
  const { mutate: del } = useDelete();

  if (!def) return <h1 className="admin__h">Unknown resource</h1>;
  if (!allowed) return <><h1 className="admin__h">{def.label}</h1><p className="section__lead">Your role ({role}) cannot view this section.</p></>;

  const rows = (list.data?.data ?? []) as Record<string, unknown>[];
  const total = list.data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const canCreate = can(role, resource, "create");
  const canEdit = can(role, resource, "edit");
  const canDelete = can(role, resource, "delete");
  const fail = (e: unknown) => setFormError((e as { message?: string })?.message ?? "Something went wrong.");

  const submit = (values: Record<string, unknown>) => {
    setFormError("");
    if (form?.mode === "edit") update({ resource, id: String(form.row.id), values }, { onSuccess: () => { setForm(null); setNotice("Saved."); }, onError: fail });
    else create({ resource, values }, { onSuccess: () => { setForm(null); setNotice("Created."); }, onError: fail });
  };

  return (
    <>
      <h1 className="admin__h">{def.label}</h1>
      <div className="row">
        <input className="input" style={{ maxWidth: 320 }} placeholder={`Search ${def.label.toLowerCase()}…`} aria-label="Search" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
        {canCreate && <button className="btn btn--solid btn--auto" onClick={() => { setFormError(""); setForm({ mode: "create" }); }}>New</button>}
        <button className="btn btn--ghost btn--auto" onClick={() => download(`${resource}.csv`, toCsv(rows), "text/csv")} disabled={!rows.length}>Export CSV</button>
      </div>
      {notice && <p className="form__status" role="status">{notice}</p>}
      {list.isError && <p className="form__status" role="alert">⚠ {(list.error as { message?: string })?.message ?? "Could not load data."}</p>}

      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              {def.fields.map((f) => (
                <th key={f.name} style={{ cursor: "pointer" }} onClick={() => { setSort({ field: f.name, order: sort.field === f.name && sort.order === "asc" ? "desc" : "asc" }); setPage(1); }}>
                  {(f.label ?? f.name).replace("_", " ")}{sort.field === f.name ? (sort.order === "asc" ? " ↑" : " ↓") : ""}
                </th>
              ))}
              {(canEdit || canDelete) && <th />}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={String(row.id)}>
                {def.fields.map((f) => <td key={f.name}><Cell f={f} v={row[f.name]} /></td>)}
                {(canEdit || canDelete) && (
                  <td className="actions">
                    {canEdit && def.fields.some((f) => f.editable) && <button className="badge" onClick={() => { setFormError(""); setForm({ mode: "edit", row }); }}>edit</button>}
                    {canDelete && <button className="badge badge--bad" onClick={() => { if (confirm("Delete this record? It is recorded in the audit trail.")) del({ resource, id: String(row.id) }, { onSuccess: () => setNotice("Deleted."), onError: (e) => setNotice((e as { message?: string }).message ?? "Delete failed.") }); }}>delete</button>}
                  </td>
                )}
              </tr>
            ))}
            {list.isLoading && <tr><td colSpan={def.fields.length + 1}>Loading…</td></tr>}
            {!list.isLoading && !rows.length && !list.isError && <tr><td colSpan={def.fields.length + 1}>No records yet.{canCreate ? " Use “New” to add one." : ""}</td></tr>}
          </tbody>
        </table>
      </div>

      <div className="row" style={{ justifyContent: "space-between" }}>
        <span className="form__status">{total} record{total === 1 ? "" : "s"} · page {page} of {pages}</span>
        <span className="row" style={{ marginTop: 0 }}>
          <button className="btn btn--ghost btn--auto" disabled={page <= 1} onClick={() => setPage(page - 1)}>Prev</button>
          <button className="btn btn--ghost btn--auto" disabled={page >= pages} onClick={() => setPage(page + 1)}>Next</button>
        </span>
      </div>

      {form && (
        <ResourceForm
          def={def}
          title={form.mode === "edit" ? `Edit ${def.label.replace(/s$/, "")}` : `New ${def.label.replace(/s$/, "")}`}
          initial={form.mode === "edit" ? form.row : undefined}
          busy={creating || updating}
          error={formError}
          onSubmit={submit}
          onCancel={() => setForm(null)}
        />
      )}
    </>
  );
}
