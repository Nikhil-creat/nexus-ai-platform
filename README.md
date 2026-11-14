<div align="center">

# NEXUS · Refine-Nexus AI

**Autonomous admin-panel generator and intelligent operations OS.**
Feed it an API spec, a JSON sample or a CSV. Get a typed, secure admin panel with an agentic copilot that asks before it acts.

[![CI](https://github.com/Nikhil-creat/nexus-ai-platform/actions/workflows/ci.yml/badge.svg)](https://github.com/Nikhil-creat/nexus-ai-platform/actions/workflows/ci.yml)
![License](https://img.shields.io/badge/license-MIT-white)
![Next.js](https://img.shields.io/badge/Next.js-15-black?logo=nextdotjs)
![React](https://img.shields.io/badge/React-19-149eca?logo=react&logoColor=white)
![Refine](https://img.shields.io/badge/Refine-4-3ecf8e)
![FastAPI](https://img.shields.io/badge/FastAPI-async-009688?logo=fastapi&logoColor=white)
![LangGraph](https://img.shields.io/badge/LangGraph-agents-1c3c3c)
![PyTorch](https://img.shields.io/badge/PyTorch-CNN-ee4c2c?logo=pytorch&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-compose-2496ed?logo=docker&logoColor=white)

[Live demo](#live-demo) · [Features](#features) · [Architecture](#architecture) · [Quick start](#quick-start) · [Security](#security-model) · [Roadmap](#roadmap)

</div>

---

## Why this exists

Every internal tool starts the same way: someone hand-builds tables, forms, permissions and audit logs on top of an API. NEXUS automates that. It infers schemas and relations, scaffolds a Refine admin, and layers on the parts teams usually bolt on later: role-based access, human approval for risky actions, hybrid retrieval over your own documents, document vision, cost tracking and a tamper-evident audit trail.

## Live site (real accounts, real backend)

The `frontend/` app is a complete product on its own: Next.js route handlers are the backend, so one Vercel project gives you the site, the API, authentication, a database and the AI Copilot. Nothing is mocked.

| Step | Where | What to try |
|---|---|---|
| 1 | `/login` | Create an account. The email set in `ADMIN_EMAIL` becomes admin (if unset, the first account does) |
| 2 | Admin → Settings | Check system status, press **Test AI providers**, then **Load sample data** |
| 3 | Orders / Users | Create, edit, delete, sort, search, paginate, export CSV. Roles are enforced on the server |
| 4 | Knowledge | Add a document, then search it (BM25 + vectors fused with RRF) |
| 5 | Workflows | Add a rule such as `total > 1000 → flag for review` and press **Run now** |
| 6 | Audit trail | Every change appears with before/after state; the SHA-256 chain is re-verified on load |
| 7 | Copilot (bottom right) | Ask "which orders are pending?". Ask it to change something and approve or reject the proposal |
| 8 | Landing page | Contact form (stored server-side), credentials section, `/privacy`, `/terms` |

## Features

| Area | What it does |
|---|---|
| **Schema auto-detection** | Parses OpenAPI 3.x, JSON and CSV. Detects keys, relations, enums, nullable fields and semantic widgets (`avatar_url` is an image, `status` is a badge, `created_at` is a datetime). Emits Refine resources and Zod schemas. |
| **Multi-agent engine** | LangGraph supervisor with architect and codegen agents, a Docker sandbox that runs `tsc` and retries up to three times, then a human approval gate before anything destructive. |
| **Hybrid RAG** | Dense vectors (pgvector) plus keyword search (full-text and trigram), fused with Reciprocal Rank Fusion and reranked by a cross-encoder. The browser demo uses BM25 plus hashed vectors with the same fusion. |
| **CNN vision** | PyTorch classifier for invoices, IDs and shipping labels, OpenCV preprocessing, OCR field extraction, and a 1D convolution spike detector for metrics. |
| **Nexus Copilot** | Context-aware drawer (route, record, role), streaming answers over SSE, voice input, PII masking, prompt-injection screening. DELETE, UPDATE, migrations and webhooks always wait for approval. |
| **Access control** | Role matrix (admin, editor, viewer) enforced in FastAPI and in Refine's `accessControlProvider`. Attribute rules for tenant and owner. |
| **Audit trail** | Append-only log where each entry stores the SHA-256 of the previous one. Editing history breaks the chain at that entry. Database triggers block UPDATE and DELETE. |
| **FinOps** | Token, cost and cache-hit tracking per user, with semantic caching to avoid repeat spend. |
| **Workflows** | Condition-and-action rules evaluated against live data. |
| **Dashboard** | KPI tiles and bar charts (orders by status, users by role, token usage, order value), plus live tab presence. |
| **Platform polish** | Command palette, theme studio, installable PWA with offline cache, social preview image, security headers, `robots.txt`, sitemap, 404 page, CSV and JSON export. |

### Two tiers

| Capability | Vercel tier (`frontend/`, no Docker) | Docker enterprise tier |
|---|---|---|
| Auth | Email + password (scrypt), signed HttpOnly cookie, rate limits, CSRF origin check | JWT, role matrix, tenant rules |
| Data | Orders, users, messages, usage in Upstash Redis (memory fallback) | PostgreSQL 16 + pgvector |
| Copilot | Groq or Gemini with tool calls, PII masking, approval gate | LiteLLM, LangGraph supervisor |
| Knowledge | BM25 + hashed vectors, RRF | pgvector + cross-encoder reranker |
| Audit trail | Hash chain in the store | Postgres `audit_log` with immutability triggers |
| Document vision (CNN) | Not included | CNN service |

## Quick start

### Frontend (site + API)

```bash
cd frontend
cp .env.example .env.local   # then edit: SESSION_SECRET, ADMIN_EMAIL, GROQ_API_KEY or GEMINI_API_KEY
npm install
npm run dev                  # http://localhost:3000
```

Without Upstash variables the data lives in server memory and resets on restart. The Settings page tells you which of these are missing.

### Full stack with Docker

```bash
cp .env.example .env
# edit .env: POSTGRES_PASSWORD, JWT_SECRET (openssl rand -hex 32), MINIO_ROOT_PASSWORD, DEMO_ADMIN_PASSWORD
docker compose up --build -d
docker compose ps
```

App at http://localhost, API docs at http://localhost/api/docs, MinIO console at http://127.0.0.1:9001.

Try the schema API:

```bash
TOKEN=$(curl -s localhost/api/auth/login -H 'content-type: application/json' \
  -d '{"email":"admin@nexus.dev","password":"<DEMO_ADMIN_PASSWORD>"}' | python3 -c 'import sys,json;print(json.load(sys.stdin)["access_token"])')
curl -s localhost/api/schema/inspect -H "authorization: Bearer $TOKEN" \
  -d '{"id":1,"email":"a@b.com","status":"active","avatar_url":"https://x/y.png"}'
```

### Run the tests

```bash
# frontend logic (Node 22): schema inspector and hybrid search
cd frontend && npm test

# backend: audit chain, PII masking, SQL and prompt guards, RBAC
pip install fastapi pyjwt pyyaml pytest
cd backend && python -m pytest -q tests
```

## Configuration

**Frontend / Vercel (the site and its API)**

| Variable | Required | Purpose |
|---|---|---|
| `SESSION_SECRET` | yes | Signs session cookies. Generate with `openssl rand -hex 32` |
| `ADMIN_EMAIL` | recommended | This email becomes admin when it registers |
| `ALLOW_SIGNUP` | no | Set `false` after creating your account to close public sign-up |
| `GROQ_API_KEY` / `GEMINI_API_KEY` | one of them | Server-side keys for the Copilot. Never prefix with `NEXT_PUBLIC_` |
| `GROQ_MODEL`, `GEMINI_MODEL`, `LLM_PROVIDER` | no | Override models or force a provider |
| `LLM_BASE_URL`, `LLM_API_KEY`, `LLM_MODEL` | no | Any OpenAI-compatible endpoint |
| `UPSTASH_REDIS_REST_URL` / `_TOKEN` (or `KV_REST_API_URL` / `_TOKEN`) | for persistence | Added automatically when you attach Upstash Redis in Vercel → Storage |
| `NEXT_PUBLIC_SITE_URL` | no | Public URL for the sitemap |

**Docker tier (`.env`)**

| Variable | Purpose |
|---|---|
| `POSTGRES_PASSWORD`, `JWT_SECRET`, `MINIO_ROOT_USER`, `MINIO_ROOT_PASSWORD` | Secrets. Change all of them |
| `DEMO_ADMIN_PASSWORD` | Password for the demo login endpoint |
| `LITELLM_MODEL`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY` | Optional LLM settings |
| `ALLOWED_ORIGINS` | CORS origins |

## API reference

Frontend routes (all under `/api`, JSON, same-origin):

| Method | Path | Access | Purpose |
|---|---|---|---|
| GET | `/health` | public | Storage, secret and provider status |
| GET | `/health/ai` | admin | Live test call to each LLM provider |
| POST | `/auth/register`, `/auth/login`, `/auth/logout` | public | Session management |
| GET | `/auth/me` | public | Current user or `null` |
| GET, POST | `/data/{resource}` | by role | List (search, sort, paginate) and create |
| GET, PATCH, DELETE | `/data/{resource}/{id}` | by role | Read, update, delete |
| GET, POST, DELETE | `/knowledge`, `/knowledge/{id}` | signed in; write admin/editor | Documents and hybrid search (`?q=`) |
| GET, POST, DELETE | `/rules`, `/rules/{id}`; POST `/rules/run` | admin/editor to change | Workflow rules |
| GET | `/audit` | signed in | Entries plus chain verification |
| POST | `/seed` | admin | Load sample data |
| POST | `/copilot` | public (guest) / signed in | SSE stream: `meta, guard, tool, approval, token, error, done` |
| POST | `/approvals/{id}` | signed in | Approve or reject a proposed action (single use, RBAC re-checked) |
| POST | `/contact` | public | Contact form (honeypot + rate limit) |

Docker tier: `/health`, `/auth/login`, `/schema/inspect`, `/copilot/stream`, `/copilot/approve/{id}`, `/documents/extract`, `/finops/summary`, `/audit` (see `/api/docs`).

## Security model

- **Authentication and authorization:** JWT, role matrix, tenant and owner attribute checks. The server is the source of truth; the UI only mirrors it.
- **Human in the loop:** delete, update, migrate, webhook and bulk update need explicit approval, recorded in the audit chain.
- **Data protection:** emails, phone numbers, card numbers and Aadhaar-style IDs are masked before text reaches an external model.
- **Prompt safety:** injection heuristics reject known override patterns. The analyst SQL guard allows a single read-only SELECT.
- **Isolation:** generated code runs with no network, a read-only filesystem and capped CPU, memory and processes. Postgres row-level security isolates tenants.
- **Containers:** non-root users, dropped capabilities, `no-new-privileges`, nginx rate limiting and security headers.
- **Tamper evidence:** hash-chained audit entries and database triggers that refuse updates and deletes.

Report vulnerabilities as described in [SECURITY.md](SECURITY.md).

## Known limitations

Be honest about what this is: a strong portfolio-grade product, not a finished SaaS.

- Email + password only. No email verification, password reset, MFA or SSO yet (OIDC and passkeys are on the roadmap).
- Without Upstash Redis the store is in memory and resets on cold starts. The Settings page flags this.
- Redis is not a relational database: there are no transactions across records, and listing loads and filters in the function.
- The Copilot depends on third-party LLM free tiers, which can rate-limit or change model names. Use **Test AI providers** and the `*_MODEL` overrides.
- The CNN service ships without trained weights (Docker tier only) and routes results to human review.
- Do not store confidential or regulated data. See `/privacy` and `/terms`.

## Push to GitHub from your phone (Termux)

```bash
pkg update -y && pkg upgrade -y
pkg install -y git gh unzip
termux-setup-storage
cd ~ && unzip ~/storage/downloads/refine-nexus-ai.zip && cd refine-nexus-ai
git config --global user.name  "Your Name"
git config --global user.email "you@example.com"
gh auth login && gh auth setup-git
git init -b main && git add . && git status
git commit -m "Initial commit"
gh repo create nexus-ai-platform --public --source=. --remote=origin --push
```

Later changes: `git add . && git commit -m "message" && git push`.

## Deploy on Vercel

1. vercel.com → **Add New → Project** → import this repo → **Root Directory** `frontend`, framework **Next.js**.
2. Environment variables: `SESSION_SECRET`, `ADMIN_EMAIL`, `GROQ_API_KEY` and/or `GEMINI_API_KEY`.
3. **Storage** tab → create **Upstash Redis** and connect it to the project (adds the REST variables for you).
4. Redeploy, open `/login`, register with `ADMIN_EMAIL`, then set `ALLOW_SIGNUP=false` and redeploy.
5. Admin → Settings should show every check green.

The Docker tier is optional and runs on any VPS with `docker compose`.

## Roadmap

- [x] Schema auto-detection, Refine admin, RBAC
- [x] Hybrid RAG, audit chain, workflows, copilot with approval gate
- [x] Docker stack, CI, unit tests (Node and pytest)
- [x] Dashboard charts and same-browser tab presence
- [ ] Persist audit, approvals and cache in Postgres and Redis
- [ ] OIDC sign-in (Google, GitHub) and WebAuthn passkeys
- [ ] Per-record presence and optimistic locking over WebSockets (tab presence already works in the browser)
- [ ] Trained CNN weights and an evaluation report
- [ ] Postgres and MySQL live introspection for schema detection
- [ ] Visual workflow canvas and signed webhooks
- [ ] OpenTelemetry, Prometheus and Grafana dashboards
- [ ] Playwright end-to-end tests

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Issues and pull requests are welcome.

## Author

**Nikhil Chary Sriramoju**, final-year B.Tech CSE student at Vaagdevi College of Engineering, Warangal.
[GitHub](https://github.com/Nikhil-creat) · [LinkedIn](https://in.linkedin.com/in/nikhil-chary-sriramoju-95041b38a)

## License

[MIT](LICENSE)
