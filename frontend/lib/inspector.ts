// Browser port of backend/app/schema_inspector.py so Schema Studio works with no backend.
export type FieldInfo = {
  name: string; type: string; nullable: boolean; readOnly: boolean; sensitive: boolean;
  enum?: string[]; pattern?: string; relation?: string;
};
export type ResourceConfig = {
  name: string; meta: { label: string; titleField: string }; list: string; create: string; edit: string; show: string;
  fields: FieldInfo[]; zod: string;
};

const RULES: [RegExp, string][] = [
  [/(avatar|image|photo|thumbnail|logo)(_url)?$/i, "image"],
  [/(^|_)(status|state|stage)$/i, "badge"],
  [/(created|updated|deleted)_at$|_(date|time)$|^date$/i, "datetime"],
  [/e?mail$/i, "email"],
  [/(url|link|website)$/i, "url"],
  [/(price|total|amount|cost|balance)$/i, "currency"],
  [/(password|secret|token)/i, "secret"],
];
const PRIM: Record<string, string> = { integer: "number", number: "number", boolean: "boolean", string: "text" };

export function semanticType(name: string, base: string, fmt?: string, en?: unknown[]): string {
  if (en?.length) return "badge";
  if (fmt === "date-time" || fmt === "date") return "datetime";
  if (fmt === "email") return "email";
  if (fmt === "uri" || fmt === "url") return "url";
  for (const [rx, k] of RULES) if (rx.test(name)) return k;
  return PRIM[base] ?? base;
}

function relationOf(name: string): string | undefined {
  return /(_id|Id)$/.test(name) ? name.replace(/(_id|Id)$/, "") + "s" : undefined;
}

export function zodSource(name: string, fields: FieldInfo[]): string {
  const map: Record<string, string> = {
    number: "z.number()", currency: "z.number().nonnegative()", boolean: "z.boolean()", email: "z.string().email()",
    url: "z.string().url()", image: "z.string().url()", datetime: "z.string().datetime()",
  };
  const lines = fields
    .filter((f) => !f.readOnly)
    .map((f) => {
      let z = map[f.type] ?? "z.string()";
      if (f.enum) z = `z.enum(${JSON.stringify(f.enum)})`;
      if (f.pattern) z += `.regex(new RegExp(${JSON.stringify(f.pattern)}))`;
      if (f.nullable) z += ".nullish()";
      return `  ${f.name}: ${z},`;
    });
  return `export const ${name}Schema = z.object({\n${lines.join("\n")}\n});`;
}

function resource(name: string, fields: FieldInfo[]): ResourceConfig {
  const plural = name.toLowerCase() + "s";
  const title = fields.find((f) => ["name", "title", "email"].includes(f.name))?.name ?? "id";
  return {
    name: plural, meta: { label: name, titleField: title },
    list: `/${plural}`, create: `/${plural}/create`, edit: `/${plural}/edit/:id`, show: `/${plural}/show/:id`,
    fields, zod: zodSource(name, fields),
  };
}

export function parseCsv(raw: string): Record<string, string>[] {
  const rows: string[][] = [];
  let cur: string[] = [], cell = "", q = false;
  for (let i = 0; i < raw.length; i++) {
    const c = raw[i];
    if (q) {
      if (c === '"' && raw[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') q = false;
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === ",") { cur.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && raw[i + 1] === "\n") i++;
      cur.push(cell); rows.push(cur); cur = []; cell = "";
    } else cell += c;
  }
  if (cell || cur.length) { cur.push(cell); rows.push(cur); }
  const [head, ...body] = rows.filter((r) => r.some((x) => x.trim()));
  return body.map((r) => Object.fromEntries(head.map((h, i) => [h.trim(), r[i] ?? ""])));
}

const coerce = (v: unknown) => (typeof v === "string" && v.trim() !== "" && !isNaN(Number(v)) ? Number(v) : v);
const baseOf = (v: unknown) => (typeof v === "boolean" ? "boolean" : typeof v === "number" ? (Number.isInteger(v) ? "integer" : "number") : "string");

export function inferFromSample(row: Record<string, unknown>, name: string): ResourceConfig {
  const fields: FieldInfo[] = Object.entries(row).map(([k, raw]) => {
    const v = coerce(raw);
    const fmt = typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v) ? "date-time" : undefined;
    const t = semanticType(k, baseOf(v), fmt);
    return { name: k, type: t, nullable: v == null || v === "", readOnly: k === "id", sensitive: t === "secret", relation: relationOf(k) };
  });
  return resource(name.charAt(0).toUpperCase() + name.slice(1), fields);
}

function deref(spec: any, node: any): any {
  if (!node?.$ref) return node;
  return node.$ref.replace(/^#\//, "").split("/").reduce((a: any, p: string) => a?.[p], spec);
}

export function fromOpenApi(spec: any): ResourceConfig[] {
  const schemas = spec?.components?.schemas ?? {};
  return Object.entries(schemas).flatMap(([name, raw]) => {
    const node = deref(spec, raw);
    if (node?.type !== "object") return [];
    const req = new Set<string>(node.required ?? []);
    const fields: FieldInfo[] = Object.entries<any>(node.properties ?? {}).map(([k, p]) => {
      const s = deref(spec, p);
      const t = semanticType(k, s.type ?? "string", s.format, s.enum);
      return {
        name: k, type: t, nullable: s.nullable ?? !req.has(k), readOnly: !!s.readOnly || k === "id", sensitive: t === "secret",
        enum: s.enum, pattern: s.pattern, relation: relationOf(k),
      };
    });
    return [resource(name, fields)];
  });
}

/** Auto-detects OpenAPI JSON, a JSON object/array sample, or CSV. YAML specs go through the backend. */
export function inspect(raw: string, name = "record"): { kind: string; resources: ResourceConfig[] } {
  const t = raw.trim();
  if (!t) throw new Error("Paste something first.");
  if (t.startsWith("{") || t.startsWith("[")) {
    const data = JSON.parse(t);
    if (!Array.isArray(data) && (data.openapi || data.swagger || data.components)) {
      const r = fromOpenApi(data);
      if (!r.length) throw new Error("No object schemas found in components.schemas.");
      return { kind: "OpenAPI", resources: r };
    }
    const row = Array.isArray(data) ? data[0] : data;
    if (!row || typeof row !== "object") throw new Error("Expected a JSON object or array of objects.");
    return { kind: "JSON sample", resources: [inferFromSample(row, name)] };
  }
  if (/^\s*(openapi|swagger)\s*:/m.test(t)) throw new Error("YAML specs need the backend (/schema/inspect). Convert to JSON to use the browser studio.");
  const rows = parseCsv(t);
  if (!rows.length) throw new Error("CSV needs a header row and at least one data row.");
  return { kind: "CSV sample", resources: [inferFromSample(rows[0], name)] };
}

export const SAMPLE = JSON.stringify(
  [{ id: 1, email: "ada@example.com", status: "active", avatar_url: "https://example.com/a.png", plan_id: 3, balance: 120.5, created_at: "2026-01-01T10:00:00Z" }],
  null, 2
);
