import { todayISO } from "./poUtils";

// All supported trigger types. direction: -1 = before event, 0 = on event, 1 = after event
export const TRIGGER_TYPES = [
  { value: "immediately", label: "Immediately (Payable Today)", eventKey: null, hasOffset: false, hasDate: false, direction: 0 },
  { value: "fixed_date", label: "Fixed Calendar Date", eventKey: null, hasOffset: false, hasDate: true, direction: 0 },
  { value: "x_days_from_approval", label: "X Days From PO Approval", eventKey: "po_approved", hasOffset: true, hasDate: false, direction: 1 },
  { value: "x_days_from_creation", label: "X Days From PO Creation", eventKey: "po_created", hasOffset: true, hasDate: false, direction: 1 },
  { value: "before_delivery", label: "Before Delivery", eventKey: "delivery", hasOffset: true, hasDate: false, direction: -1 },
  { value: "on_delivery", label: "On Delivery", eventKey: "delivery", hasOffset: false, hasDate: false, direction: 0 },
  { value: "x_days_after_delivery", label: "X Days After Delivery", eventKey: "delivery", hasOffset: true, hasDate: false, direction: 1 },
  { value: "before_installation", label: "Before Installation", eventKey: "installation_completed", hasOffset: true, hasDate: false, direction: -1 },
  { value: "on_installation", label: "On Installation", eventKey: "installation_completed", hasOffset: false, hasDate: false, direction: 0 },
  { value: "x_days_after_installation", label: "X Days After Installation", eventKey: "installation_completed", hasOffset: true, hasDate: false, direction: 1 },
  { value: "before_completion", label: "Before Completion", eventKey: "project_completed", hasOffset: true, hasDate: false, direction: -1 },
  { value: "on_completion", label: "On Completion", eventKey: "project_completed", hasOffset: false, hasDate: false, direction: 0 },
  { value: "x_days_after_completion", label: "X Days After Completion", eventKey: "project_completed", hasOffset: true, hasDate: false, direction: 1 },
  { value: "monthly", label: "Monthly", eventKey: "po_approved", hasOffset: true, hasDate: false, direction: 1, recurring: "monthly" },
  { value: "quarterly", label: "Quarterly", eventKey: "po_approved", hasOffset: true, hasDate: false, direction: 1, recurring: "quarterly" },
  { value: "half_yearly", label: "Half Yearly", eventKey: "po_approved", hasOffset: true, hasDate: false, direction: 1, recurring: "half_yearly" },
  { value: "yearly", label: "Yearly", eventKey: "po_approved", hasOffset: true, hasDate: false, direction: 1, recurring: "yearly" },
  { value: "subscription_renewal", label: "Subscription Renewal", eventKey: "po_approved", hasOffset: true, hasDate: false, direction: 1, recurring: "yearly" },
  { value: "custom_manual", label: "Custom Manual Trigger", eventKey: "custom_manual", hasOffset: false, hasDate: false, direction: 0 },
];

// System trigger events that can be marked complete on a PO
export const TRIGGER_EVENTS = [
  { value: "po_created", label: "PO Created", poField: "created_date", auto: true },
  { value: "po_approved", label: "PO Approved", poField: "approved_date" },
  { value: "work_started", label: "Work Started", poField: "work_started_date" },
  { value: "material_dispatched", label: "Material Dispatched", poField: "material_dispatched_date" },
  { value: "delivery", label: "Material Delivered", poField: "delivery_date" },
  { value: "installation_started", label: "Installation Started", poField: "installation_started_date" },
  { value: "installation_completed", label: "Installation Completed", poField: "installation_completed_date" },
  { value: "service_started", label: "Service Started", poField: "service_started_date" },
  { value: "service_completed", label: "Service Completed", poField: "service_completed_date" },
  { value: "project_completed", label: "Project Completed", poField: "project_completed_date" },
  { value: "invoice_received", label: "Invoice Received", poField: "invoice_received_date" },
  { value: "vendor_certified", label: "Vendor Certified", poField: "vendor_certified_date" },
];

export const MILESTONE_STATUS_LABELS = {
  pending: "Pending",
  waiting_for_trigger: "Waiting for Trigger",
  due_today: "Due Today",
  upcoming: "Upcoming",
  partially_paid: "Partially Paid",
  paid: "Paid",
  overdue: "Overdue",
  cancelled: "Cancelled",
};

export const MILESTONE_STATUS_COLORS = {
  pending: "bg-slate-100 text-slate-700 border-slate-200",
  waiting_for_trigger: "bg-blue-100 text-blue-700 border-blue-200",
  due_today: "bg-amber-100 text-amber-700 border-amber-200",
  upcoming: "bg-purple-100 text-purple-700 border-purple-200",
  partially_paid: "bg-indigo-100 text-indigo-700 border-indigo-200",
  paid: "bg-emerald-100 text-emerald-700 border-emerald-200",
  overdue: "bg-red-100 text-red-700 border-red-200",
  cancelled: "bg-slate-200 text-slate-500 border-slate-300",
};

export const MILESTONE_BADGES = {
  pending: { color: "bg-slate-100 text-slate-600", dot: "bg-slate-400" },
  waiting_for_trigger: { color: "bg-blue-100 text-blue-700", dot: "bg-blue-500" },
  due_today: { color: "bg-amber-100 text-amber-700", dot: "bg-amber-500" },
  upcoming: { color: "bg-purple-100 text-purple-700", dot: "bg-purple-500" },
  partially_paid: { color: "bg-indigo-100 text-indigo-700", dot: "bg-indigo-500" },
  paid: { color: "bg-emerald-100 text-emerald-700", dot: "bg-emerald-500" },
  overdue: { color: "bg-red-100 text-red-700", dot: "bg-red-500" },
  cancelled: { color: "bg-slate-200 text-slate-500", dot: "bg-slate-300" },
};

