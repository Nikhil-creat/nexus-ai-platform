import { env } from "./env";
import { HttpError } from "./http";

export type ToolCall = { id: string; type: "function"; function: { name: string; arguments: string } };
export type ChatMsg = { role: "system" | "user" | "assistant" | "tool"; content: string | null; tool_calls?: ToolCall[]; tool_call_id?: string };
export type ToolDef = { type: "function"; function: { name: string; description: string; parameters: Record<string, unknown> } };

type Provider = { name: string; base: string; key: string; model: string; price: [number, number] }; // USD per 1M tokens (in, out): estimates

export function providers(): Provider[] {
  const all: Provider[] = [];
  if (env.groqKey) all.push({ name: "groq", base: "https://api.groq.com/openai/v1", key: env.groqKey, model: env.groqModel, price: [0.59, 0.79] });
  if (env.geminiKey) all.push({ name: "gemini", base: "https://generativelanguage.googleapis.com/v1beta/openai", key: env.geminiKey, model: env.geminiModel, price: [0.3, 2.5] });
  if (env.customBase && env.customKey && env.customModel) all.push({ name: "custom", base: env.customBase.replace(/\/$/, ""), key: env.customKey, model: env.customModel, price: [0, 0] });
  const pref = all.findIndex((p) => p.name === env.preferred);
  return pref > 0 ? [all[pref], ...all.filter((_, i) => i !== pref)] : all;
}

export type LlmResult = { message: ChatMsg; provider: string; model: string; usage: { prompt: number; completion: number }; costUsd: number };

export async function chat(opts: { messages: ChatMsg[]; tools?: ToolDef[]; maxTokens?: number; timeoutMs?: number }): Promise<LlmResult> {
  const list = providers();
  if (list.length === 0) throw new HttpError(503, "No AI provider is configured. Add GROQ_API_KEY or GEMINI_API_KEY in the environment.");
  const failures: string[] = [];
  for (const p of list) {
    try {
      const res = await fetch(`${p.base}/chat/completions`, {
        method: "POST",
        headers: { Authorization: `Bearer ${p.key}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: p.model,
          messages: opts.messages,
          ...(opts.tools?.length ? { tools: opts.tools, tool_choice: "auto" } : {}),
          max_tokens: opts.maxTokens ?? 700,
          temperature: 0.3,
        }),
        signal: AbortSignal.timeout(opts.timeoutMs ?? 25_000),
        cache: "no-store",
      });
      if (!res.ok) {
        const t = (await res.text().catch(() => "")).replace(/\s+/g, " ").slice(0, 160);
        failures.push(`${p.name} (${p.model}): HTTP ${res.status} ${t}`);
        continue;
      }
      const body = (await res.json()) as {
        choices?: { message?: { content?: string | null; tool_calls?: ToolCall[] } }[];
        usage?: { prompt_tokens?: number; completion_tokens?: number };
      };
      const m = body.choices?.[0]?.message;
      if (!m) { failures.push(`${p.name}: empty response`); continue; }
      const usage = { prompt: body.usage?.prompt_tokens ?? 0, completion: body.usage?.completion_tokens ?? 0 };
      return {
        message: { role: "assistant", content: m.content ?? null, ...(m.tool_calls?.length ? { tool_calls: m.tool_calls } : {}) },
        provider: p.name, model: p.model, usage,
        costUsd: (usage.prompt * p.price[0] + usage.completion * p.price[1]) / 1e6,
      };
    } catch (e) {
      failures.push(`${p.name}: ${e instanceof Error ? e.name : "error"}`);
    }
  }
  throw new HttpError(502, "No AI provider could answer right now.", { providers: failures });
}

/** 1-token health check per configured provider (used by Settings → "Test AI providers"). */
export async function probe(): Promise<{ name: string; model: string; ok: boolean; detail: string }[]> {
  const out = [];
  for (const p of providers()) {
    try {
      const res = await fetch(`${p.base}/chat/completions`, {
        method: "POST",
        headers: { Authorization: `Bearer ${p.key}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: p.model, messages: [{ role: "user", content: "Reply with: ok" }], max_tokens: 5 }),
        signal: AbortSignal.timeout(15_000),
        cache: "no-store",
      });
      const t = res.ok ? "reachable" : (await res.text().catch(() => "")).replace(/\s+/g, " ").slice(0, 160);
      out.push({ name: p.name, model: p.model, ok: res.ok, detail: res.ok ? t : `HTTP ${res.status} ${t}` });
    } catch (e) {
      out.push({ name: p.name, model: p.model, ok: false, detail: e instanceof Error ? e.name : "error" });
    }
  }
  return out;
}
