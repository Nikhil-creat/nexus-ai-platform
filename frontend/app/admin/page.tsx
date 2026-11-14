"use client";
import { useList } from "@refinedev/core";
import BarChart from "@/components/BarChart";

function Kpi({ label, value }: { label: string; value: string | number }) {
  return <div className="stat"><b>{value}</b><span>{label}</span></div>;
}

const countBy = (rows: any[], key: string) => {
  const m = new Map<string, number>();
  rows.forEach((r) => m.set(String(r[key]), (m.get(String(r[key])) ?? 0) + 1));
  return [...m].map(([label, value]) => ({ label, value }));
};

export default function Overview() {
  const users = useList({ resource: "users" });
  const orders = useList({ resource: "orders" });
  const finops = useList({ resource: "finops" });
  const o = (orders.data?.data ?? []) as any[];
  const f = (finops.data?.data ?? []) as any[];
  const tokens = f.reduce((a, r) => a + r.tokens, 0);
  const cost = f.reduce((a, r) => a + r.cost_usd, 0);
  const review = o.filter((x) => x.status === "review").length;
  const revenue = o.filter((x) => x.status === "paid").reduce((a, x) => a + x.total, 0);

  return (
    <>
      <h1 className="admin__h">Overview</h1>
      <p className="tagline">Live from your Refine data provider.</p>
      <div className="kpis">
        <Kpi label="Users" value={users.data?.total ?? "—"} />
        <Kpi label="Orders" value={orders.data?.total ?? "—"} />
        <Kpi label="Paid revenue" value={`$${revenue.toLocaleString()}`} />
        <Kpi label="Flagged for review" value={review} />
        <Kpi label="LLM tokens" value={tokens.toLocaleString()} />
        <Kpi label="LLM cost (USD)" value={`$${cost.toFixed(2)}`} />
      </div>
      <div className="charts">
        <BarChart title="Orders by status" data={countBy(o, "status")} />
        <BarChart title="Users by role" data={countBy((users.data?.data ?? []) as any[], "role")} />
        <BarChart title="LLM tokens by user" data={f.map((r) => ({ label: r.user, value: r.tokens }))} format={(n) => n.toLocaleString()} />
        <BarChart title="Order value" data={o.map((r) => ({ label: `#${r.id} ${r.customer}`, value: r.total }))} format={(n) => `$${n.toLocaleString()}`} />
      </div>
      <p className="section__lead">
        Try the Copilot (bottom-right) with “delete all inactive users” to see the human-in-the-loop approval gate,
        or switch the role in the sidebar to watch the access-control provider hide actions. Open this app in a second tab to see presence update.
      </p>
    </>
  );
}
