import { test } from "node:test";
import assert from "node:assert/strict";
import { inspect, parseCsv, SAMPLE } from "../lib/inspector.ts";

const types = (raw: string, name = "x") =>
  Object.fromEntries(inspect(raw, name).resources[0].fields.map((f) => [f.name, f.type]));

test("JSON sample gets semantic widgets", () => {
  const t = types(SAMPLE, "user");
  assert.equal(t.email, "email");
  assert.equal(t.status, "badge");
  assert.equal(t.avatar_url, "image");
  assert.equal(t.balance, "currency");
  assert.equal(t.created_at, "datetime");
});

test("foreign keys become relations", () => {
  const f = inspect(SAMPLE, "user").resources[0].fields.find((x) => x.name === "plan_id");
  assert.equal(f?.relation, "plans");
});

test("CSV with quoted commas parses", () => {
  const rows = parseCsv('name,note\n"Acme, Inc","said ""hi"""\n');
  assert.deepEqual(rows, [{ name: "Acme, Inc", note: 'said "hi"' }]);
});

test("OpenAPI enum becomes badge and zod enum", () => {
  const spec = JSON.stringify({
    openapi: "3.0.0",
    components: { schemas: { Order: { type: "object", required: ["total"], properties: { id: { type: "integer" }, total: { type: "number" }, state: { type: "string", enum: ["a", "b"] } } } } },
  });
  const out = inspect(spec);
  assert.equal(out.kind, "OpenAPI");
  assert.match(out.resources[0].zod, /z\.enum\(\["a","b"\]\)/);
  assert.ok(!out.resources[0].zod.includes("id:"), "read-only id is excluded from the form schema");
});

test("YAML and empty input give clear errors", () => {
  assert.throws(() => inspect("openapi: 3.0.0\ninfo: x"), /backend/);
  assert.throws(() => inspect("   "), /Paste/);
});
