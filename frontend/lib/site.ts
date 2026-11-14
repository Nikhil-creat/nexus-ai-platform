// Single source of truth for the landing page: edit this file to update your credentials.
export const MEDIA = {
  video:
    "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260806_133255_956f653f-5d80-4b06-abd5-0f46c98b60fa.mp4",
  poster:
    "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260806_132328_5f9029c8-218f-4489-82b6-29ff2849920e.png",
};

export const OWNER = {
  name: "Nikhil Chary Sriramoju",
  role: "Final-year B.Tech CSE · AI / Data Engineer",
  college: "Vaagdevi College of Engineering · 2023–2027",
  location: "Warangal, Telangana, India",
  github: "https://github.com/Nikhil-creat",
  linkedin: "https://in.linkedin.com/in/nikhil-chary-sriramoju-95041b38a",
  email: "sriramojunikhil66@gmail.com",
  skills: ["Python", "pandas", "SQL", "Power BI", "Excel", "Django", "React", "Next.js", "FastAPI", "ML / DL", "RAG", "LangGraph", "Docker"],
  stats: [
    { k: "100+", v: "Certificates" },
    { k: "5+", v: "Internships & simulations" },
    { k: "10+", v: "AI / ML projects" },
  ],
};

export const NAV = [
  { label: "Platform", href: "#platform" },
  { label: "Security", href: "#security" },
  { label: "Builder", href: "#builder" },
  { label: "Credentials", href: "#credentials" },
  { label: "Contact", href: "#contact" },
];

export const CAPABILITIES = [
  ["01", "Schema Auto-Detection", "OpenAPI, JSON or CSV in — typed Refine resources, Zod schemas and semantic field widgets out."],
  ["02", "Multi-Agent Engine", "LangGraph supervisor with architect, codegen and a self-healing Docker QA sandbox."],
  ["03", "Hybrid RAG", "pgvector + full-text search fused with RRF and reranked by a cross-encoder."],
  ["04", "CNN Vision", "PyTorch document classifier, OCR field extraction and 1D-CNN anomaly detection."],
  ["05", "Nexus Copilot", "Context-aware streaming assistant that acts on records behind a human approval gate."],
  ["06", "FinOps Telemetry", "Token, cost and cache-hit tracking per user with Redis semantic caching."],
];

export const SECURITY = [
  ["Zero-trust auth", "JWT + RBAC/ABAC enforced in FastAPI and Refine's accessControlProvider."],
  ["Human-in-the-loop", "DELETE, UPDATE, migrations and webhooks never run without explicit approval."],
  ["PII masking", "Emails, phones, card and ID numbers redacted before any external LLM call."],
  ["Injection guard", "Prompt-injection heuristics screen every message before it reaches a model."],
  ["Hash-chained audit", "Append-only SHA-256 chain: actor, before/after state and prompt trace."],
  ["Tenant isolation", "PostgreSQL row-level security plus read-only SQL guard for the analyst agent."],
  ["Sandboxed code", "Generated code runs with no network, read-only fs, capped CPU/memory."],
  ["Hardened containers", "Non-root users, dropped capabilities, no-new-privileges, nginx rate limits."],
];

export const LIMITS = [
  "Demo credentials and in-memory audit chain are for local use — persist to audit_log and enable OIDC before production.",
  "CNN ships untrained: responses are flagged model_trained:false and routed to human review until you add weights.",
  "LLM features fall back to offline demo mode when no API key is set.",
  "Max upload 10 MB, 60 requests/min per IP, 4,000-character prompts.",
];

export const PROJECTS = [
  ["AgentShield-X", "Zero-trust AI security engine with guardrails, sandbox and Merkle audit ledger."],
  ["NeuroScan AI", "Explainable deep-learning + RAG decision support for brain MRI diagnosis."],
  ["Omni-Cloud Sentinel", "Multi-agent cloud ops: FinOps, DevSecOps, incident copilot, self-healing K8s."],
  ["TrustGuard AI", "KYC verification, fraud detection and risk prioritisation with MLOps."],
  ["ChurnScope", "End-to-end churn prediction pipeline with evaluation and reporting."],
  ["Carrom AI Platform", "Multiplayer physics game with agentic AI, RAG, CNN and RL."],
];

export const CREDENTIALS = {
  education: [
    { title: "B.Tech, Computer Science & Engineering", org: "Vaagdevi College of Engineering", period: "2023 – 2027" },
  ],
  experience: [
    { title: "Machine Learning Engineer Intern", org: "Yuva Intern (NSDC)", note: "6-week program with weekly submitted tasks, starting with an ML pipeline project plan" },
    { title: "Virtual experience programs", org: "Forage", note: "Job simulations across consulting, cybersecurity, data and software engineering" },
  ],
  certificateCount: "100+",
  certificateAreas: ["Cloud & cybersecurity", "Data, AI & emerging tech", "Automation & robotics", "Software & systems engineering", "Consulting & business simulations"],
  certificateIssuers: ["Skill India / NASSCOM", "IBM SkillsBuild", "UiPath", "Reliance Foundation", "Forage", "Deloitte", "TATA", "BCG Platinion", "Skyscanner", "Vista", "AIG", "EAB", "LifeArc", "British Airways", "Morrison Foerster", "Ashurst Perkins Coie"],
};
