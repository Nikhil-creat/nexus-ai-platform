"""Refine-Nexus AI — FastAPI entrypoint."""
from __future__ import annotations

import asyncio
import json
import os
import sys
import time
from collections import defaultdict
from contextlib import asynccontextmanager

import httpx
from fastapi import Depends, FastAPI, File, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from .audit import AuditChain
from .schema_inspector import from_openapi, from_sample
from .security import (DESTRUCTIVE, Principal, current_user, issue_token, mask_pii, rate_limit, require,
                       screen_prompt)

sys.path.append(os.path.join(os.path.dirname(__file__), "..", ".."))

audit = AuditChain()
pending_actions: dict[str, dict] = {}
telemetry = defaultdict(lambda: {"requests": 0, "tokens": 0, "cost_usd": 0.0, "cache_hits": 0})
semantic_cache: dict[str, str] = {}


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.redis = None
    try:
        import redis.asyncio as aioredis

        r = aioredis.from_url(os.environ.get("REDIS_URL", "redis://redis:6379/0"))
        await r.ping()
        app.state.redis = r
    except Exception:
        pass
    yield


app = FastAPI(title="Refine-Nexus AI", version="1.0.0", lifespan=lifespan, docs_url="/docs")
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.environ.get("ALLOWED_ORIGINS", "http://localhost:3000").split(","),
    allow_methods=["GET", "POST", "PATCH", "DELETE"],
    allow_headers=["Authorization", "Content-Type"],
    allow_credentials=True,
)


@app.get("/health")
async def health():
    return {"status": "ok", "redis": app.state.redis is not None}


# ---------- Auth (demo credentials; wire to the users table + OIDC in production) ----------
class Login(BaseModel):
    email: str
    password: str = Field(min_length=8)


@app.post("/auth/login", dependencies=[Depends(rate_limit)])
async def login(body: Login):
    demo = os.environ.get("DEMO_ADMIN_PASSWORD")
    if not demo or body.password != demo:
        raise HTTPException(401, "Invalid credentials")
    return {"access_token": issue_token(body.email, "admin", "demo-tenant"), "token_type": "bearer"}


# ---------- Module A: schema auto-detection ----------
@app.post("/schema/inspect")
async def inspect(request: Request, user: Principal = Depends(require("schema", "create"))):
    raw = (await request.body()).decode()
    kind = request.headers.get("content-type", "")
    try:
        resources = from_openapi(raw) if "yaml" in kind or "openapi" in raw[:200] else from_sample(raw)
    except Exception as e:
        raise HTTPException(422, f"Could not parse input: {e}")
    audit.append(user.sub, "schema.inspect", "schema", None, {"resources": [r["name"] for r in resources]})
    return {"resources": resources}


# ---------- Module E: Nexus Copilot (SSE + HITL) ----------
class CopilotReq(BaseModel):
    message: str = Field(max_length=4000)
    route: str | None = None
    record_id: str | None = None
    filters: dict | None = None


def sse(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(data)}\n\n"


def detect_action(msg: str) -> str | None:
    m = msg.lower()
    for a in DESTRUCTIVE:
        if a in m:
            return a
    return None


@app.post("/copilot/stream", dependencies=[Depends(rate_limit)])
async def copilot(req: CopilotReq, user: Principal = Depends(current_user)):
    screen_prompt(req.message)
    safe, pii = mask_pii(req.message)
    t0 = time.time()

    async def gen():
        if pii:
            yield sse("guard", {"pii_masked": pii})
        action = detect_action(safe)
        if action:
            pid = f"act_{len(pending_actions) + 1}"
            pending_actions[pid] = {"action": action, "text": safe, "user": user.sub, "route": req.route}
            yield sse("approval_required", {"id": pid, "action": action, "summary": safe,
                                              "note": "Destructive actions need explicit approval."})
            yield sse("done", {"latency_ms": int((time.time() - t0) * 1000)})
            return
        if safe in semantic_cache:
            telemetry[user.sub]["cache_hits"] += 1
            answer = semantic_cache[safe]
        else:
            answer = await answer_llm(safe, req)
            semantic_cache[safe] = answer
        for tok in answer.split(" "):
            yield sse("token", {"t": tok + " "})
            await asyncio.sleep(0.015)
        t = telemetry[user.sub]
        t["requests"] += 1
        t["tokens"] += len(answer.split())
        yield sse("done", {"latency_ms": int((time.time() - t0) * 1000)})

    return StreamingResponse(gen(), media_type="text/event-stream", headers={"Cache-Control": "no-cache"})


async def answer_llm(text: str, req: CopilotReq) -> str:
    try:
        import litellm

        ctx = f"Route={req.route} record={req.record_id} filters={req.filters}"
        r = await litellm.acompletion(
            model=os.environ.get("LITELLM_MODEL", "gpt-4o-mini"),
            messages=[{"role": "system", "content": "You are Nexus Copilot, an admin-panel assistant. " + ctx},
                      {"role": "user", "content": text}],
            timeout=30,
        )
        return r.choices[0].message.content
    except Exception:
        return ("Nexus Copilot is running in offline demo mode (no LLM key configured). "
                f"I received: '{text[:120]}'. Add an API key in .env to enable live answers.")


class Decision(BaseModel):
    approved: bool


@app.post("/copilot/approve/{pid}")
async def approve(pid: str, d: Decision, user: Principal = Depends(require("copilot", "delete"))):
    act = pending_actions.pop(pid, None)
    if not act:
        raise HTTPException(404, "No such pending action")
    audit.append(user.sub, f"hitl.{'approved' if d.approved else 'rejected'}", act["action"], None,
                 {"text": act["text"]}, prompt_trace=act["text"])
    return {"status": "executed" if d.approved else "rejected", "action": act["action"]}


# ---------- Module D proxy ----------
@app.post("/documents/extract", dependencies=[Depends(rate_limit)])
async def extract(file: UploadFile = File(...), user: Principal = Depends(require("documents", "create"))):
    if file.content_type not in {"image/png", "image/jpeg"}:
        raise HTTPException(415, "Only PNG/JPEG supported")
    data = await file.read()
    if len(data) > 10 * 1024 * 1024:
        raise HTTPException(413, "File too large")
    async with httpx.AsyncClient(timeout=60) as c:
        r = await c.post(os.environ.get("CNN_SERVICE_URL", "http://cnn:8100") + "/extract",
                         files={"file": (file.filename, data, file.content_type)})
    r.raise_for_status()
    result = r.json()
    audit.append(user.sub, "document.extract", file.filename or "upload", None, {"class": result.get("class")})
    return result


# ---------- FinOps + audit ----------
@app.get("/finops/summary")
async def finops(user: Principal = Depends(require("finops", "list"))):
    return {"by_user": telemetry, "cache_entries": len(semantic_cache)}


@app.get("/audit")
async def audit_log(user: Principal = Depends(require("audit", "list"))):
    ok, bad = audit.verify()
    return {"intact": ok, "first_bad_seq": bad, "entries": audit.entries[-100:]}
