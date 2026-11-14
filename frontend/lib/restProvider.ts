import type { DataProvider } from "@refinedev/core";

type Fail = { message: string; statusCode: number };

async function call(path: string, init?: { method?: string; body?: unknown }) {
  const hasBody = init?.body !== undefined;
  const res = await fetch(`/api/data${path}`, {
    method: init?.method ?? "GET",
    headers: hasBody ? { "Content-Type": "application/json" } : undefined,
    body: hasBody ? JSON.stringify(init!.body) : undefined,
    credentials: "same-origin",
    cache: "no-store",
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err: Fail = { message: (json as { error?: string }).error ?? `Request failed (${res.status})`, statusCode: res.status };
    throw err;
  }
  return json as any;
}

const provider = {
  getApiUrl: () => "/api/data",

  getList: async ({ resource, pagination, sorters, filters }: any) => {
    const sp = new URLSearchParams();
    sp.set("page", String(pagination?.current ?? 1));
    sp.set("pageSize", String(pagination?.pageSize ?? 10));
    if (sorters?.[0]) { sp.set("sort", sorters[0].field); sp.set("order", sorters[0].order); }
    for (const f of filters ?? []) {
      if (!("field" in f) || f.value === undefined || f.value === "") continue;
      if (f.operator === "contains") sp.set("q", String(f.value));
      else if (f.operator === "eq") sp.set(`f_${f.field}`, String(f.value));
    }
    const r = await call(`/${resource}?${sp}`);
    return { data: r.data, total: r.total };
  },

  getOne: async ({ resource, id }: any) => ({ data: (await call(`/${resource}/${encodeURIComponent(id)}`)).data }),
  create: async ({ resource, variables }: any) => ({ data: (await call(`/${resource}`, { method: "POST", body: variables })).data }),
  update: async ({ resource, id, variables }: any) => ({ data: (await call(`/${resource}/${encodeURIComponent(id)}`, { method: "PATCH", body: variables })).data }),
  deleteOne: async ({ resource, id }: any) => ({ data: await call(`/${resource}/${encodeURIComponent(id)}`, { method: "DELETE" }) }),
};

export const restProvider = provider as unknown as DataProvider;
