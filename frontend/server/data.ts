import { appendAudit } from "./audit";
import { clean } from "./guard";
import { HttpError } from "./http";
import { getStore } from "./store";
import { RESOURCES, can, type Action, type FieldDef, type ResourceDef } from "../lib/resources";
import type { PublicUser } from "./auth";

type Row = Record<string, unknown>;
export type Actor = Pick<PublicUser, "id" | "email" | "role">;

const coll = (r: string) => `c:${r}`;

function def(resource: string): ResourceDef {
  const d = RESOURCES[resource];
  if (!d) throw new HttpError(404, `Unknown resource "${resource}".`);
  return d;
}
function allow(user: Actor, resource: string, action: Action) {
  def(resource);
  if (!can(user.role, resource, action)) throw new HttpError(403, `Your role (${user.role}) cannot ${action} ${resource}.`);
}
/** Only fields declared in the schema leave the server (this is what keeps password hashes out of responses). */
const project = (d: ResourceDef, row: Row): Row => Object.fromEntries(d.fields.map((f) => [f.name, row[f.name] ?? null]));

async function loadAll(resource: string): Promise<Row[]> {
  return Object.values(await getStore().hgetall(coll(resource))).map((v) => JSON.parse(v) as Row);
}

function coerce(f: FieldDef, v: unknown): unknown {
  switch (f.type) {
    case "number":
    case "currency": {
      const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN;
      if (!Number.isFinite(n)) throw new HttpError(400, `${f.name} must be a number.`);
      if (f.min !== undefined && n < f.min) throw new HttpError(400, `${f.name} must be at least ${f.min}.`);
      if (f.max !== undefined && n > f.max) throw new HttpError(400, `${f.name} must be at most ${f.max}.`);
      return f.type === "currency" ? Math.round(n * 100) / 100 : n;
    }
    case "badge": {
      if (typeof v !== "string" || !f.enum?.includes(v)) throw new HttpError(400, `${f.name} must be one of: ${f.enum?.join(", ")}.`);
      return v;
    }
    default: {
      const s = clean(v, f.maxLength ?? (f.type === "longtext" ? 2000 : 200));
      if (!s) throw new HttpError(400, `${f.name} is required.`);
      return s;
    }
  }
}

function validate(d: ResourceDef, body: Row, mode: "create" | "update"): Row {
  const out: Row = {};
  for (const f of d.fields.filter((x) => x.editable)) {
    const present = body[f.name] !== undefined && body[f.name] !== null && body[f.name] !== "";
    if (present) out[f.name] = coerce(f, body[f.name]);
    else if (mode === "create") {
      if (f.required) throw new HttpError(400, `${f.name} is required.`);
      if (f.type === "badge" && f.enum) out[f.name] = f.enum[0];
    }
  }
  if (mode === "update" && Object.keys(out).length === 0) throw new HttpError(400, "Nothing to update.");
  return out;
}

/** Dry-run validation used by the copilot before it asks a human to approve a write. */
export function validateFields(resource: string, body: Row, mode: "create" | "update"): Row {
  allow({ id: "", email: "", role: "admin" }, resource, mode === "create" ? "create" : "edit");
  return validate(def(resource), body, mode);
}

export type ListQuery = { page?: number; pageSize?: number; sort?: string; order?: string; q?: string; filters?: Record<string, string> };

export async function list(user: Actor, resource: string, query: ListQuery = {}) {
  allow(user, resource, "list");
  const d = def(resource);
  let rows = await loadAll(resource);
  if (query.q) {
    const q = query.q.toLowerCase();
    rows = rows.filter((r) => d.searchFields.some((f) => String(r[f] ?? "").toLowerCase().includes(q)));
  }
  for (const [k, v] of Object.entries(query.filters ?? {})) {
    if (d.fields.some((f) => f.name === k)) rows = rows.filter((r) => String(r[k]).toLowerCase() === v.toLowerCase());
  }
  const sortField = d.fields.some((f) => f.name === query.sort) ? query.sort! : d.defaultSort.field;
  const dir = (query.order ?? d.defaultSort.order) === "asc" ? 1 : -1;
  rows.sort((a, b) => {
    const x = a[sortField], y = b[sortField];
    if (typeof x === "number" && typeof y === "number") return (x - y) * dir;
    return String(x ?? "").localeCompare(String(y ?? "")) * dir;
  });
  const pageSize = Math.min(Math.max(Math.floor(query.pageSize ?? 10), 1), 100);
  const page = Math.max(Math.floor(query.page ?? 1), 1);
  return { data: rows.slice((page - 1) * pageSize, page * pageSize).map((r) => project(d, r)), total: rows.length };
}

