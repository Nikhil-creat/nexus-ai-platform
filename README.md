# Refine-Nexus AI

Autonomous admin-panel generator and intelligent operations OS. Ingest an OpenAPI spec, JSON or CSV and get typed Refine resources, a human-gated agentic copilot, hybrid RAG, CNN document intelligence, FinOps telemetry and a tamper-evident audit trail.

```
frontend/      Next.js 15 + React 19 + Refine (ECHOID-style UI, Copilot drawer, Cmd+K, admin demo)
backend/       FastAPI: schema_inspector, security, audit chain, hybrid RAG, SSE copilot, Celery worker
ai_workers/    LangGraph supervisor: architect -> codegen -> sandboxed tsc -> HITL gate -> executor
cnn_service/   PyTorch + OpenCV document classifier / field extractor / 1D-CNN anomaly detector
infra/         nginx.conf, init.sql (pgvector, pg_trgm, RLS, append-only audit)
```

## Features

| Area | What works today |
|---|---|
| Landing + auth | ECHOID-style hero, responsive menu, login page, protected `/admin` |
| Admin (Refine) | Users, Orders, LLM FinOps with sort, filter, delete, CSV export; role-based UI (admin / editor / viewer) |
| Schema Studio | Paste OpenAPI JSON, JSON or CSV in the browser, get field widgets, relations, Zod and Refine JSON downloads |
| Knowledge (RAG) | BM25 + vector similarity fused with RRF, add or upload your own docs (stored in your browser) |
| Audit trail | SHA-256 hash chain with live verify, tamper test and export |
| Workflows | Rule builder (condition -> action) evaluated against live Orders |
| Copilot | Streaming drawer, context-aware, PII masking, human approval for destructive actions, voice input |
| Platform | Cmd/Ctrl+K palette, theme studio, PWA offline cache, robots + sitemap, 404 page, security headers |
| Backend (Docker) | FastAPI, LangGraph supervisor with sandboxed self-healing, pgvector hybrid RAG, CNN document service, Celery, Postgres RLS, MinIO, nginx |
| Quality | Pytest suite, GitHub Actions CI (typecheck, build, tests, compose validation), MIT licence |

## 1. Run the frontend only (fastest)

```bash
cd frontend
npm install
npm run dev          # http://localhost:3000
```
Without a backend URL the Copilot and admin run in demo mode (in-memory data, local approval gate).

## 2. Run the full stack (Docker)

```bash
cp .env.example .env
# edit .env: set POSTGRES_PASSWORD, JWT_SECRET (openssl rand -hex 32), MINIO_ROOT_PASSWORD, DEMO_ADMIN_PASSWORD
docker compose up --build -d
docker compose ps
```
- App: http://localhost  · API docs: http://localhost/api/docs · MinIO console: http://127.0.0.1:9001
- Database schema and extensions are created by `infra/init.sql` on first start.

Try the schema inspector:
```bash
TOKEN=$(curl -s localhost/api/auth/login -H 'content-type: application/json' \
  -d '{"email":"admin@nexus.dev","password":"<DEMO_ADMIN_PASSWORD>"}' | python3 -c 'import sys,json;print(json.load(sys.stdin)["access_token"])')
curl -s localhost/api/schema/inspect -H "authorization: Bearer $TOKEN" \
  -d '{"id":1,"email":"a@b.com","status":"active","avatar_url":"https://x/y.png","created_at":"2026-01-01T00:00:00Z"}'
```

## 3. Push to GitHub from your phone (Termux)

Install Termux from **F-Droid** (the Play Store build is outdated). Save `refine-nexus-ai.zip` to your phone's Downloads, then:

```bash
pkg update -y && pkg upgrade -y
pkg install -y git gh unzip
termux-setup-storage                 # tap Allow on the permission prompt
cd ~
unzip ~/storage/downloads/refine-nexus-ai.zip
cd refine-nexus-ai

git config --global user.name  "Nikhil Chary Sriramoju"
git config --global user.email "sriramojunikhil66@gmail.com"   # use the email verified on GitHub

gh auth login        # GitHub.com -> HTTPS -> Yes (auth git) -> Login with a web browser
                     # copy the one-time code, open the link, paste it, approve
gh auth setup-git

git init -b main
git add .
git status           # make sure .env is NOT listed
git commit -m "Initial commit: Refine-Nexus AI"
gh repo create refine-nexus-ai --public --source=. --remote=origin --push
```
Done: your repo is at `https://github.com/Nikhil-creat/refine-nexus-ai`.

Later changes:
```bash
git add . && git commit -m "describe the change" && git push
```
If the push asks for a password, run `gh auth setup-git` again (GitHub no longer accepts account passwords).

Skip `npm run dev` on the phone: Next.js native builds are unreliable on Android. Let Vercel build it.

## 4. Deploy the frontend on Vercel

Easiest on mobile (browser, no CLI): open vercel.com in Chrome, enable **Desktop site** from the menu, then:

1. **Continue with GitHub**, approve access to `refine-nexus-ai`.
2. **Add New -> Project**, pick the repo, **Import**.
3. **Root Directory -> Edit -> `frontend`** (important: monorepo). Framework: Next.js (auto).
4. Leave environment variables empty for the demo, **Deploy**. After ~1-2 minutes you get `https://refine-nexus-ai-xxxx.vercel.app`.
5. Every `git push` to `main` redeploys automatically.

Optional CLI from Termux: `pkg install nodejs && npm i -g vercel`, then `cd frontend && vercel login && vercel --prod` (answer the prompts with defaults).

Optional environment variables: `NEXT_PUBLIC_API_URL` (deployed FastAPI URL), `NEXT_PUBLIC_REST_URL`, `NEXT_PUBLIC_SITE_URL` (your Vercel URL, for sitemap).

Vercel hosts only the frontend. Python services need a container host (Render, Railway, Fly.io or a VPS with `docker compose`); set `ALLOWED_ORIGINS` there to your Vercel URL.

## Security notes and limits

- JWT + RBAC/ABAC, PII masking, injection screening, read-only SQL guard, Redis rate limiting, non-root containers with dropped capabilities, Postgres RLS, append-only hash-chained audit.
- Not production-ready as shipped: demo login, in-memory audit chain / pending approvals / semantic cache (persist them to Postgres/Redis), untrained CNN (flagged `model_trained:false`), `sessionStorage` token (use httpOnly cookies + OIDC for real deployments), LLM keys optional.
- Never commit `.env`. Rotate any secret that was ever pushed.
- Uploads: PNG/JPEG only, 10 MB. Prompts: 4,000 characters.
