import { hashPassword, signSession, uid, verifyPassword, verifySession } from "./crypto";
import { appendAudit } from "./audit";
import { env } from "./env";
import { clean, rateLimit } from "./guard";
import { HttpError, ipOf, isSecure } from "./http";
import { getStore } from "./store";
import type { Role } from "../lib/resources";

export type User = { id: string; email: string; role: Role; status: string; password_hash: string; created_at: string };
export type PublicUser = { id: string; email: string; role: Role; status: string; created_at: string };

export const COOKIE = "nexus_session";
const USERS = "c:users";
const EMAIL_IDX = "u:email";
const EMAIL_RX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export const publicUser = (u: User): PublicUser => ({ id: u.id, email: u.email, role: u.role, status: u.status, created_at: u.created_at });

export function sessionCookie(token: string, secure: boolean, maxAge = 7 * 24 * 3600) {
  return `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure ? "; Secure" : ""}`;
}
export const clearCookie = (secure: boolean) => sessionCookie("", secure, 0);

function readCookie(req: Request, name: string): string | undefined {
  for (const part of (req.headers.get("cookie") ?? "").split(";")) {
    const i = part.indexOf("=");
    if (i > 0 && part.slice(0, i).trim() === name) return part.slice(i + 1).trim();
  }
}

function normEmail(v: unknown): string {
  const e = clean(v, 254).toLowerCase();
  if (!EMAIL_RX.test(e)) throw new HttpError(400, "Enter a valid email address.");
  return e;
}
function checkPassword(v: unknown): string {
  if (typeof v !== "string" || v.length < 8) throw new HttpError(400, "Password must be at least 8 characters.");
  if (v.length > 128) throw new HttpError(400, "Password is too long.");
  return v;
}

export async function getUserById(id: string): Promise<User | null> {
  const raw = await getStore().hget(USERS, id);
  return raw ? (JSON.parse(raw) as User) : null;
}

export async function register(req: Request, body: { email?: unknown; password?: unknown }) {
  if (!env.allowSignup) throw new HttpError(403, "Sign-ups are closed.");
  await rateLimit(`reg:${ipOf(req)}`, 8, 3600);
  const email = normEmail(body.email);
  const password = checkPassword(body.password);
  const store = getStore();
  if (await store.hget(EMAIL_IDX, email)) throw new HttpError(409, "An account with this email already exists.");

  const count = Object.keys(await store.hgetall(USERS)).length;
  let role: Role = "viewer";
  if (env.adminEmail) role = email === env.adminEmail ? "admin" : "viewer";
  else if (count === 0) role = "admin"; // no ADMIN_EMAIL configured: first account claims admin
  const user: User = { id: uid(), email, role, status: "active", password_hash: await hashPassword(password), created_at: new Date().toISOString() };
  await store.hset(USERS, user.id, JSON.stringify(user));
  await store.hset(EMAIL_IDX, email, user.id);
  await appendAudit({ actor: email, action: "auth.register", resource: "users", target: user.id, after: { email, role } });
  return { user: publicUser(user), cookie: sessionCookie(signSession(user.id), isSecure(req)) };
}

const DUMMY_HASH = "scrypt$AAAAAAAAAAAAAAAAAAAAAA$" + "A".repeat(86);

export async function login(req: Request, body: { email?: unknown; password?: unknown }) {
  const ip = ipOf(req);
  await rateLimit(`login-ip:${ip}`, 20, 900);
  const email = normEmail(body.email);
  await rateLimit(`login-email:${email}`, 8, 900);
  const password = typeof body.password === "string" ? body.password.slice(0, 128) : "";
  const store = getStore();
  const id = await store.hget(EMAIL_IDX, email);
  const user = id ? await getUserById(id) : null;
  const ok = await verifyPassword(password, user?.password_hash ?? DUMMY_HASH); // same work whether or not the user exists
  if (!user || !ok) {
    await appendAudit({ actor: email, action: "auth.login_failed", resource: "users", note: `ip ${ip}` });
    throw new HttpError(401, "Invalid email or password.");
  }
  if (user.status !== "active") throw new HttpError(403, "This account is not active.");
  await appendAudit({ actor: email, action: "auth.login", resource: "users", target: user.id });
  return { user: publicUser(user), cookie: sessionCookie(signSession(user.id), isSecure(req)) };
}

/** Resolves the session cookie to a live, active user (role is always read fresh from the store). */
export async function getUser(req: Request): Promise<PublicUser | null> {
  const s = verifySession(readCookie(req, COOKIE));
  if (!s) return null;
  const u = await getUserById(s.sub);
  return u && u.status === "active" ? publicUser(u) : null;
}

export async function requireUser(req: Request): Promise<PublicUser> {
  const u = await getUser(req);
  if (!u) throw new HttpError(401, "Please sign in.");
  return u;
}
