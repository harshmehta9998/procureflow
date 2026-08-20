// Central role & approval-authority definitions for ProcureFlow.
//
// The organization operates with the following user types (see the PO Approval
// Workflow functional document): Institutional Admin, Department Admin,
// Department Head, Centre Head, Admin, Finance / Finance Controller,
// Management / Super Admin, and System Administrator.
//
// Legacy app_role values created before this architecture ("admin", "finance")
// are normalized to their canonical equivalents so the rest of the app can key
// off a single value set. No existing account is broken.

export const ROLE_VALUES = [
  "institutional_admin",
  "department_admin",
  "department_head",
  "centre_head",
  "approval_admin",
  "finance_controller",
  "super_admin",
  "system_administrator",
];

export const ROLE_LABELS = {
  institutional_admin: "Institutional Admin",
  department_admin: "Department Admin",
  department_head: "Department Head",
  centre_head: "Centre Head",
  approval_admin: "Admin",
  finance_controller: "Finance Controller",
  super_admin: "Super Admin",
  system_administrator: "System Administrator",
  // legacy aliases (so existing records still render a friendly label)
  admin: "Institutional Admin",
  finance: "Finance Controller",
};

export const ROLE_BADGE = {
  institutional_admin: "bg-blue-100 text-blue-700 border-blue-200",
  admin: "bg-blue-100 text-blue-700 border-blue-200",
  department_admin: "bg-cyan-100 text-cyan-700 border-cyan-200",
  department_head: "bg-teal-100 text-teal-700 border-teal-200",
  centre_head: "bg-amber-100 text-amber-700 border-amber-200",
  approval_admin: "bg-violet-100 text-violet-700 border-violet-200",
  finance_controller: "bg-emerald-100 text-emerald-700 border-emerald-200",
  finance: "bg-emerald-100 text-emerald-700 border-emerald-200",
  super_admin: "bg-purple-100 text-purple-700 border-purple-200",
  system_administrator: "bg-purple-100 text-purple-700 border-purple-200",
};

// Approval authority types an account can be configured to act as.
// Routing is configuration-driven — individual names are never hard-coded.
export const AUTHORITY_TYPES = ["admin", "centre_head", "department_head"];
export const AUTHORITY_LABELS = {
  admin: "Admin",
  centre_head: "Centre Head",
  department_head: "Department Head",
};

// Map any app_role (legacy or canonical) to its canonical value.
export const normalizeRole = (r) => {
  if (!r) return null;
  if (r === "admin") return "institutional_admin";
  if (r === "finance") return "finance_controller";
  return ROLE_VALUES.includes(r) ? r : null;
};

// Platform built-in role that gates RLS admin access. Only Super Admin and
// System Administrator (organization-wide controllers) map to platform "admin";
// every other role is a standard platform "user".
export const platformRoleFor = (appRole) => {
  const c = normalizeRole(appRole);
  return c === "super_admin" || c === "system_administrator" ? "admin" : "user";
};

// Roles that are organization-wide (see all institutions, no mapping needed).
export const isOrgWideRole = (appRole) => {
  const c = normalizeRole(appRole);
  return c === "super_admin" || c === "system_administrator";
};