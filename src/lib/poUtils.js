import { base44 } from "@/api/base44Client";

export const formatINR = (amount) => {
  const num = Number(amount || 0);
  return "₹" + num.toLocaleString("en-IN", { maximumFractionDigits: 2 });
};

export const formatDate = (dateStr) => {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
};

export const todayISO = () => new Date().toISOString().split("T")[0];

export const STATUS_COLORS = {
  draft: "bg-slate-100 text-slate-700 border-slate-200",
  pending_approval: "bg-amber-100 text-amber-700 border-amber-200",
  approved: "bg-blue-100 text-blue-700 border-blue-200",
  rejected: "bg-red-100 text-red-700 border-red-200",
  sent_back: "bg-orange-100 text-orange-700 border-orange-200",
  payment_pending: "bg-purple-100 text-purple-700 border-purple-200",
  partially_paid: "bg-indigo-100 text-indigo-700 border-indigo-200",
  fully_paid: "bg-emerald-100 text-emerald-700 border-emerald-200",
  closed: "bg-slate-200 text-slate-600 border-slate-300",
};

export const PAYMENT_STATUS_COLORS = {
  none: "bg-slate-100 text-slate-600 border-slate-200",
  pending: "bg-purple-100 text-purple-700 border-purple-200",
  partial: "bg-indigo-100 text-indigo-700 border-indigo-200",
  paid: "bg-emerald-100 text-emerald-700 border-emerald-200",
};

export const STATUS_LABELS = {
  draft: "Draft",
  pending_approval: "Pending Approval",
  approved: "Approved",
  rejected: "Rejected",
  sent_back: "Sent Back",
  payment_pending: "Payment Pending",
  partially_paid: "Partially Paid",
  fully_paid: "Fully Paid",
  closed: "Closed",
};

export const PAYMENT_STATUS_LABELS = {
  none: "No Payment",
  pending: "Pending",
  partial: "Partial",
  paid: "Paid",
};

export const PO_CATEGORY_LABELS = { capex: "Capex", opex: "Opex" };
export const PO_TYPE_LABELS = { standard: "Standard", open: "Open" };

export const daysOverdue = (dueDate, outstanding) => {
  if (!dueDate || outstanding <= 0) return 0;
  const due = new Date(dueDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);
  const diff = Math.floor((today - due) / (1000 * 60 * 60 * 24));
  return diff > 0 ? diff : 0;
};

export const calcItemAmount = (item) => {
  const qty = Number(item.quantity || 0);
  const rate = Number(item.rate || 0);
  const gst = Number(item.gst_percent || 0);
  const base = qty * rate;
  return { base, gst: base * (gst / 100), total: base + base * (gst / 100) };
};

export const calcTotals = (items) => {
  let subtotal = 0, gstTotal = 0;
  items.forEach((it) => {
    const c = calcItemAmount(it);
    subtotal += c.base;
    gstTotal += c.gst;
  });
  return { subtotal, gstTotal, grandTotal: subtotal + gstTotal };
};

export const generatePONumber = async (instituteCode, category) => {
  const year = new Date().getFullYear();
  const prefix = `${instituteCode}-${category.toUpperCase()}-${year}-`;
  const all = await base44.entities.PurchaseOrder.filter({ po_number: { $regex: prefix } });
  const seq = all.length + 1;
  return `${prefix}${String(seq).padStart(5, "0")}`;
};

export const logAudit = async (entityType, entityId, poNumber, userName, action, oldValue, newValue, remarks = "") => {
  try {
    await base44.entities.AuditLog.create({
      entity_type: entityType,
      entity_id: entityId,
      po_number: poNumber,
      user_name: userName,
      action,
      old_value: String(oldValue || ""),
      new_value: String(newValue || ""),
      remarks,
    });
  } catch (e) {
    console.error("Audit log failed", e);
  }
};