"use client";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { CAPS } from "@/lib/resources";
import { useSession } from "@/lib/session";

type Rule = { id: string; name: string; field: string; op: string; value: string; action: string };
const ACTION_LABEL: Record<string, string> = { flag_review: "Flag order for review", notify: "Record notification" };

export default function Workflows() {
  const role = useSession((s) => s.user?.role);
  const canWrite = !!role && CAPS.rulesWrite.includes(role);
  const [rules, setRules] = useState<Rule[]>([]);
  const [log, setLog] = useState<string[]>([]);
  const [msg, setMsg] = useState("");
  const [draft, setDraft] = useState({ name: "", field: "total", op: ">", value: "", action: "flag_review" });

  const load = useCallback(() => api<{ rules: Rule[] }>("/rules").then((r) => setRules(r.rules)).catch((e) => setMsg(e.message)), []);
  useEffect(() => { load(); }, [load]);

  const add = async () => {
    setMsg("");
    try { await api("/rules", { body: draft }); setDraft({ ...draft, name: "", value: "" }); load(); } catch (e) { setMsg((e as Error).message); }
  };
  const remove = async (id: string) => { try { await api(`/rules/${id}`, { method: "DELETE" }); load(); } catch (e) { setMsg((e as Error).message); } };
  const run = async () => {
    setMsg("");
    try {
      const r = await api<{ rules: number; changed: number; log: string[] }>("/rules/run", { body: {} });
      setLog(r.log); setMsg(`Ran ${r.rules} rule(s); ${r.changed} order(s) changed.`);
    } catch (e) { setMsg((e as Error).message); }
  };

  return (
    <>
      <h1 className="admin__h">Workflow automation</h1>
      <p className="section__lead">When an order matches a rule, the action really happens: orders are moved to “review” or a notification is written to the audit trail. Every change is attributed to the rule and to you.</p>
      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>Rule</th><th>When</th><th>Then</th><th /></tr></thead>
          <tbody>
            {rules.map((r) => (
              <tr key={r.id}><td>{r.name}</td><td>{r.field} {r.op} {r.value}</td><td>{ACTION_LABEL[r.action] ?? r.action}</td><td className="actions">{canWrite && <button className="badge badge--bad" onClick={() => remove(r.id)}>delete</button>}</td></tr>
            ))}
            {!rules.length && <tr><td colSpan={4}>No rules yet.</td></tr>}
          </tbody>
        </table>
      </div>
      {canWrite ? (
        <>
          <h2 className="admin__h" style={{ fontSize: 22, marginTop: 36 }}>New rule</h2>
          <div className="row">
            <input className="input" style={{ maxWidth: 200 }} placeholder="Name" aria-label="Rule name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
            <select className="input select" style={{ maxWidth: 130 }} aria-label="Field" value={draft.field} onChange={(e) => setDraft({ ...draft, field: e.target.value })}><option>total</option><option>status</option><option>customer</option></select>
            <select className="input select" style={{ maxWidth: 110 }} aria-label="Operator" value={draft.op} onChange={(e) => setDraft({ ...draft, op: e.target.value })}><option>{">"}</option><option>{"<"}</option><option>=</option><option>contains</option></select>
            <input className="input" style={{ maxWidth: 140 }} placeholder="Value" aria-label="Value" value={draft.value} onChange={(e) => setDraft({ ...draft, value: e.target.value })} />
            <select className="input select" style={{ maxWidth: 240 }} aria-label="Action" value={draft.action} onChange={(e) => setDraft({ ...draft, action: e.target.value })}><option value="flag_review">Flag order for review</option><option value="notify">Record notification</option></select>
            <button className="btn btn--solid btn--auto" onClick={add}>Add rule</button>
            <button className="btn btn--ghost btn--auto" onClick={run}>Run now</button>
          </div>
        </>
      ) : <p className="form__status">Your role can view rules but not change or run them.</p>}
      {msg && <p className="form__status" role="status">{msg}</p>}
      {log.length > 0 && <pre className="pre">{log.join("\n")}</pre>}
    </>
  );
}
