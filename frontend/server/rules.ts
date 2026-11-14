import { appendAudit } from "./audit";
import { list, update, type Actor } from "./data";
import { clean } from "./guard";
import { HttpError } from "./http";
import { getStore } from "./store";
import { CAPS } from "../lib/resources";

const KEY = "c:rules";
export const FIELDS = ["total", "status", "customer"] as const;
export const OPS = [">", "<", "=", "contains"] as const;
export const ACTIONS = ["flag_review", "notify"] as const;

export type Rule = { id: string; name: string; field: (typeof FIELDS)[number]; op: (typeof OPS)[number]; value: string; action: (typeof ACTIONS)[number]; created_at: string };

export async function listRules(): Promise<Rule[]> {
  return Object.values(await getStore().hgetall(KEY)).map((v) => JSON.parse(v) as Rule).sort((a, b) => a.created_at.localeCompare(b.created_at));
}

export async function addRule(user: Actor, b: Record<string, unknown>): Promise<Rule> {
  if (!CAPS.rulesWrite.includes(user.role)) throw new HttpError(403, "Your role cannot create rules.");
  const name = clean(b.name, 80);
  const value = clean(b.value, 80);
  if (!name || !value) throw new HttpError(400, "Name and value are required.");
  if (!FIELDS.includes(b.field as never) || !OPS.includes(b.op as never) || !ACTIONS.includes(b.action as never)) throw new HttpError(400, "Invalid field, operator or action.");
  if ((b.op === ">" || b.op === "<") && !Number.isFinite(Number(value))) throw new HttpError(400, "Numeric operators need a number.");
  const rules = await listRules();
  if (rules.length >= 50) throw new HttpError(409, "Rule limit (50) reached.");
  const rule: Rule = { id: `r_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`, name, field: b.field as Rule["field"], op: b.op as Rule["op"], value, action: b.action as Rule["action"], created_at: new Date().toISOString() };
  await getStore().hset(KEY, rule.id, JSON.stringify(rule));
  await appendAudit({ actor: user.email, action: "rules.create", resource: "rules", target: rule.id, after: rule });
  return rule;
}

export async function removeRule(user: Actor, id: string) {
  if (!CAPS.rulesWrite.includes(user.role)) throw new HttpError(403, "Your role cannot delete rules.");
  const store = getStore();
  if (!(await store.hget(KEY, id))) throw new HttpError(404, "Rule not found.");
  await store.hdel(KEY, id);
  await appendAudit({ actor: user.email, action: "rules.delete", resource: "rules", target: id });
  return { id };
}

export const matches = (row: Record<string, unknown>, r: Pick<Rule, "field" | "op" | "value">) => {
  const v = row[r.field];
  if (v === undefined || v === null) return false;
  if (r.op === ">") return Number(v) > Number(r.value);
  if (r.op === "<") return Number(v) < Number(r.value);
  if (r.op === "=") return String(v).toLowerCase() === r.value.toLowerCase();
  return String(v).toLowerCase().includes(r.value.toLowerCase());
};

/** Executes every rule against all orders. Actions really change data (and are audited under the rule's name). */
export async function runRules(user: Actor) {
  if (!CAPS.rulesWrite.includes(user.role)) throw new HttpError(403, "Your role cannot run rules.");
  const rules = await listRules();
  const orders = (await list(user, "orders", { pageSize: 100, sort: "id", order: "asc" })).data;
  const log: string[] = [];
  let changed = 0;
  for (const rule of rules) {
    for (const o of orders.filter((x) => matches(x, rule))) {
      const label = `workflow:${rule.name} (run by ${user.email})`;
      if (rule.action === "flag_review") {
        if (o.status === "review") { log.push(`#${o.id} ${o.customer}: already in review (${rule.name})`); continue; }
        await update(user, "orders", String(o.id), { status: "review" }, label);
        o.status = "review";
        changed++;
        log.push(`#${o.id} ${o.customer}: flagged for review (${rule.name})`);
      } else {
        await appendAudit({ actor: label, action: "workflow.notify", resource: "orders", target: String(o.id), note: `${rule.name}: ${o.customer} total ${o.total}` });
        log.push(`#${o.id} ${o.customer}: notification recorded (${rule.name})`);
      }
    }
  }
  return { rules: rules.length, changed, log: log.length ? log : ["No rules matched any order."] };
}
