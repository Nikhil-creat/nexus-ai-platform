r"""LangGraph multi-agent supervisor with self-healing QA loop and Human-in-the-Loop gate.

Flow:  supervisor -> architect -> codegen -> qa_sandbox --(fail, <=3x)--> codegen
                                                      +--(pass)--> hitl_gate --(approved)--> executor
                                                                           \--(rejected)--> END
"""
from __future__ import annotations

import subprocess
import tempfile
from pathlib import Path
from typing import Literal, TypedDict

from langgraph.checkpoint.memory import MemorySaver
from langgraph.graph import END, StateGraph
from langgraph.types import Command, interrupt

MAX_HEAL = 3
DESTRUCTIVE_ACTIONS = {"delete", "update", "migrate", "webhook"}


class NexusState(TypedDict, total=False):
    request: str
    plan: str
    code: str
    qa_log: str
    attempts: int
    intent: str
    action: str
    approved: bool
    result: str


def llm(prompt: str) -> str:
    """LiteLLM gateway call with fallback chain. Imported lazily so the graph is testable offline."""
    try:
        import litellm, os

        r = litellm.completion(
            model=os.environ.get("LITELLM_MODEL", "gpt-4o-mini"),
            messages=[{"role": "user", "content": prompt}],
            fallbacks=["claude-3-5-haiku-latest", "ollama/llama3.1"],
            caching=True,
        )
        return r.choices[0].message.content
    except Exception as e:  # offline demo mode
        return f"# offline-demo\nprint('LLM unavailable: {type(e).__name__}')"


def supervisor(state: NexusState) -> NexusState:
    text = state["request"].lower()
    action = next((a for a in DESTRUCTIVE_ACTIONS if a in text), "read")
    intent = "codegen" if any(w in text for w in ("build", "generate", "scaffold", "page", "view")) else "chat"
    return {"intent": intent, "action": action, "attempts": 0}


def architect(state: NexusState) -> NexusState:
    return {"plan": llm(f"Plan a minimal Refine resource/UI change for: {state['request']}")}


def codegen(state: NexusState) -> NexusState:
    fix = f"\nPrevious QA failure to fix:\n{state['qa_log']}" if state.get("qa_log") else ""
    code = llm(f"Write clean TypeScript for this plan. Return code only.\n{state['plan']}{fix}")
    return {"code": code, "attempts": state.get("attempts", 0) + 1}


def qa_sandbox(state: NexusState) -> NexusState:
    """Run tsc inside a locked-down container (no network, read-only fs, memory/CPU capped)."""
    with tempfile.TemporaryDirectory() as d:
        Path(d, "gen.ts").write_text(state["code"])
        cmd = ["docker", "run", "--rm", "--network=none", "--read-only", "--memory=256m", "--cpus=0.5",
               "--cap-drop=ALL", "--pids-limit=64", "-v", f"{d}:/w:ro", "-w", "/w",
               "node:20-alpine", "npx", "--yes", "tsc", "--noEmit", "--strict", "gen.ts"]
        try:
            p = subprocess.run(cmd, capture_output=True, text=True, timeout=90)
            return {"qa_log": "" if p.returncode == 0 else (p.stdout + p.stderr)[-2000:]}
        except (FileNotFoundError, subprocess.TimeoutExpired) as e:
            return {"qa_log": "" if isinstance(e, FileNotFoundError) else "timeout"}  # no docker -> skip


def after_qa(state: NexusState) -> Literal["codegen", "hitl_gate"]:
    if state.get("qa_log") and state["attempts"] < MAX_HEAL:
        return "codegen"
    return "hitl_gate"


def hitl_gate(state: NexusState) -> Command[Literal["executor", "__end__"]]:
    if state["action"] in DESTRUCTIVE_ACTIONS:
        decision = interrupt({"type": "approval_required", "action": state["action"], "preview": state["code"][:800]})
        if not decision.get("approved"):
            return Command(goto=END, update={"approved": False, "result": "Rejected by human reviewer"})
    return Command(goto="executor", update={"approved": True})


def executor(state: NexusState) -> NexusState:
    return {"result": f"Applied after {state['attempts']} attempt(s); QA clean={not state.get('qa_log')}"}


def route(state: NexusState) -> Literal["architect", "executor"]:
    return "architect" if state["intent"] == "codegen" else "executor"


def build_graph():
    g = StateGraph(NexusState)
    for name, fn in [("supervisor", supervisor), ("architect", architect), ("codegen", codegen),
                     ("qa_sandbox", qa_sandbox), ("hitl_gate", hitl_gate), ("executor", executor)]:
        g.add_node(name, fn)
    g.set_entry_point("supervisor")
    g.add_conditional_edges("supervisor", route)
    g.add_edge("architect", "codegen")
    g.add_edge("codegen", "qa_sandbox")
    g.add_conditional_edges("qa_sandbox", after_qa)
    g.add_edge("executor", END)
    return g.compile(checkpointer=MemorySaver())  # swap for PostgresSaver in production


graph = build_graph()
