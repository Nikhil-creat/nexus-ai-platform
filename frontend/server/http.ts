import { env } from "./env";

export class HttpError extends Error {
  status: number;
  extra?: Record<string, unknown>;
  constructor(status: number, message: string, extra?: Record<string, unknown>) {
    super(message);
    this.status = status;
    this.extra = extra;
  }
}

const BASE_HEADERS = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };

export function json(data: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...BASE_HEADERS, ...headers },
  });
}

export async function readJson<T = Record<string, unknown>>(req: Request, maxBytes = 32_000): Promise<T> {
  const ct = req.headers.get("content-type") ?? "";
  if (!ct.includes("application/json")) throw new HttpError(415, "Content-Type must be application/json");
  const text = await req.text();
  if (text.length > maxBytes) throw new HttpError(413, "Request body too large");
  try {
    const v = JSON.parse(text || "{}");
    if (v === null || typeof v !== "object" || Array.isArray(v)) throw new Error("not an object");
    return v as T;
  } catch {
    throw new HttpError(400, "Invalid JSON body");
  }
}

export function ipOf(req: Request): string {
  const xf = req.headers.get("x-forwarded-for");
  return (xf?.split(",")[0] ?? req.headers.get("x-real-ip") ?? "unknown").trim();
}

/** CSRF defence for cookie auth: a browser sends Origin on cross-site POSTs; it must match our host. */
export function checkOrigin(req: Request) {
  if (req.method === "GET" || req.method === "HEAD") return;
  const origin = req.headers.get("origin");
  if (!origin) return; // non-browser clients (curl, tests) have no Origin; cookies are SameSite=Lax anyway
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? new URL(req.url).host;
  let o: string;
  try { o = new URL(origin).host; } catch { throw new HttpError(403, "Bad origin"); }
  if (o !== host) throw new HttpError(403, "Cross-origin request blocked");
}

export function isSecure(req: Request): boolean {
  return env.production || req.headers.get("x-forwarded-proto") === "https" || new URL(req.url).protocol === "https:";
}

export type Ctx = { params: Promise<Record<string, string>> };

/** Wraps a handler: origin check + consistent JSON errors, never leaking internals. */
export function handle(fn: (req: Request, params: Record<string, string>) => Promise<Response>) {
  return async (req: Request, ctx?: { params: Promise<Record<string, string>> }): Promise<Response> => {
    try {
      checkOrigin(req);
      return await fn(req, ctx ? await ctx.params : {});
    } catch (e) {
      if (e instanceof HttpError) return json({ error: e.message, ...e.extra }, e.status);
      console.error("[api] unhandled", e);
      return json({ error: "Internal server error" }, 500);
    }
  };
}
