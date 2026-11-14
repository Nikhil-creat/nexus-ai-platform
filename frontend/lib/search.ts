// Client-side hybrid retrieval: BM25 (sparse) + hashed char-trigram vectors (dense) fused with RRF.
// Same pipeline shape as backend/app/rag.py (which uses pgvector + a cross-encoder instead).
export type Doc = { id: string; title: string; text: string };
export type Hit = Doc & { rrf: number; bm25: number; dense: number };

const tok = (s: string) => s.toLowerCase().match(/[a-z0-9]+/g) ?? [];
const DIM = 512;

export function embed(text: string): Float32Array {
  const v = new Float32Array(DIM);
  const t = ` ${text.toLowerCase().replace(/[^a-z0-9]+/g, " ")} `;
  for (let i = 0; i < t.length - 2; i++) {
    const g = t.slice(i, i + 3);
    let h = 2166136261;
    for (let j = 0; j < 3; j++) { h ^= g.charCodeAt(j); h = Math.imul(h, 16777619); }
    v[(h >>> 0) % DIM] += 1;
  }
  let n = 0;
  for (const x of v) n += x * x;
  n = Math.sqrt(n) || 1;
  return v.map((x) => x / n);
}

const dot = (a: Float32Array, b: Float32Array) => a.reduce((s, x, i) => s + x * b[i], 0);

function bm25(docs: Doc[], q: string, k1 = 1.5, b = 0.75): number[] {
  const toks = docs.map((d) => tok(d.title + " " + d.text));
  const avg = toks.reduce((s, t) => s + t.length, 0) / (docs.length || 1) || 1;
  const df = new Map<string, number>();
  toks.forEach((t) => new Set(t).forEach((w) => df.set(w, (df.get(w) ?? 0) + 1)));
  return toks.map((t) => {
    const tf = new Map<string, number>();
    t.forEach((w) => tf.set(w, (tf.get(w) ?? 0) + 1));
    return tok(q).reduce((s, w) => {
      const f = tf.get(w) ?? 0;
      if (!f) return s;
      const idf = Math.log(1 + (docs.length - (df.get(w) ?? 0) + 0.5) / ((df.get(w) ?? 0) + 0.5));
      return s + (idf * f * (k1 + 1)) / (f + k1 * (1 - b + (b * t.length) / avg));
    }, 0);
  });
}

export function hybridSearch(docs: Doc[], q: string, topK = 5): Hit[] {
  if (!q.trim() || !docs.length) return [];
  const sparse = bm25(docs, q);
  const qv = embed(q);
  const dense = docs.map((d) => dot(qv, embed(d.title + " " + d.text)));
  const rank = (scores: number[]) =>
    scores.map((s, i) => [s, i] as const).sort((a, b) => b[0] - a[0]).map(([, i]) => i);
  const rrf = new Array(docs.length).fill(0);
  [rank(sparse), rank(dense)].forEach((r) => r.forEach((i, pos) => (rrf[i] += 1 / (60 + pos + 1))));
  return docs
    .map((d, i) => ({ ...d, rrf: rrf[i], bm25: sparse[i], dense: dense[i] }))
    .filter((h) => h.bm25 > 0 || h.dense > 0.15)
    .sort((a, b) => b.rrf - a.rrf)
    .slice(0, topK);
}

export const SEED_DOCS: Doc[] = [
  { id: "d1", title: "Refund policy", text: "Refunds are issued within 14 days of purchase. Orders above $10,000 require manual review by a finance admin before a refund is approved." },
  { id: "d2", title: "Access control guide", text: "Admins can delete records. Editors can create and edit but never delete. Viewers have read-only access. All destructive actions require human approval." },
  { id: "d3", title: "Incident runbook", text: "If the API error rate exceeds 5 percent, page the on-call engineer, check the audit trail for recent deployments, and roll back the latest release." },
  { id: "d4", title: "Data retention", text: "Inactive user accounts are suspended after 12 months. Audit logs are append-only and retained for seven years with SHA-256 hash chaining." },
  { id: "d5", title: "LLM cost controls", text: "Semantic caching serves repeated questions at zero token cost. Monthly spend per user is tracked in the FinOps dashboard with alerts at 80 percent." },
];
