import { HttpError } from "./http";
import { getStore } from "./store";

/** Reversible PII pseudonymisation: the LLM sees <EMAIL_1>, we restore real values in tool arguments and answers. */
const PATTERNS: [string, RegExp][] = [
  ["EMAIL", /[\w.+-]+@[\w-]+\.[\w.-]+/g],
  ["AADHAAR", /\b\d{4}\s\d{4}\s\d{4}\b/g],
  ["CARD", /\b(?:\d[ -]?){13,16}\b/g],
  ["SSN", /\b\d{3}-\d{2}-\d{4}\b/g],
  ["PHONE", /(?<!\d)(?:\+?\d{1,3}[\s-]?)?\d{10}(?!\d)/g],
];

export class Pseudonymizer {
  private toToken = new Map<string, string>();
  private toValue = new Map<string, string>();
  private counts: Record<string, number> = {};
  readonly masked: Record<string, number> = {};

  mask(text: string): string {
    let out = text;
    for (const [label, rx] of PATTERNS) {
      out = out.replace(rx, (m) => {
        let t = this.toToken.get(m);
        if (!t) {
          this.counts[label] = (this.counts[label] ?? 0) + 1;
          t = `<${label}_${this.counts[label]}>`;
          this.toToken.set(m, t);
          this.toValue.set(t, m);
        }
        this.masked[label] = (this.masked[label] ?? 0) + 1;
        return t;
      });
    }
    return out;
  }

  unmask(text: string): string {
    return text.replace(/<([A-Z]+_\d+)>/g, (t) => this.toValue.get(t) ?? t);
  }
}

const INJECTION = new RegExp(
  [
    "ignore (all |any |the )?(previous|prior|above|earlier) (instructions|prompts|rules)",
    "disregard (the |your )?(system|developer|previous) (prompt|message|instructions)",
    "you are now (dan|in developer mode|unrestricted|jailbroken)",
    "(reveal|show|print|repeat) (me )?(your |the )?(system|hidden|initial) (prompt|instructions)",
    "pretend (that )?you have no (rules|restrictions|guidelines)",
  ].join("|"),
  "i"
);

export function screenPrompt(text: string) {
  if (INJECTION.test(text)) throw new HttpError(400, "Message blocked by the prompt-injection guard.");
}

/** Fixed-window rate limit backed by the store. Throws 429 with Retry-After information. */
export async function rateLimit(key: string, limit: number, windowSeconds: number) {
  const store = getStore();
  const slot = Math.floor(Date.now() / (windowSeconds * 1000));
  const k = `rl:${key}:${slot}`;
  const n = await store.incr(k);
  if (n === 1) await store.expire(k, windowSeconds + 5);
  if (n > limit) throw new HttpError(429, "Too many requests. Please slow down and try again shortly.");
}

/** Strips control characters and trims; keeps newlines and tabs. */
export function clean(s: unknown, max: number): string {
  if (typeof s !== "string") return "";
  // eslint-disable-next-line no-control-regex
  return s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim().slice(0, max);
}
