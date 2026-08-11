import { formatINR } from "./poUtils";

// Payment Request statuses
export const PR_STATUS_LABELS = {
  draft: "Draft",
  pending_centre_head: "Pending Centre Head Approval",
  centre_head_approved: "Centre Head Approved",
  centre_head_rejected: "Centre Head Rejected",
  pending_super_admin: "Pending Super Admin Approval",
  super_admin_approved: "Super Admin Approved",
  super_admin_rejected: "Super Admin Rejected",
  sent_to_finance: "Sent to Finance",
  payment_pending: "Payment Pending",
  paid: "Paid",
  cancelled: "Cancelled",
};

export const PR_STATUS_COLORS = {
  draft: "bg-slate-100 text-slate-700 border-slate-200",
  pending_centre_head: "bg-amber-100 text-amber-700 border-amber-200",
  centre_head_approved: "bg-teal-100 text-teal-700 border-teal-200",
  centre_head_rejected: "bg-red-100 text-red-700 border-red-200",
  pending_super_admin: "bg-blue-100 text-blue-700 border-blue-200",
  super_admin_approved: "bg-cyan-100 text-cyan-700 border-cyan-200",
  super_admin_rejected: "bg-red-100 text-red-700 border-red-200",
  sent_to_finance: "bg-purple-100 text-purple-700 border-purple-200",
  payment_pending: "bg-purple-100 text-purple-700 border-purple-200",
  paid: "bg-emerald-100 text-emerald-700 border-emerald-200",
  cancelled: "bg-rose-100 text-rose-700 border-rose-200",
};

export const PR_EXPENSE_LABELS = {
  petty_cash: "Petty Cash",
  events: "Events",
  outings: "Outings",
  staff_reimbursement: "Staff Reimbursement",
  emergency: "Emergency",
  small_operational: "Small Operational",
  other: "Other",
};

// Recurring payment statuses (shared with PR for approval states)
export const RP_STATUS_LABELS = {
  draft: "Draft",
  pending_centre_head: "Pending Centre Head Approval",
  centre_head_approved: "Centre Head Approved",
  centre_head_rejected: "Centre Head Rejected",
  pending_super_admin: "Pending Super Admin Approval",
  super_admin_approved: "Super Admin Approved",
  super_admin_rejected: "Super Admin Rejected",
  active: "Active",
  paused: "Paused",
  completed: "Completed",
  cancelled: "Cancelled",
};

export const RP_STATUS_COLORS = {
  ...PR_STATUS_COLORS,
  active: "bg-emerald-100 text-emerald-700 border-emerald-200",
  paused: "bg-amber-100 text-amber-700 border-amber-200",
  completed: "bg-slate-200 text-slate-600 border-slate-300",
};

export const RP_CATEGORY_LABELS = {
  rent: "Rent",
  emi: "EMI",
  software_subscription: "Software Subscription",
  maintenance: "Maintenance",
  monthly_service: "Monthly Service",
  other: "Other",
};

export const FREQUENCY_LABELS = {
  monthly: "Monthly",
  quarterly: "Quarterly",
  half_yearly: "Half-Yearly",
  yearly: "Yearly",
};

export const PRBadge = ({ status }) => {
  const color = PR_STATUS_COLORS[status] || PR_STATUS_COLORS.draft;
  const label = PR_STATUS_LABELS[status] || status;
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium border ${color}`}>
      {label}
    </span>
  );
};

export const RPBadge = ({ status }) => {
  const color = RP_STATUS_COLORS[status] || RP_STATUS_COLORS.draft;
  const label = RP_STATUS_LABELS[status] || status;
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium border ${color}`}>
      {label}
    </span>
  );
};

export const PR_INSTANCE_STATUS_COLORS = {
  pending: "bg-amber-100 text-amber-700 border-amber-200",
  paid: "bg-emerald-100 text-emerald-700 border-emerald-200",
  overdue: "bg-red-100 text-red-700 border-red-200",
  cancelled: "bg-slate-200 text-slate-500 border-slate-300",
};

export const PR_INSTANCE_STATUS_LABELS = {
  pending: "Pending",
  paid: "Paid",
  overdue: "Overdue",
  cancelled: "Cancelled",
};

// Recurring instance dynamic status
export const getInstanceStatus = (inst, todayStr) => {
  if (inst.status === "cancelled") return "cancelled";
  if (Number(inst.amount_paid || 0) >= Number(inst.amount || 0) && Number(inst.amount || 0) > 0) return "paid";
  const today = todayStr ? new Date(todayStr) : new Date();
  today.setHours(0, 0, 0, 0);
  if (inst.due_date) {
    const due = new Date(inst.due_date); due.setHours(0, 0, 0, 0);
    if (due < today) return "overdue";
  }
  return "pending";
};

export { formatINR };