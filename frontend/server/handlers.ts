import { readAudit, appendAudit } from "./audit";
import { clearCookie, getUser, login, register, requireUser } from "./auth";
import { decideApproval, runCopilot, type CopilotEvent } from "./copilot";
import * as data from "./data";
import { env } from "./env";
import { clean, rateLimit } from "./guard";
import { HttpError, handle, ipOf, isSecure, json, readJson } from "./http";
import { addDoc, listDocs, removeDoc, searchDocs, seedDocs } from "./knowledge";
import { probe, providers } from "./llm";
import { addRule, listRules, removeRule, runRules } from "./rules";
import { getStore } from "./store";
import { CAPS } from "../lib/resources";

const user = requireUser;

// ---------- status ----------
export const health = handle(async () => {
  const store = getStore();
  const llm = Object.fromEntries(providers().map((p) => [p.name, p.model]));
  return json({
    ok: true,
    storage: store.kind,
    persistent: store.kind === "upstash",
    sessionSecret: env.sessionSecret.length >= 16,
    adminEmailSet: !!env.adminEmail,
    signupOpen: env.allowSignup,
    llm,
  });
});

export const aiProbe = handle(async (req) => {
  const u = await user(req);
  if (!CAPS.probe.includes(u.role)) throw new HttpError(403, "Admins only.");
  return json({ providers: await probe() });
});

// ---------- auth ----------
export const authRegister = handle(async (req) => {
  const { user: u, cookie } = await register(req, await readJson(req));
  return json({ user: u }, 201, { "Set-Cookie": cookie });
});
export const authLogin = handle(async (req) => {
  const { user: u, cookie } = await login(req, await readJson(req));
  return json({ user: u }, 200, { "Set-Cookie": cookie });
});
export const authLogout = handle(async (req) => json({ ok: true }, 200, { "Set-Cookie": clearCookie(isSecure(req)) }));
export const authMe = handle(async (req) => json({ user: await getUser(req) }));

// ---------- generic CRUD ----------
export const dataList = handle(async (req, p) => {
  const u = await user(req);
  const sp = new URL(req.url).searchParams;
  const filters: Record<string, string> = {};
  sp.forEach((v, k) => { if (k.startsWith("f_")) filters[k.slice(2)] = v; });
  const r = await data.list(u, p.resource, {
    page: Number(sp.get("page")) || 1,
    pageSize: Number(sp.get("pageSize")) || 10,
    sort: sp.get("sort") ?? undefined,
    order: sp.get("order") ?? undefined,
    q: sp.get("q") ?? undefined,
    filters,
  });
  return json(r, 200, { "x-total-count": String(r.total) });
});
export const dataCreate = handle(async (req, p) => json({ data: await data.create(await user(req), p.resource, await readJson(req)) }, 201));
export const dataGet = handle(async (req, p) => json({ data: await data.getOne(await user(req), p.resource, p.id) }));
export const dataUpdate = handle(async (req, p) => json({ data: await data.update(await user(req), p.resource, p.id, await readJson(req)) }));
export const dataDelete = handle(async (req, p) => json(await data.remove(await user(req), p.resource, p.id)));

// ---------- knowledge ----------
export const knowledgeGet = handle(async (req) => {
  await user(req);
  const q = new URL(req.url).searchParams.get("q");
  return json(q ? { hits: await searchDocs(q, 5) } : { docs: await listDocs() });
});
export const knowledgeAdd = handle(async (req) => json({ doc: await addDoc(await user(req), await readJson(req, 64_000)) }, 201));
export const knowledgeDelete = handle(async (req, p) => json(await removeDoc(await user(req), p.id)));

// ---------- workflow rules ----------
export const rulesGet = handle(async (req) => { await user(req); return json({ rules: await listRules() }); });
export const rulesAdd = handle(async (req) => json({ rule: await addRule(await user(req), await readJson(req)) }, 201));
export const rulesDelete = handle(async (req, p) => json(await removeRule(await user(req), p.id)));
export const rulesRun = handle(async (req) => json(await runRules(await user(req))));

// ---------- audit ----------
export const auditGet = handle(async (req) => { await user(req); return json(await readAudit(200)); });

// ---------- setup ----------
export const seed = handle(async (req) => {
  const u = await user(req);
  const orders = await data.seedSample(u);
  const docs = await seedDocs(u);
  return json({ ...orders, docs });
});

// ---------- copilot ----------
export const copilot = handle(async (req) => {
  const u = await getUser(req);
  const body = await readJson<{ message?: unknown; history?: unknown; route?: unknown }>(req, 24_000);
  const history = Array.isArray(body.history)
    ? body.history.filter((h): h is { role: string; content: string } => !!h && typeof h.role === "string" && typeof h.content === "string")
    : [];
  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const emit = (e: CopilotEvent) => controller.enqueue(enc.encode(`event: ${e.type}\ndata: ${JSON.stringify(e)}\n\n`));
      try {
        await runCopilot({ user: u, ip: ipOf(req), message: typeof body.message === "string" ? body.message : "", history, route: clean(body.route, 120) }, emit);
      } catch (e) {
        const message = e instanceof HttpError ? e.message : "The assistant hit an unexpected error.";
        if (!(e instanceof HttpError)) console.error("[copilot]", e);
        emit({ type: "error", message });
      }
      controller.close();
    },
  });
  return new Response(stream, { headers: { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-store, no-transform", "X-Accel-Buffering": "no" } });
});

export const approval = handle(async (req, p) => {
  const u = await user(req);
  const b = await readJson<{ approved?: unknown }>(req);
  return json(await decideApproval(u, p.id, b.approved === true));
});

// ---------- public contact form ----------
export const contact = handle(async (req) => {
  const b = await readJson<Record<string, unknown>>(req, 8_000);
  if (typeof b.website === "string" && b.website.trim() !== "") return json({ ok: true }, 201); // honeypot: bots fill hidden fields
  await rateLimit(`contact:${ipOf(req)}`, 5, 3600);
  const name = clean(b.name, 80);
  const email = clean(b.email, 254).toLowerCase();
  const message = clean(b.message, 2000);
  if (!name) throw new HttpError(400, "Please enter your name.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) throw new HttpError(400, "Please enter a valid email.");
  if (message.length < 10) throw new HttpError(400, "Message should be at least 10 characters.");
  const store = getStore();
  const id = await store.incr("seq:messages");
  await store.hset("c:messages", String(id), JSON.stringify({ id, name, email, message, created_at: new Date().toISOString() }));
  await appendAudit({ actor: `visitor:${email}`, action: "messages.create", resource: "messages", target: String(id) });
  return json({ ok: true }, 201);
});
