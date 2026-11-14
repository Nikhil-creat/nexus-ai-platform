import { env } from "./env";

/** Minimal key-value contract implemented by an in-memory store (dev / tests / fallback)
 *  and by Upstash Redis over REST (persistent, free tier, works on Vercel serverless). */
export interface Store {
  kind: "memory" | "upstash";
  hget(key: string, field: string): Promise<string | null>;
  hset(key: string, field: string, value: string): Promise<void>;
  hdel(key: string, field: string): Promise<void>;
  hgetall(key: string): Promise<Record<string, string>>;
  incr(key: string): Promise<number>;
  expire(key: string, seconds: number): Promise<void>;
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSeconds?: number): Promise<void>;
  del(key: string): Promise<void>;
  rpush(key: string, value: string): Promise<number>;
  lrange(key: string, start: number, stop: number): Promise<string[]>;
}

export class MemoryStore implements Store {
  kind = "memory" as const;
  private h = new Map<string, Map<string, string>>();
  private kv = new Map<string, { v: string; exp?: number }>();
  private l = new Map<string, string[]>();
  private ttl = new Map<string, number>();

  private live(key: string) {
    const t = this.ttl.get(key);
    if (t && t < Date.now()) { this.kv.delete(key); this.ttl.delete(key); }
  }
  async hget(k: string, f: string) { return this.h.get(k)?.get(f) ?? null; }
  async hset(k: string, f: string, v: string) { (this.h.get(k) ?? this.h.set(k, new Map()).get(k)!).set(f, v); }
  async hdel(k: string, f: string) { this.h.get(k)?.delete(f); }
  async hgetall(k: string) { return Object.fromEntries(this.h.get(k) ?? []); }
  async incr(k: string) {
    this.live(k);
    const n = Number(this.kv.get(k)?.v ?? 0) + 1;
    this.kv.set(k, { v: String(n) });
    return n;
  }
  async expire(k: string, s: number) { this.ttl.set(k, Date.now() + s * 1000); }
  async get(k: string) { this.live(k); return this.kv.get(k)?.v ?? null; }
  async set(k: string, v: string, ttl?: number) {
    this.kv.set(k, { v });
    if (ttl) this.ttl.set(k, Date.now() + ttl * 1000); else this.ttl.delete(k);
  }
  async del(k: string) { this.kv.delete(k); this.ttl.delete(k); this.h.delete(k); this.l.delete(k); }
  async rpush(k: string, v: string) { const a = this.l.get(k) ?? this.l.set(k, []).get(k)!; a.push(v); return a.length; }
  async lrange(k: string, s: number, e: number) {
    const a = this.l.get(k) ?? [];
    const end = e < 0 ? a.length + e + 1 : e + 1;
    const start = s < 0 ? Math.max(0, a.length + s) : s;
    return a.slice(start, end);
  }
}

export class UpstashStore implements Store {
  kind = "upstash" as const;
  private url: string;
  private token: string;
  constructor(url: string, token: string) {
    this.url = url;
    this.token = token;
  }

  private async cmd<T = unknown>(...args: (string | number)[]): Promise<T> {
    const res = await fetch(this.url, {
      method: "POST",
      headers: { Authorization: `Bearer ${this.token}`, "Content-Type": "application/json" },
      body: JSON.stringify(args),
      cache: "no-store",
    });
    const body = (await res.json().catch(() => ({}))) as { result?: T; error?: string };
    if (!res.ok || body.error) throw new Error(`Upstash error: ${body.error ?? res.status}`);
    return body.result as T;
  }
  async hget(k: string, f: string) { return (await this.cmd<string | null>("HGET", k, f)) ?? null; }
  async hset(k: string, f: string, v: string) { await this.cmd("HSET", k, f, v); }
  async hdel(k: string, f: string) { await this.cmd("HDEL", k, f); }
  async hgetall(k: string) {
    const flat = (await this.cmd<string[]>("HGETALL", k)) ?? [];
    const out: Record<string, string> = {};
    for (let i = 0; i < flat.length; i += 2) out[flat[i]] = flat[i + 1];
    return out;
  }
  async incr(k: string) { return this.cmd<number>("INCR", k); }
  async expire(k: string, s: number) { await this.cmd("EXPIRE", k, s); }
  async get(k: string) { return (await this.cmd<string | null>("GET", k)) ?? null; }
  async set(k: string, v: string, ttl?: number) { await (ttl ? this.cmd("SET", k, v, "EX", ttl) : this.cmd("SET", k, v)); }
  async del(k: string) { await this.cmd("DEL", k); }
  async rpush(k: string, v: string) { return this.cmd<number>("RPUSH", k, v); }
  async lrange(k: string, s: number, e: number) { return (await this.cmd<string[]>("LRANGE", k, s, e)) ?? []; }
}

const g = globalThis as unknown as { __nexusStore?: Store };

export function getStore(): Store {
  if (g.__nexusStore) return g.__nexusStore;
  g.__nexusStore = env.upstashUrl && env.upstashToken ? new UpstashStore(env.upstashUrl, env.upstashToken) : new MemoryStore();
  return g.__nexusStore;
}

/** Test hook: swap or reset the store. */
export function setStore(s: Store | undefined) { g.__nexusStore = s; }
