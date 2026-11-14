"""Append-only SHA-256 hash-chained audit trail with verification and time-travel restore."""
from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass, field
from datetime import datetime, timezone

GENESIS = "0" * 64


def _digest(prev: str, entry: dict) -> str:
    payload = json.dumps(entry, sort_keys=True, default=str, separators=(",", ":"))
    return hashlib.sha256((prev + payload).encode()).hexdigest()


@dataclass
class AuditChain:
    """In-memory reference implementation; the production path persists rows to `audit_log`
    (whose UPDATE/DELETE are blocked by trigger in infra/init.sql)."""

    entries: list[dict] = field(default_factory=list)

    def append(self, actor: str, action: str, resource: str, before: dict | None, after: dict | None,
               prompt_trace: str | None = None) -> dict:
        prev = self.entries[-1]["hash"] if self.entries else GENESIS
        body = {
            "seq": len(self.entries) + 1,
            "ts": datetime.now(timezone.utc).isoformat(),
            "actor": actor,
            "action": action,
            "resource": resource,
            "before": before,
            "after": after,
            "prompt_trace": prompt_trace,
        }
        row = {**body, "prev_hash": prev, "hash": _digest(prev, body)}
        self.entries.append(row)
        return row

    def verify(self) -> tuple[bool, int | None]:
        prev = GENESIS
        for e in self.entries:
            body = {k: e[k] for k in e if k not in {"prev_hash", "hash"}}
            if e["prev_hash"] != prev or e["hash"] != _digest(prev, body):
                return False, e["seq"]
            prev = e["hash"]
        return True, None

    def restore_point(self, seq: int) -> dict | None:
        """Time-travel: return the `before` state of an entry so the caller can write it back
        (the restore itself is appended as a new audit entry, never an edit)."""
        for e in self.entries:
            if e["seq"] == seq:
                return e["before"]
        return None
