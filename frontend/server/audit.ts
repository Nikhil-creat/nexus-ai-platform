import { sha256 } from "./crypto";
import { getStore } from "./store";

export type AuditEntry = {
  seq: number; ts: string; actor: string; action: string; resource: string; target: string;
  before: unknown; after: unknown; note: string; prev: string; hash: string;
};
const KEY = "audit";
export const GENESIS = "0".repeat(64);

function stable(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(stable).join(",")}]`;
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    return `{${Object.keys(o).sort().map((k) => `${JSON.stringify(k)}:${stable(o[k])}`).join(",")}}`;
  }
  return JSON.stringify(v ?? null);
}
const shrink = (v: unknown) => (v === undefined ? null : stable(v).length > 1500 ? { _truncated: true } : v);

export const entryHash = (prev: string, e: Omit<AuditEntry, "prev" | "hash">) => sha256(prev + stable(e));

let queue: Promise<unknown> = Promise.resolve(); // serialises appends within one server instance

export function appendAudit(e: { actor: string; action: string; resource?: string; target?: string; before?: unknown; after?: unknown; note?: string }): Promise<AuditEntry> {
  const run = async () => {
    const store = getStore();
    const last = (await store.lrange(KEY, -1, -1))[0];
    const prevEntry = last ? (JSON.parse(last) as AuditEntry) : undefined;
    const body = {
      seq: (prevEntry?.seq ?? 0) + 1,
      ts: new Date().toISOString(),
      actor: e.actor, action: e.action, resource: e.resource ?? "", target: e.target ?? "",
      before: shrink(e.before), after: shrink(e.after), note: (e.note ?? "").slice(0, 300),
    };
    const prev = prevEntry?.hash ?? GENESIS;
    const entry: AuditEntry = { ...body, prev, hash: entryHash(prev, body) };
    await store.rpush(KEY, JSON.stringify(entry));
    return entry;
  };
  const p = queue.then(run, run);
  queue = p.catch(() => undefined);
  return p;
}

export async function readAudit(limit = 100): Promise<{ intact: boolean; brokenAt: number | null; total: number; entries: AuditEntry[] }> {
  const raw = await getStore().lrange(KEY, 0, -1);
  const all = raw.map((r) => JSON.parse(r) as AuditEntry);
  let prev = GENESIS;
  let brokenAt: number | null = null;
  for (const e of all) {
    const { prev: p, hash, ...body } = e;
    if (p !== prev || hash !== entryHash(prev, body)) { brokenAt = e.seq; break; }
    prev = hash;
  }
  return { intact: brokenAt === null, brokenAt, total: all.length, entries: all.slice(-limit).reverse() };
}
