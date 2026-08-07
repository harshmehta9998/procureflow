import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { base44 } from "@/api/base44Client";
import {
  getMilestoneStatus, MILESTONE_STATUS_LABELS, MILESTONE_BADGES, getTriggerType,
  calculateDueDate, calcMilestoneAmount, TRIGGER_TYPES,
} from "@/lib/paymentScheduleUtils";
import { formatINR, formatDate, todayISO } from "@/lib/poUtils";
import { logAudit } from "@/lib/poUtils";
import { Wallet, Calendar, Pencil, Trash2, X, AlertTriangle, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import MilestonePaymentModal from "./MilestonePaymentModal";

export default function ScheduleView({ po, milestones, payments, userName, isFinance, isInstituteAdmin, onRefresh }) {
  const [payingMilestone, setPayingMilestone] = useState(null);
  const [overridingId, setOverridingId] = useState(null);
  const [override, setOverride] = useState({ new_date: "", reason: "" });
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});

  const canManageSchedule = isInstituteAdmin && ["draft", "pending_approval", "sent_back"].includes(po.status);
  const canRecordPayment = isFinance;

  const sortedMs = [...milestones].sort((a, b) => (a.order_index || 0) - (b.order_index || 0));

  const startOverride = (m) => {
    setOverridingId(m.id);
    setOverride({ new_date: m.due_date || "", reason: "" });
  };

  const saveOverride = async (m) => {
    if (!override.new_date) return toast.error("Select new date");
    if (!override.reason) return toast.error("Reason required for override");
    try {
      const original = m.due_date || calculateDueDate(m, po) || "";
      await base44.entities.PaymentMilestone.update(m.id, {
        original_due_date: m.original_due_date || original || m.due_date,
        due_date: override.new_date,
        override_reason: override.reason,
        override_by: userName,
        override_date: new Date().toISOString(),
      });
      await logAudit("PaymentMilestone", m.id, po.po_number, userName, "Due Date Override", original, override.new_date, override.reason);
      toast.success("Due date overridden");
      setOverridingId(null);
      onRefresh();
    } catch (err) { toast.error("Override failed"); }
  };

  const recalculateAll = async () => {
    try {
      for (const m of sortedMs) {
        if (m.status === "cancelled" || m.status === "paid") continue;
        const newDue = calculateDueDate(m, po);
        if (newDue && newDue !== m.due_date) {
          await base44.entities.PaymentMilestone.update(m.id, { due_date: newDue, original_due_date: m.original_due_date || m.due_date });
        }
      }
      await onRefresh();
      toast.success("Milestone due dates recalculated");
    } catch { toast.error("Recalculation failed"); }
  };

  const startEdit = (m) => {
    setEditingId(m.id);
    setEditForm({ ...m });
  };

  const saveEdit = async () => {
    try {
      const tt = getTriggerType(editForm.trigger_type);
      const updated = {
        milestone_name: editForm.milestone_name,
        description: editForm.description,
        amount_type: editForm.amount_type,
        amount: Number(editForm.amount),
        calculated_amount: calcMilestoneAmount(editForm, po.grand_total),
        trigger_type: editForm.trigger_type,
        custom_trigger_name: editForm.custom_trigger_name,
        offset_days: Number(editForm.offset_days || 0),
        fixed_date: editForm.fixed_date,
        remarks: editForm.remarks,
      };
      updated.outstanding_amount = (updated.calculated_amount || 0) - (editForm.amount_paid || 0);
      await base44.entities.PaymentMilestone.update(editingId, updated);
      await logAudit("PaymentMilestone", editingId, po.po_number, userName, "Milestone Updated", "", "", "Milestone edited");
      toast.success("Milestone updated");
      setEditingId(null);
      onRefresh();
    } catch (err) { toast.error("Update failed"); }
  };

  const deleteMilestone = async (m) => {
    if (!confirm(`Delete milestone "${m.milestone_name}"?`)) return;
    try {
      await base44.entities.PaymentMilestone.delete(m.id);
      await logAudit("PaymentMilestone", m.id, po.po_number, userName, "Milestone Deleted", m.milestone_name, "", "Milestone removed");
      toast.success("Milestone deleted");
      onRefresh();
    } catch { toast.error("Delete failed"); }
  };

  const cancelMilestone = async (m) => {
    try {
      await base44.entities.PaymentMilestone.update(m.id, { status: "cancelled" });
      await logAudit("PaymentMilestone", m.id, po.po_number, userName, "Milestone Cancelled", m.milestone_name, "Cancelled", "");
      toast.success("Milestone cancelled");
      onRefresh();
    } catch { toast.error("Failed"); }
  };

  return (
    <div className="space-y-4">
      {/* Schedule Table */}
      {sortedMs.length === 0 ? (
        <div className="text-center py-10 border-2 border-dashed border-slate-200 rounded-xl">
          <Calendar className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <p className="text-sm text-slate-400">No payment schedule milestones defined for this PO.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500 uppercase">
              <tr>
                <th className="text-left px-3 py-2.5 font-medium">#</th>
                <th className="text-left px-3 py-2.5 font-medium">Milestone</th>
                <th className="text-left px-3 py-2.5 font-medium">Trigger</th>
                <th className="text-right px-3 py-2.5 font-medium">Amount</th>
                <th className="text-left px-3 py-2.5 font-medium">Due Date</th>
                <th className="text-left px-3 py-2.5 font-medium">Status</th>
                <th className="text-right px-3 py-2.5 font-medium">Paid</th>
                <th className="text-center px-3 py-2.5 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sortedMs.map((m, idx) => {
                const status = getMilestoneStatus(m, po);
                const badge = MILESTONE_BADGES[status];
                const tt = getTriggerType(m.trigger_type);
                const msPays = payments.filter((p) => p.milestone_id === m.id);
                const hasOverride = m.original_due_date && m.due_date && m.original_due_date !== m.due_date;

                if (editingId === m.id) {
                  return (
                    <tr key={m.id} className="bg-blue-50/50">
                      <td colSpan={8} className="p-3">
                        <div className="space-y-3">
                          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                            <div><Label className="text-xs">Name</Label><Input value={editForm.milestone_name} onChange={(e) => setEditForm({ ...editForm, milestone_name: e.target.value })} className="h-9 mt-1" /></div>
                            <div>
                              <Label className="text-xs">Amount Type</Label>
                              <Select value={editForm.amount_type} onValueChange={(v) => setEditForm({ ...editForm, amount_type: v })}>
                                <SelectTrigger className="h-9 mt-1"><SelectValue /></SelectTrigger>
                                <SelectContent><SelectItem value="fixed">Fixed</SelectItem><SelectItem value="percentage">Percentage</SelectItem></SelectContent>
                              </Select>
                            </div>
                            <div><Label className="text-xs">{editForm.amount_type === "percentage" ? "Percentage (%)" : "Amount (₹)"}</Label><Input type="number" value={editForm.amount} onChange={(e) => setEditForm({ ...editForm, amount: e.target.value })} className="h-9 mt-1" /></div>
                            <div>
                              <Label className="text-xs">Trigger Type</Label>
                              <Select value={editForm.trigger_type} onValueChange={(v) => setEditForm({ ...editForm, trigger_type: v })}>
                                <SelectTrigger className="h-9 mt-1"><SelectValue /></SelectTrigger>
                                <SelectContent className="max-h-60">{TRIGGER_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                              </Select>
                            </div>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <div><Label className="text-xs">Offset Days</Label><Input type="number" value={editForm.offset_days || 0} onChange={(e) => setEditForm({ ...editForm, offset_days: e.target.value })} className="h-9 mt-1" /></div>
                            {editForm.trigger_type === "fixed_date" && <div><Label className="text-xs">Fixed Date</Label><Input type="date" value={editForm.fixed_date || ""} onChange={(e) => setEditForm({ ...editForm, fixed_date: e.target.value })} className="h-9 mt-1" /></div>}
                            {editForm.trigger_type === "custom_manual" && <div><Label className="text-xs">Custom Trigger Name</Label><Input value={editForm.custom_trigger_name || ""} onChange={(e) => setEditForm({ ...editForm, custom_trigger_name: e.target.value })} className="h-9 mt-1" /></div>}
                            <div><Label className="text-xs">Description</Label><Input value={editForm.description || ""} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} className="h-9 mt-1" /></div>
                          </div>
                          <div className="flex gap-2">
                            <Button size="sm" onClick={saveEdit}>Save</Button>
                            <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>Cancel</Button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                }

                return (
                  <tr key={m.id} className="hover:bg-slate-50/50">
                    <td className="px-3 py-3 text-slate-400 font-medium">{idx + 1}</td>
                    <td className="px-3 py-3">
                      <div className="font-medium text-slate-800">{m.milestone_name}</div>
                      {m.description && <div className="text-xs text-slate-400 mt-0.5">{m.description}</div>}
                      {m.custom_trigger_name && <div className="text-xs text-blue-500 mt-0.5">Custom: {m.custom_trigger_name}</div>}
                      {msPays.length > 1 && <div className="text-xs text-slate-400 mt-0.5">{msPays.length} payments</div>}
                    </td>
                    <td className="px-3 py-3 text-xs text-slate-500">
                      <div>{tt?.label || m.trigger_type}</div>
                      {tt?.hasOffset && Number(m.offset_days) !== 0 && <div className="text-slate-400">{tt.direction === -1 ? `${m.offset_days} days before` : `${m.offset_days} days after`}</div>}
                      {hasOverride && <div className="text-amber-600 text-[10px] mt-0.5">⚠ Overridden (was {formatDate(m.original_due_date)})</div>}
                    </td>
                    <td className="px-3 py-3 text-right">
                      <div className="font-medium text-slate-700">{formatINR(m.calculated_amount || 0)}</div>
                      {m.amount_type === "percentage" && <div className="text-xs text-slate-400">{m.amount}% of total</div>}
                    </td>
                    <td className="px-3 py-3">
                      {overridingId === m.id ? (
                        <div className="space-y-1">
                          <Input type="date" value={override.new_date} onChange={(e) => setOverride({ ...override, new_date: e.target.value })} className="h-8 text-xs" />
                          <Input value={override.reason} onChange={(e) => setOverride({ ...override, reason: e.target.value })} placeholder="Reason *" className="h-8 text-xs" />
                          <div className="flex gap-1">
                            <Button size="sm" className="h-7 text-xs" onClick={() => saveOverride(m)}>Save</Button>
                            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setOverridingId(null)}>Cancel</Button>
                          </div>
                        </div>
                      ) : (
                        <div>
                          <div className="text-sm">{formatDate(m.due_date)}</div>
                          {hasOverride && <div className="text-[10px] text-amber-600">by {m.override_by}</div>}
                          {!m.due_date && status === "waiting_for_trigger" && <div className="text-xs text-blue-500">Awaiting trigger</div>}
                          {!m.due_date && status === "pending" && <div className="text-xs text-slate-400">Not calculated</div>}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${badge.color}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${badge.dot}`} />
                        {MILESTONE_STATUS_LABELS[status]}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right">
                      <div className="text-emerald-600 font-medium">{formatINR(m.amount_paid || 0)}</div>
                      <div className="text-xs text-amber-600">{formatINR(m.outstanding_amount || 0)} outstanding</div>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center justify-center gap-1">
                        {canRecordPayment && m.status !== "cancelled" && m.status !== "paid" && (m.outstanding_amount || 0) > 0 && (
                          <button onClick={() => setPayingMilestone(m)} className="p-1.5 text-slate-600 hover:bg-slate-100 rounded" title="Record Payment"><Wallet className="w-4 h-4" /></button>
                        )}
                        {canManageSchedule && (
                          <>
                            <button onClick={() => startOverride(m)} className="p-1.5 text-slate-500 hover:bg-slate-100 rounded" title="Override Due Date"><Calendar className="w-4 h-4" /></button>
                            <button onClick={() => startEdit(m)} className="p-1.5 text-blue-500 hover:bg-blue-50 rounded" title="Edit"><Pencil className="w-4 h-4" /></button>
                            <button onClick={() => deleteMilestone(m)} className="p-1.5 text-red-400 hover:bg-red-50 rounded" title="Delete"><Trash2 className="w-4 h-4" /></button>
                          </>
                        )}
                        {isFinance && m.status !== "cancelled" && m.status !== "paid" && (
                          <button onClick={() => cancelMilestone(m)} className="p-1.5 text-slate-400 hover:bg-slate-100 rounded" title="Cancel"><X className="w-4 h-4" /></button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Schedule summary */}
      {sortedMs.length > 0 && (
        <div className="flex flex-wrap items-center gap-4 bg-slate-50 rounded-lg px-4 py-3 text-sm">
          <div><span className="text-slate-500">Total Scheduled: </span><span className="font-semibold">{formatINR(sortedMs.reduce((s, m) => s + (m.calculated_amount || 0), 0))}</span></div>
          <div><span className="text-slate-500">Total Paid: </span><span className="font-semibold text-emerald-600">{formatINR(sortedMs.reduce((s, m) => s + (m.amount_paid || 0), 0))}</span></div>
          <div><span className="text-slate-500">Outstanding: </span><span className="font-semibold text-amber-600">{formatINR(sortedMs.reduce((s, m) => s + (m.outstanding_amount || 0), 0))}</span></div>
          {canManageSchedule && (
            <Button size="sm" variant="outline" onClick={recalculateAll} className="ml-auto"><CheckCircle className="w-3.5 h-3.5 mr-1" /> Recalculate Due Dates</Button>
          )}
        </div>
      )}

      {/* Override audit info */}
      {sortedMs.some((m) => m.original_due_date && m.original_due_date !== m.due_date) && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2 text-xs text-amber-700">
          <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <div>
            <span className="font-medium">Due Date Overrides:</span> Some milestones have overridden due dates. Original dates and reasons are stored in the audit trail.
            {sortedMs.filter((m) => m.original_due_date && m.original_due_date !== m.due_date).map((m) => (
              <div key={m.id} className="mt-1">• {m.milestone_name}: {formatDate(m.original_due_date)} → {formatDate(m.due_date)} — "{m.override_reason}" by {m.override_by}</div>
            ))}
          </div>
        </div>
      )}

      {payingMilestone && (
        <MilestonePaymentModal milestone={payingMilestone} po={po} userName={userName} onClose={() => setPayingMilestone(null)} onPaid={async () => { await onRefresh(); }} />
      )}
    </div>
  );
}