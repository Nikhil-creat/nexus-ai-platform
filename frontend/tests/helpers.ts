import { MemoryStore, setStore } from "../server/store";

export function freshEnv(extra: Record<string, string> = {}) {
  for (const k of ["GROQ_API_KEY", "GEMINI_API_KEY", "LLM_BASE_URL", "ADMIN_EMAIL", "ALLOW_SIGNUP", "LLM_PROVIDER", "UPSTASH_REDIS_REST_URL", "KV_REST_API_URL"]) delete process.env[k];
  process.env.SESSION_SECRET = "test-secret-0123456789abcdef";
  Object.assign(process.env, extra);
  setStore(new MemoryStore());
}

export const BASE = "http://localhost:3000";

export function req(path: string, init: { method?: string; body?: unknown; cookie?: string; ip?: string; origin?: string } = {}) {
  const headers: Record<string, string> = { "x-forwarded-for": init.ip ?? "10.0.0.1" };
  if (init.body !== undefined) headers["content-type"] = "application/json";
  if (init.cookie) headers.cookie = init.cookie;
  if (init.origin) headers.origin = init.origin;
  return new Request(BASE + path, { method: init.method ?? (init.body !== undefined ? "POST" : "GET"), headers, body: init.body !== undefined ? JSON.stringify(init.body) : undefined });
}

export const cookieOf = (res: Response) => (res.headers.get("set-cookie") ?? "").split(";")[0];

export async function readSse(res: Response): Promise<{ type: string; [k: string]: unknown }[]> {
  const text = await res.text();
  return text.split("\n\n").filter(Boolean).map((chunk) => JSON.parse(/data: (.*)/.exec(chunk)![1]));
}

type Reply = { status?: number; body?: unknown };
/** Replaces global fetch with a scripted LLM. Each call consumes the next reply; returns the captured request bodies. */
export function stubLlm(replies: ((url: string, body: any) => Reply)[]) {
  const calls: { url: string; body: any }[] = [];
  const original = globalThis.fetch;
  let i = 0;
  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    const u = String(url);
    const body = init?.body ? JSON.parse(String(init.body)) : {};
    calls.push({ url: u, body });
    const r = replies[Math.min(i++, replies.length - 1)](u, body);
    return new Response(JSON.stringify(r.body ?? {}), { status: r.status ?? 200, headers: { "content-type": "application/json" } });
  }) as typeof fetch;
  return { calls, restore: () => { globalThis.fetch = original; } };
}

export const llmText = (content: string, usage = { prompt_tokens: 10, completion_tokens: 5 }) => ({ body: { choices: [{ message: { content } }], usage } });
export const llmTool = (name: string, args: unknown, id = "call_1") => ({
  body: { choices: [{ message: { content: null, tool_calls: [{ id, type: "function", function: { name, arguments: JSON.stringify(args) } }] } }], usage: { prompt_tokens: 20, completion_tokens: 10 } },
});
