import { test } from "node:test";
import assert from "node:assert/strict";
import { hybridSearch, SEED_DOCS } from "../lib/search.ts";

const top = (q: string) => hybridSearch(SEED_DOCS, q, 1)[0]?.title;

test("keyword queries find the right document", () => {
  assert.equal(top("who can delete records"), "Access control guide");
  assert.equal(top("refund over 10000"), "Refund policy");
  assert.equal(top("error rate rollback"), "Incident runbook");
});

test("fuzzy queries still match through the dense side", () => {
  assert.equal(top("refunds"), "Refund policy");
});

test("empty query and unrelated query return nothing", () => {
  assert.deepEqual(hybridSearch(SEED_DOCS, "  "), []);
  assert.equal(hybridSearch(SEED_DOCS, "zzzzqqqq").length, 0);
});

test("RRF scores are sorted descending", () => {
  const hits = hybridSearch(SEED_DOCS, "audit logs and access", 5);
  for (let i = 1; i < hits.length; i++) assert.ok(hits[i - 1].rrf >= hits[i].rrf);
});
