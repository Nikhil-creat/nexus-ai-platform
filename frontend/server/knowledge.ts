import { appendAudit } from "./audit";
import { clean } from "./guard";
import { HttpError } from "./http";
import { getStore } from "./store";
import { CAPS } from "../lib/resources";
import { hybridSearch, SEED_DOCS, type Doc } from "../lib/search";
import type { Actor } from "./data";

const KEY = "c:docs";
const MAX_DOCS = 200;

export type StoredDoc = Doc & { created_at: string; by: string };

export async function listDocs(): Promise<StoredDoc[]> {
  const docs = Object.values(await getStore().hgetall(KEY)).map((v) => JSON.parse(v) as StoredDoc);
  return docs.sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export async function searchDocs(q: string, topK = 5) {
  const docs = await listDocs();
  return hybridSearch(docs, q, topK).map(({ id, title, text, rrf, bm25, dense }) => ({ id, title, text, rrf, bm25, dense }));
}

export async function addDoc(user: Actor, body: { title?: unknown; text?: unknown }, label?: string): Promise<StoredDoc> {
  if (!CAPS.knowledgeWrite.includes(user.role)) throw new HttpError(403, "Your role cannot add documents.");
  const title = clean(body.title, 120);
  const text = clean(body.text, 20_000);
  if (!title || !text) throw new HttpError(400, "Title and text are required.");
  const store = getStore();
  if (Object.keys(await store.hgetall(KEY)).length >= MAX_DOCS) throw new HttpError(409, `Document limit (${MAX_DOCS}) reached.`);
  const doc: StoredDoc = { id: `d_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, title, text, created_at: new Date().toISOString(), by: user.email };
  await store.hset(KEY, doc.id, JSON.stringify(doc));
  await appendAudit({ actor: label ?? user.email, action: "knowledge.add", resource: "knowledge", target: doc.id, note: title });
  return doc;
}

export async function removeDoc(user: Actor, id: string) {
  if (!CAPS.knowledgeWrite.includes(user.role)) throw new HttpError(403, "Your role cannot delete documents.");
  const store = getStore();
  const raw = await store.hget(KEY, id);
  if (!raw) throw new HttpError(404, "Document not found.");
  await store.hdel(KEY, id);
  await appendAudit({ actor: user.email, action: "knowledge.delete", resource: "knowledge", target: id, note: (JSON.parse(raw) as StoredDoc).title });
  return { id };
}

export async function seedDocs(user: Actor) {
  let n = 0;
  for (const d of SEED_DOCS) { await addDoc(user, d, `${user.email} (sample data)`); n++; }
  return n;
}