export const getTriggerType = (value) => TRIGGER_TYPES.find((t) => t.value === value);
export const getTriggerEvent = (value) => TRIGGER_EVENTS.find((e) => e.value === value);

// Get the date for a trigger event from the PO (or milestone for custom_manual)
export const getEventDate = (eventKey, po, milestone) => {
  if (eventKey === "custom_manual") return milestone?.actual_trigger_date || null;
  const event = getTriggerEvent(eventKey);
  if (!event || !event.poField) return null;
  return po?.[event.poField] || null;
};

// Calculate the due date for a milestone based on its trigger type and PO event dates
export const calculateDueDate = (milestone, po) => {
  const tt = getTriggerType(milestone.trigger_type);
  if (!tt) return null;

  if (tt.value === "immediately") return todayISO();
  if (tt.value === "fixed_date") return milestone.fixed_date || null;

  const eventDateStr = getEventDate(tt.eventKey, po, milestone);
  if (!eventDateStr) return null;

  const eventDate = new Date(eventDateStr);
  if (isNaN(eventDate.getTime())) return null;

  const offset = Number(milestone.offset_days || 0);
  const dueDate = new Date(eventDate);

  if (tt.direction === -1) dueDate.setDate(dueDate.getDate() - offset);
  else if (tt.direction === 1) dueDate.setDate(dueDate.getDate() + offset);

  return dueDate.toISOString().split("T")[0];
};

// Determine the dynamic status of a milestone
export const getMilestoneStatus = (milestone, po, todayStr) => {
  if (milestone.status === "cancelled") return "cancelled";

  const paid = Number(milestone.amount_paid || 0);
  const outstanding = Number(milestone.outstanding_amount ?? 0);
  const calcAmount = Number(milestone.calculated_amount || 0);

  if (calcAmount > 0 && paid >= calcAmount) return "paid";
  if (paid > 0 && outstanding > 0) return "partially_paid";

  const today = todayStr ? new Date(todayStr) : new Date();
  today.setHours(0, 0, 0, 0);

  const dueDate = milestone.due_date;
  if (!dueDate) {
    const tt = getTriggerType(milestone.trigger_type);
    if (tt && tt.eventKey && !["custom_manual", "immediately", "fixed_date"].includes(tt.value)) {
      const eventDate = getEventDate(tt.eventKey, po, milestone);
      if (!eventDate) return "waiting_for_trigger";
    }
    return "pending";
  }

  const due = new Date(dueDate);
  due.setHours(0, 0, 0, 0);
  const diff = Math.floor((due - today) / (1000 * 60 * 60 * 24));

  if (diff < 0) return "overdue";
  if (diff === 0) return "due_today";
  if (diff <= 7) return "upcoming";
  return "pending";
};

// Compute the actual money amount for a milestone
export const calcMilestoneAmount = (milestone, grandTotal) => {
  if (milestone.amount_type === "percentage") {
    return Math.round((Number(milestone.amount || 0) / 100) * Number(grandTotal || 0) * 100) / 100;
  }
  return Number(milestone.amount || 0);
};

// Compute overall PO payment status from milestone statuses
export const computePOPaymentStatus = (milestones, po) => {
  if (!milestones || milestones.length === 0) return "none";
  const active = milestones.filter((m) => m.status !== "cancelled");
  if (active.length === 0) return "none";
  const statuses = active.map((m) => getMilestoneStatus(m, po));
  if (statuses.every((s) => s === "paid")) return "paid";
  if (statuses.some((s) => ["paid", "partially_paid"].includes(s))) return "partial";
  return "pending";
};

// Compute total paid and outstanding from milestones
export const computePOTotals = (milestones) => {
  const active = (milestones || []).filter((m) => m.status !== "cancelled");
  const totalPaid = active.reduce((s, m) => s + Number(m.amount_paid || 0), 0);
  const totalAmount = active.reduce((s, m) => s + Number(m.calculated_amount || 0), 0);
  return { totalPaid, totalOutstanding: Math.max(0, totalAmount - totalPaid), totalAmount };
};

// Build a default empty milestone
export const createEmptyMilestone = (orderIndex = 0) => ({
  milestone_name: "",
  description: "",
  amount_type: "fixed",
  amount: 0,
  calculated_amount: 0,
  trigger_type: "x_days_from_approval",
  custom_trigger_name: "",
  offset_days: 0,
  fixed_date: "",
  due_date: null,
  original_due_date: null,
  override_reason: "",
  status: "pending",
  actual_trigger_date: "",
  amount_paid: 0,
  outstanding_amount: 0,
  remarks: "",
  order_index: orderIndex,
});

// Check if a trigger event is completed for a PO
export const isEventCompleted = (eventKey, po, milestone) => {
  const date = getEventDate(eventKey, po, milestone);
  return !!date;
};

// Recalculate due dates for all active milestones based on current PO event dates.
// Returns an array of { id, due_date, original_due_date } for milestones whose due date changed.
export const recalculateMilestoneDueDates = (milestones, po) => {
  const updates = [];
  for (const m of (milestones || [])) {
    if (m.status === "cancelled" || m.status === "paid") continue;
    const newDue = calculateDueDate(m, po);
    if (newDue && newDue !== m.due_date) {
      updates.push({
        id: m.id,
        due_date: newDue,
        original_due_date: m.original_due_date || newDue,
        outstanding_amount: m.outstanding_amount ?? m.calculated_amount ?? 0,
      });
    }
  }
  return updates;
};