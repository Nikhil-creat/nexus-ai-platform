"""Security layer: JWT auth, RBAC/ABAC, PII masking, prompt-injection screening, rate limiting."""
from __future__ import annotations

import os
import re
import time
from dataclasses import dataclass

import jwt
from fastapi import Depends, HTTPException, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

JWT_SECRET = os.environ.get("JWT_SECRET", "")
JWT_ALG = "HS256"
bearer = HTTPBearer(auto_error=False)

# ---- RBAC matrix (role -> resource -> actions); ABAC checks run on top ----
RBAC: dict[str, dict[str, set[str]]] = {
    "admin": {"*": {"list", "show", "create", "edit", "delete", "export"}},
    "editor": {"*": {"list", "show", "create", "edit", "export"}},
    "viewer": {"*": {"list", "show"}},
}
DESTRUCTIVE = {"delete", "migrate", "webhook", "bulk_update"}


@dataclass
class Principal:
    sub: str
    role: str
    tenant_id: str


def issue_token(sub: str, role: str, tenant_id: str, ttl: int = 3600) -> str:
    if len(JWT_SECRET) < 16:
        raise RuntimeError("JWT_SECRET must be set (>=16 chars)")
    now = int(time.time())
    return jwt.encode({"sub": sub, "role": role, "tid": tenant_id, "iat": now, "exp": now + ttl}, JWT_SECRET, JWT_ALG)


async def current_user(creds: HTTPAuthorizationCredentials | None = Depends(bearer)) -> Principal:
    if not creds:
        raise HTTPException(401, "Missing bearer token")
    try:
        p = jwt.decode(creds.credentials, JWT_SECRET, algorithms=[JWT_ALG])
    except jwt.PyJWTError:
        raise HTTPException(401, "Invalid or expired token")
    return Principal(p["sub"], p["role"], p["tid"])


def can(principal: Principal, resource: str, action: str, record: dict | None = None) -> bool:
    perms = RBAC.get(principal.role, {})
    allowed = perms.get(resource, perms.get("*", set()))
    if action not in allowed:
        return False
    # ABAC: tenant isolation + owner-only edits for editors
    if record is not None:
        if record.get("tenant_id") not in (None, principal.tenant_id):
            return False
        if principal.role == "editor" and action == "edit" and record.get("owner") not in (None, principal.sub):
            return False
    return True


def require(resource: str, action: str):
    async def dep(user: Principal = Depends(current_user)) -> Principal:
        if not can(user, resource, action):
            raise HTTPException(403, f"{user.role} may not {action} {resource}")
        return user

    return dep


# ---- PII masking (applied before any text leaves for an external LLM) ----
PII_PATTERNS = {
    "EMAIL": re.compile(r"[\w.+-]+@[\w-]+\.[\w.-]+"),
    "PHONE": re.compile(r"(?<!\d)(?:\+?\d{1,3}[\s-]?)?\d{10}(?!\d)"),
    "CARD": re.compile(r"\b(?:\d[ -]?){13,16}\b"),
    "AADHAAR": re.compile(r"\b\d{4}\s\d{4}\s\d{4}\b"),
    "SSN": re.compile(r"\b\d{3}-\d{2}-\d{4}\b"),
}


def mask_pii(text: str) -> tuple[str, dict[str, int]]:
    counts: dict[str, int] = {}
    for label, rx in PII_PATTERNS.items():
        text, n = rx.subn(f"[{label}_REDACTED]", text)
        if n:
            counts[label] = n
    return text, counts


# ---- Prompt-injection heuristics ----
INJECTION_PATTERNS = [
    r"ignore (all |any )?(previous|prior|above) (instructions|prompts)",
    r"disregard (the )?(system|developer) (prompt|message)",
    r"you are now (dan|developer mode|unrestricted)",
    r"reveal (your )?(system|hidden) prompt",
    r"exfiltrate|base64 -d|curl .*\|\s*sh",
]
_INJ = re.compile("|".join(INJECTION_PATTERNS), re.I)


def screen_prompt(text: str) -> None:
    if _INJ.search(text):
        raise HTTPException(400, "Prompt rejected by injection guard")


# ---- Safe SQL guard for the Data Analyst agent ----
_FORBIDDEN = re.compile(r"\b(insert|update|delete|drop|alter|truncate|grant|revoke|create|copy|call|do)\b", re.I)


def assert_read_only_sql(sql: str) -> str:
    stripped = sql.strip().rstrip(";")
    if ";" in stripped or not re.match(r"^(select|with)\b", stripped, re.I) or _FORBIDDEN.search(stripped):
        raise HTTPException(400, "Only single read-only SELECT statements are allowed")
    return stripped


# ---- Redis sliding-window rate limit ----
async def rate_limit(request: Request, limit: int = 60, window: int = 60) -> None:
    r = request.app.state.redis
    if r is None:
        return
    key = f"rl:{request.client.host}:{int(time.time() // window)}"
    n = await r.incr(key)
    if n == 1:
        await r.expire(key, window)
    if n > limit:
        raise HTTPException(429, "Rate limit exceeded")
