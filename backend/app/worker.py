"""Celery worker for long-running jobs (document ingestion, report export, agent runs)."""
import os

from celery import Celery

celery_app = Celery("nexus", broker=os.environ.get("REDIS_URL", "redis://redis:6379/0"),
                    backend=os.environ.get("REDIS_URL", "redis://redis:6379/0"))
celery_app.conf.task_acks_late = True
celery_app.conf.worker_prefetch_multiplier = 1


@celery_app.task(name="nexus.run_agent")
def run_agent(request: str, thread_id: str) -> dict:
    from ai_workers.supervisor_graph import graph

    cfg = {"configurable": {"thread_id": thread_id}}
    return graph.invoke({"request": request}, cfg)


@celery_app.task(name="nexus.ingest_document")
def ingest_document(source: str, content: str) -> int:
    from app.rag import embed

    return len(embed(content))
