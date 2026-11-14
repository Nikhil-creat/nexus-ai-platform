import type { DataProvider } from "@refinedev/core";

// Resource configs in the same shape the backend's schema_inspector.py emits.
export type Field = { name: string; type: "text" | "number" | "badge" | "datetime" | "email" | "image" | "currency" };
export const RESOURCES: Record<string, { label: string; fields: Field[] }> = {
  users: {
    label: "Users",
    fields: [
      { name: "id", type: "number" }, { name: "email", type: "email" }, { name: "role", type: "badge" },
      { name: "status", type: "badge" }, { name: "created_at", type: "datetime" },
    ],
  },
  orders: {
    label: "Orders",
    fields: [
      { name: "id", type: "number" }, { name: "customer", type: "text" }, { name: "total", type: "currency" },
      { name: "status", type: "badge" }, { name: "created_at", type: "datetime" },
    ],
  },
  finops: {
    label: "LLM FinOps",
    fields: [
      { name: "id", type: "number" }, { name: "user", type: "email" }, { name: "tokens", type: "number" },
      { name: "cost_usd", type: "currency" }, { name: "cache_hits", type: "number" },
    ],
  },
};

const day = (n: number) => new Date(Date.now() - n * 864e5).toISOString();
const hash = (i: number) => (i * 2654435761 >>> 0).toString(16).padStart(8, "0").repeat(2) + "…";

const store: Record<string, any[]> = {
  users: [
    { id: 1, email: "admin@nexus.dev", role: "admin", status: "active", created_at: day(90) },
    { id: 2, email: "editor@nexus.dev", role: "editor", status: "active", created_at: day(60) },
    { id: 3, email: "viewer@nexus.dev", role: "viewer", status: "active", created_at: day(30) },
    { id: 4, email: "old.account@nexus.dev", role: "viewer", status: "inactive", created_at: day(400) },
    { id: 5, email: "bot@nexus.dev", role: "editor", status: "suspended", created_at: day(12) },
  ],
  orders: [
    { id: 101, customer: "Acme Corp", total: 1240.5, status: "paid", created_at: day(2) },
    { id: 102, customer: "Globex", total: 12800, status: "review", created_at: day(1) },
    { id: 103, customer: "Initech", total: 89.99, status: "pending", created_at: day(0) },
    { id: 104, customer: "Umbrella", total: 560, status: "refunded", created_at: day(5) },
  ],
  audit: [1, 2, 3, 4, 5, 6].map((i) => ({
    id: i, actor: i % 2 ? "admin@nexus.dev" : "copilot@agent", action: ["schema.inspect", "hitl.approved", "document.extract", "user.update"][i % 4],
    hash: hash(i), created_at: day(7 - i),
  })),
  finops: [
    { id: 1, user: "admin@nexus.dev", tokens: 48210, cost_usd: 0.74, cache_hits: 31 },
    { id: 2, user: "editor@nexus.dev", tokens: 12090, cost_usd: 0.19, cache_hits: 8 },
    { id: 3, user: "copilot@agent", tokens: 90300, cost_usd: 1.36, cache_hits: 62 },
  ],
};

export const demoDataProvider: DataProvider = {
  getApiUrl: () => "demo://local",
  getList: async ({ resource, pagination, sorters, filters }) => {
    let rows = [...(store[resource] ?? [])];
    for (const f of filters ?? []) {
      if ("field" in f && f.value) rows = rows.filter((r) => String(r[f.field]).toLowerCase().includes(String(f.value).toLowerCase()));
    }
    const s = sorters?.[0];
    if (s) rows.sort((a, b) => (a[s.field] > b[s.field] ? 1 : -1) * (s.order === "desc" ? -1 : 1));
    const pageSize = (pagination as any)?.pageSize ?? 10;
    const current = (pagination as any)?.current ?? 1;
    return { data: rows.slice((current - 1) * pageSize, current * pageSize) as any, total: rows.length };
  },
  getOne: async ({ resource, id }) => ({ data: store[resource].find((r) => String(r.id) === String(id)) as any }),
  create: async ({ resource, variables }) => {
    const row = { id: Math.max(0, ...store[resource].map((r) => r.id)) + 1, created_at: new Date().toISOString(), ...(variables as object) };
    store[resource].push(row);
    return { data: row as any };
  },
  update: async ({ resource, id, variables }) => {
    const i = store[resource].findIndex((r) => String(r.id) === String(id));
    store[resource][i] = { ...store[resource][i], ...(variables as object) };
    return { data: store[resource][i] };
  },
  deleteOne: async ({ resource, id }) => {
    const i = store[resource].findIndex((r) => String(r.id) === String(id));
    const [row] = store[resource].splice(i, 1);
    return { data: row as any };
  },
};
