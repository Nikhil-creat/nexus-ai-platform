"""Universal Schema / API Auto-Detector.

Ingests an OpenAPI 3.x spec, a raw JSON sample payload, or a CSV sample and
emits Refine <Resource /> JSON configs with semantic field typing.
"""
from __future__ import annotations

import csv
import io
import json
import re
from typing import Any

import yaml

SEMANTIC_RULES: list[tuple[re.Pattern, str]] = [
    (re.compile(r"(avatar|image|photo|thumbnail|logo)(_url)?$", re.I), "image"),
    (re.compile(r"(^|_)(status|state|stage)$", re.I), "badge"),
    (re.compile(r"(created|updated|deleted)_at$|_(date|time)$|^date$", re.I), "datetime"),
    (re.compile(r"e?mail$", re.I), "email"),
    (re.compile(r"(url|link|website)$", re.I), "url"),
    (re.compile(r"(price|total|amount|cost|balance)$", re.I), "currency"),
    (re.compile(r"(password|secret|token)", re.I), "secret"),
]

PRIMITIVE_MAP = {"integer": "number", "number": "number", "boolean": "boolean", "string": "text"}


def semantic_type(name: str, base: str, fmt: str | None = None, enum: list | None = None) -> str:
    if enum:
        return "badge"
    if fmt in {"date-time", "date"}:
        return "datetime"
    if fmt == "email":
        return "email"
    if fmt in {"uri", "url"}:
        return "url"
    for rx, kind in SEMANTIC_RULES:
        if rx.search(name):
            return kind
    return PRIMITIVE_MAP.get(base, base)


def _resolve(spec: dict, node: dict) -> dict:
    ref = node.get("$ref")
    if not ref:
        return node
    cur: Any = spec
    for part in ref.lstrip("#/").split("/"):
        cur = cur[part]
    return cur


def _field(spec: dict, name: str, schema: dict, required: set[str]) -> dict:
    schema = _resolve(spec, schema)
    base = schema.get("type", "string")
    out: dict[str, Any] = {
        "name": name,
        "type": semantic_type(name, base, schema.get("format"), schema.get("enum")),
        "nullable": schema.get("nullable", name not in required),
        "readOnly": bool(schema.get("readOnly")) or name == "id",
        "sensitive": semantic_type(name, base) == "secret",
    }
    if schema.get("enum"):
        out["enum"] = schema["enum"]
    if schema.get("pattern"):
        out["pattern"] = schema["pattern"]
    if name.endswith("_id") or name.endswith("Id"):
        out["relation"] = {"resource": re.sub(r"(_id|Id)$", "", name) + "s", "kind": "many-to-one"}
    return out


def from_openapi(raw: str) -> list[dict]:
    spec = yaml.safe_load(raw)
    schemas = spec.get("components", {}).get("schemas", {})
    paths = spec.get("paths", {})
    resources = []
    for name, node in schemas.items():
        node = _resolve(spec, node)
        if node.get("type") != "object":
            continue
        props = node.get("properties", {})
        required = set(node.get("required", []))
        plural = name.lower() + "s"
        matched = [p for p in paths if p.strip("/").split("/")[0] in {plural, name.lower()}]
        fields = [_field(spec, k, v, required) for k, v in props.items()]
        resources.append(_resource(name, plural, fields, matched))
    return resources


def _infer_base(value: Any) -> str:
    if isinstance(value, bool):
        return "boolean"
    if isinstance(value, int):
        return "integer"
    if isinstance(value, float):
        return "number"
    return "string"


def from_sample(raw: str, name: str = "record") -> list[dict]:
    """Infer a resource from a JSON object/array or CSV sample."""
    raw = raw.strip()
    if raw.startswith(("{", "[")):
        data = json.loads(raw)
        row = data[0] if isinstance(data, list) else data
    else:
        row = next(csv.DictReader(io.StringIO(raw)))
        row = {k: _coerce(v) for k, v in row.items()}
    fields = []
    for k, v in row.items():
        base = _infer_base(v)
        fmt = "date-time" if isinstance(v, str) and re.match(r"\d{4}-\d{2}-\d{2}", v) else None
        fields.append(
            {
                "name": k,
                "type": semantic_type(k, base, fmt),
                "nullable": v is None,
                "readOnly": k == "id",
                "sensitive": semantic_type(k, base) == "secret",
            }
        )
    return [_resource(name.capitalize(), name + "s", fields, [])]


def _coerce(v: str) -> Any:
    for cast in (int, float):
        try:
            return cast(v)
        except (TypeError, ValueError):
            pass
    return v


def _resource(name: str, plural: str, fields: list[dict], paths: list[str]) -> dict:
    title = next((f["name"] for f in fields if f["name"] in {"name", "title", "email"}), "id")
    return {
        "name": plural,
        "meta": {"label": name, "icon": "table", "titleField": title},
        "list": f"/{plural}",
        "create": f"/{plural}/create",
        "edit": f"/{plural}/edit/:id",
        "show": f"/{plural}/show/:id",
        "fields": fields,
        "sourcePaths": paths,
        "zod": zod_source(name, fields),
    }


def zod_source(name: str, fields: list[dict]) -> str:
    lines = []
    for f in fields:
        if f["readOnly"]:
            continue
        t = f["type"]
        z = {
            "number": "z.number()",
            "currency": "z.number().nonnegative()",
            "boolean": "z.boolean()",
            "email": "z.string().email()",
            "url": "z.string().url()",
            "image": "z.string().url()",
            "datetime": "z.string().datetime()",
        }.get(t, "z.string()")
        if f.get("enum"):
            z = "z.enum(" + json.dumps(f["enum"]) + ")"
        if f.get("pattern"):
            z += f".regex(new RegExp({json.dumps(f['pattern'])}))"
        if f["nullable"]:
            z += ".nullish()"
        lines.append(f"  {f['name']}: {z},")
    return f"export const {name}Schema = z.object({{\n" + "\n".join(lines) + "\n});"
