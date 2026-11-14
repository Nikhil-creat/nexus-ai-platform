"use client";
import { useEffect, useState } from "react";
import { useList } from "@refinedev/core";
import { load, save } from "@/lib/store";

type Rule = { id: string; name: string; field: string; op: ">" | "<" | "=" | "contains"; value: string; action: string };
const DEFAULTS: Rule[] = [
  { id: "r1", name: "High-value order", field: "total", op: ">", value: "10000", action: "Flag for human review + ping Slack" },
  { id: "r2", name: "Pending too long", field: "status", op: "=", value: "pending", action: "Send reminder email" },
];

const test = (row: any, r: Rule) => {
  const v = row[r.field];
  if (v === undefined) return false;
  if (r.op === ">") return Number(v) > Number(r.value);
  if (r.op === "<") return Number(v) < Number(r.value);
  if (r.op === "=") return String(v).toLowerCase() === r.value.toLowerCase();
  return String(v).toLowerCase().includes(r.value.toLowerCase());
};

export default function Workflows() {
  const [rules, setRules] = useState<Rule[]>(DEFAULTS);
  const [log, setLog] = useState<string[]>([]);
  const [draft, setDraft] = useState<Rule>({ id: "", name: "", field: "total", op: ">", value: "", action: "Flag for human review" });
  const orders = useList({ resource: "orders", pagination: { pageSize: 100 } as any });
  const rows = (orders.data?.data ?? []) as any[];

  useEffect(() => { setRules(load("nexus_rules", DEFAULTS)); }, []);
  const persist = (n: Rule[]) => { setRules(n); save("nexus_rules", n); };

  const run = () => {
    const lines = rules.flatMap((r) => rows.filter((o) => test(o, r)).map((o) => `[${new Date().toLocaleTimeString()}] "${r.name}" matched order #${o.id} (${o.customer}) → ${r.action} (simulated)`));
    setLog(lines.length ? lines : ["No rules matched."]);
  };
  const add = () => {
    if (!draft.name.trim() || !draft.value.trim()) return;
    persist([...rules, { ...draft, id: crypto.randomUUID() }]);
    setDraft({ ...draft, name: "", value: "" });
  };

  return (
    <>
      <h1 className="admin__h">Workflow automation</h1>
      <p className="section__lead">Trigger → condition → action rules evaluated against live Orders. Actions are simulated in the browser demo; the backend executes webhooks behind the approval gate.</p>
      <table className="table">
        <thead><tr><th>Rule</th><th>When</th><th>Then</th><th>Matches</th><th /></tr></thead>
        <tbody>
          {rules.map((r) => (
            <tr key={r.id}>
              <td>{r.name}</td><td>{r.field} {r.op} {r.value}</td><td>{r.action}</td>
              <td><span className="badge">{rows.filter((o) => test(o, r)).length}</span></td>
              <td><button className="badge badge--bad" style={{ border: 0, cursor: "pointer" }} onClick={() => persist(rules.filter((x) => x.id !== r.id))}>delete</button></td>
            </tr>
          ))}
        </tbody>
      </table>
      <h2 className="admin__h" style={{ fontSize: 22, marginTop: 40 }}>New rule</h2>
      <div className="row">
        <input className="input" style={{ maxWidth: 200 }} placeholder="Name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
        <select className="input" style={{ maxWidth: 140, background: "#000" }} value={draft.field} onChange={(e) => setDraft({ ...draft, field: e.target.value })}>
          <option>total</option><option>status</option><option>customer</option>
        </select>
        <select className="input" style={{ maxWidth: 110, background: "#000" }} value={draft.op} onChange={(e) => setDraft({ ...draft, op: e.target.value as Rule["op"] })}>
          <option>{">"}</option><option>{"<"}</option><option>=</option><option>contains</option>
        </select>
        <input className="input" style={{ maxWidth: 140 }} placeholder="Value" value={draft.value} onChange={(e) => setDraft({ ...draft, value: e.target.value })} />
        <select className="input" style={{ maxWidth: 300, background: "#000" }} value={draft.action} onChange={(e) => setDraft({ ...draft, action: e.target.value })}>
          <option>Flag for human review</option><option>Flag for human review + ping Slack</option><option>Send reminder email</option><option>Call webhook</option>
        </select>
        <button className="btn btn--solid" style={{ width: "auto", padding: "14px 28px" }} onClick={add}>Add</button>
        <button className="btn btn--ghost" style={{ width: "auto", padding: "14px 28px" }} onClick={run}>Run now</button>
      </div>
      {log.length > 0 && <pre className="pre">{log.join("\n")}</pre>}
    </>
  );
}
