import { createHash, createHmac, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { env } from "./env";
import { HttpError } from "./http";

const b64u = (b: Buffer | string) => Buffer.from(b).toString("base64url");
const fromB64u = (s: string) => Buffer.from(s, "base64url");

function secret(): string {
  const s = env.sessionSecret;
  if (s.length < 16) {
    throw new HttpError(500, "Server is not configured: set SESSION_SECRET (16+ random characters) in the environment.");
  }
  return s;
}

/** Signed, expiring session token: base64url(payload).base64url(hmac). Carries no role: roles are read from the store. */
export function signSession(sub: string, ttlSeconds = 7 * 24 * 3600, now = Date.now()): string {
  const payload = b64u(JSON.stringify({ sub, exp: Math.floor(now / 1000) + ttlSeconds }));
  const sig = createHmac("sha256", secret()).update(payload).digest();
  return `${payload}.${b64u(sig)}`;
}

export function verifySession(token: string | undefined, now = Date.now()): { sub: string } | null {
  if (!token) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  const expected = createHmac("sha256", secret()).update(payload).digest();
  const given = fromB64u(sig);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  try {
    const p = JSON.parse(fromB64u(payload).toString());
    if (typeof p.sub !== "string" || typeof p.exp !== "number" || p.exp * 1000 < now) return null;
    return { sub: p.sub };
  } catch {
    return null;
  }
}

const scryptAsync = (pw: string, salt: Buffer) =>
  new Promise<Buffer>((res, rej) => scrypt(pw, salt, 64, { N: 16384, r: 8, p: 1 }, (e, k) => (e ? rej(e) : res(k))));

export async function hashPassword(pw: string): Promise<string> {
  const salt = randomBytes(16);
  return `scrypt$${b64u(salt)}$${b64u(await scryptAsync(pw, salt))}`;
}

export async function verifyPassword(pw: string, stored: string): Promise<boolean> {
  const [alg, salt, hash] = stored.split("$");
  if (alg !== "scrypt" || !salt || !hash) return false;
  const k = await scryptAsync(pw, fromB64u(salt));
  const h = fromB64u(hash);
  return k.length === h.length && timingSafeEqual(k, h);
}

export const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");
export const uid = () => b64u(randomBytes(12));
