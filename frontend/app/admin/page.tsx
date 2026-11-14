"use client";
import { useList } from "@refinedev/core";

function Kpi({ label, value }: { label: string; value: string | number }) {
  return <div className="stat"><b>{value}</b><span>{label}</span></div>;
}

export default function Overview() {
  const users = useList({ resource: "users" });
  const orders = useList({ resource: "orders" });
  const finops = useList({ resource: "finops" });
  const tokens = (finops.data?.data ?? []).reduce((a: number, r: any) => a + r.tokens, 0);
  const cost = (finops.data?.data ?? []).reduce((a: number, r: any) => a + r.cost_usd, 0);
  const review = (orders.data?.data ?? []).filter((o: any) => o.status === "review").length;

  return (
    <>
      <h1 className="admin__h">Overview</h1>
      <p className="tagline">Live from your Refine data provider.</p>
      <div className="kpis">
        <Kpi label="Users" value={users.data?.total ?? "—"} />
        <Kpi label="Orders" value={orders.data?.total ?? "—"} />
        <Kpi label="Flagged for review" value={review} />
        <Kpi label="LLM tokens" value={tokens.toLocaleString()} />
        <Kpi label="LLM cost (USD)" value={`$${cost.toFixed(2)}`} />
      </div>
      <p className="section__lead">
        Try the Copilot (bottom-right) with “delete all inactive users” to see the human-in-the-loop approval gate,
        or switch the role in the sidebar to watch the access-control provider hide actions.
      </p>
    </>
  );
}
