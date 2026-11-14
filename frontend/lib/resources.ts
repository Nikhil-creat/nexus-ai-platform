// Single schema shared by the UI (tables + forms) and the server (validation + RBAC).
export type Role = "admin" | "editor" | "viewer";
export type FieldType = "text" | "longtext" | "number" | "currency" | "badge" | "datetime" | "email";
export type Action = "list" | "create" | "edit" | "delete";

export type FieldDef = {
  name: string;
  type: FieldType;
  label?: string;
  required?: boolean;
  editable?: boolean; // can be set through create/update
  enum?: string[];
  min?: number;
  max?: number;
  maxLength?: number;
};

export type ResourceDef = {
  name: string;
  label: string;
  fields: FieldDef[];
  perms: Record<Action, Role[]>;
  searchFields: string[];
  defaultSort: { field: string; order: "asc" | "desc" };
};

const ALL: Role[] = ["admin", "editor", "viewer"];
const WRITE: Role[] = ["admin", "editor"];

export const ORDER_STATUS = ["pending", "paid", "review", "refunded", "cancelled"];
export const USER_ROLES: Role[] = ["admin", "editor", "viewer"];
export const USER_STATUS = ["active", "inactive", "suspended"];

export const RESOURCES: Record<string, ResourceDef> = {
  orders: {
    name: "orders",
    label: "Orders",
    fields: [
      { name: "id", type: "number" },
      { name: "customer", type: "text", required: true, editable: true, maxLength: 80 },
      { name: "total", type: "currency", required: true, editable: true, min: 0, max: 1_000_000_000 },
      { name: "status", type: "badge", editable: true, enum: ORDER_STATUS },
      { name: "created_at", type: "datetime" },
    ],
    perms: { list: ALL, create: WRITE, edit: WRITE, delete: ["admin"] },
    searchFields: ["customer", "status"],
    defaultSort: { field: "id", order: "desc" },
  },
  users: {
    name: "users",
    label: "Users",
    fields: [
      { name: "id", type: "text" },
      { name: "email", type: "email" },
      { name: "role", type: "badge", editable: true, enum: USER_ROLES },
      { name: "status", type: "badge", editable: true, enum: USER_STATUS },
      { name: "created_at", type: "datetime" },
    ],
    perms: { list: ["admin"], create: [], edit: ["admin"], delete: ["admin"] },
    searchFields: ["email", "role", "status"],
    defaultSort: { field: "created_at", order: "desc" },
  },
  messages: {
    name: "messages",
    label: "Inbox",
    fields: [
      { name: "id", type: "number" },
      { name: "name", type: "text" },
      { name: "email", type: "email" },
      { name: "message", type: "longtext" },
      { name: "created_at", type: "datetime" },
    ],
    perms: { list: ["admin"], create: [], edit: [], delete: ["admin"] },
    searchFields: ["name", "email", "message"],
    defaultSort: { field: "id", order: "desc" },
  },
  usage: {
    name: "usage",
    label: "LLM FinOps",
    fields: [
      { name: "id", type: "text", label: "user" },
      { name: "requests", type: "number" },
      { name: "tokens", type: "number" },
      { name: "cost_usd", type: "currency", label: "est. cost" },
    ],
    perms: { list: WRITE, create: [], edit: [], delete: [] },
    searchFields: ["id"],
    defaultSort: { field: "tokens", order: "desc" },
  },
};

export const can = (role: Role | undefined, resource: string, action: Action) =>
  !!role && !!RESOURCES[resource]?.perms[action].includes(role);

/** Non-resource capabilities. */
export const CAPS = {
  knowledgeWrite: WRITE,
  rulesWrite: WRITE,
  seed: ["admin"] as Role[],
  probe: ["admin"] as Role[],
};
