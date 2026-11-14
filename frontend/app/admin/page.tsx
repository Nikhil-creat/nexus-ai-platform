"use client";
import { useList } from "@refinedev/core";
import BarChart from "@/components/BarChart";
import { can } from "@/lib/resources";
import { useSession } from "@/lib/session";

function Kpi({ label, value }: { label: string; value: string | number }) {
  return <div className="stat"><b>{value}</b><span>{label}</span></div>;
}

const countBy = (rows: Record<string, unknown>[], key: string) => {
  const m = new Map<string, number>();
  rows.forEach((r) => m.set(String(r[key]), (m.get(String(r[key])) ?? 0) + 1));
  return [...m].map(([label, value]) => ({ label, value }));
};

export default function Overview() {
  const role = useSession((s) => s.user?.role);
  const email = useSession((s) => s.user?.email);
  const orders = useList({ resource: "orders", pagination: { current: 1, pageSize: 100 } as any, queryOptions: { enabled: can(role, "orders", "list") } });
  const users = useList({ resource: "users", pagination: { current: 1, pageSize: 100 } as any, queryOptions: { enabled: can(role, "users", "list") } });
  const usage = useList({ resource: "usage", pagination: { current: 1, pageSize: 100 } as any, queryOptions: { enabled: can(role, "usage", "list") } });

  const o = (orders.data?.data ?? []) as Record<string, any>[];
  const u = (users.data?.data ?? []) as Record<string, any>[];
  const f = (usage.data?.data ?? []) as Record<string, any>[];
  const revenue = o.filter((x) => x.status === "paid").reduce((a, x) => a + Number(x.total), 0);
  const review = o.filter((x) => x.status === "review").length;

  return (
    <>
      <h1 className="admin__h">Overview</h1>
      <p className="tagline">Signed in as {email}. Everything below is read live from the database.</p>
      <div className="kpis">
        <Kpi label="Orders" value={orders.data?.total ?? 0} />
        <Kpi label="Paid revenue" value={`$${revenue.toLocaleString()}`} />
        <Kpi label="Flagged for review" value={review} />
        {can(role, "users", "list") && <Kpi label="Users" value={users.data?.total ?? 0} />}
        {can(role, "usage", "list") && <Kpi label="LLM tokens" value={f.reduce((a, r) => a + Number(r.tokens), 0).toLocaleString()} />}
        {can(role, "usage", "list") && <Kpi label="Est. LLM cost" value={`$${f.reduce((a, r) => a + Number(r.cost_usd), 0).toFixed(4)}`} />}
      </div>
      {o.length === 0 && !orders.isLoading && (
        <p className="section__lead">No data yet. {role === "admin" ? "Open Settings → “Load sample data”, or add orders under Orders." : "Ask an admin to add data."}</p>
      )}
      <div className="charts">
        <BarChart title="Orders by status" data={countBy(o, "status")} />
        <BarChart title="Order value" data={o.slice(0, 8).map((r) => ({ label: `#${r.id} ${r.customer}`, value: Number(r.total) }))} format={(n) => `$${n.toLocaleString()}`} />
        {can(role, "users", "list") && <BarChart title="Users by role" data={countBy(u, "role")} />}
        {can(role, "usage", "list") && <BarChart title="LLM tokens by user" data={f.map((r) => ({ label: String(r.id), value: Number(r.tokens) }))} format={(n) => n.toLocaleString()} />}
      </div>
      <p className="section__lead">Try the Copilot (bottom-right): “which orders are pending?” or “search the knowledge base for refund policy”. Any change it proposes waits for your approval.</p>
    </>
  );
}
