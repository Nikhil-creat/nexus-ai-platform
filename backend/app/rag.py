"""Hybrid RAG: pgvector dense + Postgres FTS/trigram sparse, fused with RRF, then reranked."""
from __future__ import annotations

from collections import defaultdict
from typing import Awaitable, Callable

RRF_K = 60

DENSE_SQL = """
SELECT id, content, source FROM documents
ORDER BY embedding <=> :q::vector LIMIT :n
"""
SPARSE_SQL = """
SELECT id, content, source FROM documents
WHERE tsv @@ plainto_tsquery('english', :text) OR content % :text
ORDER BY ts_rank(tsv, plainto_tsquery('english', :text)) DESC, similarity(content, :text) DESC
LIMIT :n
"""


def rrf_fuse(rankings: list[list[dict]], k: int = RRF_K) -> list[dict]:
    """Reciprocal Rank Fusion: score(d) = sum 1 / (k + rank_i(d))."""
    scores: dict[int, float] = defaultdict(float)
    docs: dict[int, dict] = {}
    for ranking in rankings:
        for rank, d in enumerate(ranking, start=1):
            scores[d["id"]] += 1.0 / (k + rank)
            docs[d["id"]] = d
    return [{**docs[i], "rrf": s} for i, s in sorted(scores.items(), key=lambda x: -x[1])]


_embedder = None
_reranker = None


def embed(text: str) -> list[float]:
    global _embedder
    if _embedder is None:
        from sentence_transformers import SentenceTransformer

        _embedder = SentenceTransformer("sentence-transformers/all-MiniLM-L6-v2")  # 384-dim
    return _embedder.encode(text, normalize_embeddings=True).tolist()


def rerank(query: str, candidates: list[dict], top_k: int = 5) -> list[dict]:
    global _reranker
    try:
        if _reranker is None:
            from sentence_transformers import CrossEncoder

            _reranker = CrossEncoder("BAAI/bge-reranker-base")
        scores = _reranker.predict([(query, c["content"]) for c in candidates])
        ranked = sorted(zip(candidates, scores), key=lambda x: -x[1])
        return [{**c, "rerank": float(s)} for c, s in ranked[:top_k]]
    except Exception:  # model unavailable offline -> fall back to RRF order
        return candidates[:top_k]


async def hybrid_search(
    run_query: Callable[[str, dict], Awaitable[list[dict]]], query: str, n: int = 20, top_k: int = 5
) -> list[dict]:
    dense = await run_query(DENSE_SQL, {"q": str(embed(query)), "n": n})
    sparse = await run_query(SPARSE_SQL, {"text": query, "n": n})
    return rerank(query, rrf_fuse([dense, sparse])[: n], top_k)