export async function getOne(user: Actor, resource: string, id: string) {
  allow(user, resource, "list");
  const raw = await getStore().hget(coll(resource), id);
  if (!raw) throw new HttpError(404, "Record not found.");
  return project(def(resource), JSON.parse(raw));
}

export async function create(user: Actor, resource: string, body: Row, actorLabel?: string) {
  allow(user, resource, "create");
  const d = def(resource);
  const store = getStore();
  const fields = validate(d, body, "create");
  const id = String(await store.incr(`seq:${resource}`));
  const row: Row = { id: Number(id), ...fields, created_at: new Date().toISOString() };
  await store.hset(coll(resource), id, JSON.stringify(row));
  await appendAudit({ actor: actorLabel ?? user.email, action: `${resource}.create`, resource, target: id, after: project(d, row) });
  return project(d, row);
}

async function activeAdmins(): Promise<number> {
  return (await loadAll("users")).filter((u) => u.role === "admin" && u.status === "active").length;
}

export async function update(user: Actor, resource: string, id: string, body: Row, actorLabel?: string) {
  allow(user, resource, "edit");
  const d = def(resource);
  const store = getStore();
  const raw = await store.hget(coll(resource), id);
  if (!raw) throw new HttpError(404, "Record not found.");
  const before = JSON.parse(raw) as Row;
  const changes = validate(d, body, "update");
  if (resource === "users") {
    if (id === user.id) throw new HttpError(400, "You cannot change your own role or status.");
    const losesAdmin = before.role === "admin" && before.status === "active" &&
      ((changes.role && changes.role !== "admin") || (changes.status && changes.status !== "active"));
    if (losesAdmin && (await activeAdmins()) <= 1) throw new HttpError(400, "At least one active admin must remain.");
  }
  const after = { ...before, ...changes };
  await store.hset(coll(resource), id, JSON.stringify(after));
  await appendAudit({ actor: actorLabel ?? user.email, action: `${resource}.update`, resource, target: id, before: project(d, before), after: project(d, after) });
  return project(d, after);
}

export async function remove(user: Actor, resource: string, id: string, actorLabel?: string) {
  allow(user, resource, "delete");
  const d = def(resource);
  const store = getStore();
  const raw = await store.hget(coll(resource), id);
  if (!raw) throw new HttpError(404, "Record not found.");
  const before = JSON.parse(raw) as Row;
  if (resource === "users") {
    if (id === user.id) throw new HttpError(400, "You cannot delete your own account.");
    if (before.role === "admin" && before.status === "active" && (await activeAdmins()) <= 1) throw new HttpError(400, "At least one active admin must remain.");
    await store.hdel("u:email", String(before.email));
  }
  await store.hdel(coll(resource), id);
  await appendAudit({ actor: actorLabel ?? user.email, action: `${resource}.delete`, resource, target: id, before: project(d, before) });
  return { id };
}

/** Finds records by exact (case-insensitive) field match. Used by the copilot to resolve "that user" style requests. */
export async function findWhere(user: Actor, resource: string, field: string, value: string, limit = 50) {
  allow(user, resource, "list");
  const d = def(resource);
  if (!d.fields.some((f) => f.name === field)) throw new HttpError(400, `Unknown field "${field}".`);
  const v = value.toLowerCase();
  return (await loadAll(resource)).filter((r) => String(r[field] ?? "").toLowerCase() === v).slice(0, limit).map((r) => project(d, r));
}

/** System-written FinOps counters (no user-facing write path). */
export async function recordUsage(email: string, tokens: number, costUsd: number) {
  const store = getStore();
  const cur = JSON.parse((await store.hget(coll("usage"), email)) ?? "null") ?? { id: email, requests: 0, tokens: 0, cost_usd: 0 };
  const next = { id: email, requests: cur.requests + 1, tokens: cur.tokens + tokens, cost_usd: Math.round((cur.cost_usd + costUsd) * 1e6) / 1e6 };
  await store.hset(coll("usage"), email, JSON.stringify(next));
}

export async function seedSample(user: Actor) {
  if (user.role !== "admin") throw new HttpError(403, "Only admins can load sample data.");
  const existing = (await loadAll("orders")).length;
  if (existing > 0) throw new HttpError(409, "Orders already exist; sample data is only added to an empty workspace.");
  const sample: [string, number, string][] = [
    ["Acme Corp", 1240.5, "paid"], ["Globex", 12800, "pending"], ["Initech", 89.99, "pending"], ["Umbrella", 560, "refunded"],
    ["Hooli", 23400, "pending"], ["Stark Industries", 9800, "paid"], ["Wayne Enterprises", 15600.75, "pending"], ["Wonka", 310, "cancelled"],
  ];
  for (const [customer, total, status] of sample) await create(user, "orders", { customer, total, status }, `${user.email} (sample data)`);
  return { orders: sample.length };
}
