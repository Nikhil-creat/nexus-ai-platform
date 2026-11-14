// Central place for configuration so tests can override via process.env.
export const env = {
  get sessionSecret() { return process.env.SESSION_SECRET ?? ""; },
  get adminEmail() { return (process.env.ADMIN_EMAIL ?? "").trim().toLowerCase(); },
  get allowSignup() { return (process.env.ALLOW_SIGNUP ?? "true").toLowerCase() !== "false"; },
  get groqKey() { return process.env.GROQ_API_KEY ?? ""; },
  get geminiKey() { return process.env.GEMINI_API_KEY ?? ""; },
  get groqModel() { return process.env.GROQ_MODEL || "llama-3.3-70b-versatile"; },
  get geminiModel() { return process.env.GEMINI_MODEL || "gemini-2.5-flash"; },
  get customBase() { return process.env.LLM_BASE_URL ?? ""; },
  get customKey() { return process.env.LLM_API_KEY ?? ""; },
  get customModel() { return process.env.LLM_MODEL ?? ""; },
  get preferred() { return (process.env.LLM_PROVIDER ?? "").toLowerCase(); },
  get upstashUrl() { return process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL || ""; },
  get upstashToken() { return process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN || ""; },
  get production() { return process.env.NODE_ENV === "production"; },
};
