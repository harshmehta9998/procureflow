import React, { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { base44 } from "@/api/base44Client";
import { TRIGGER_EVENTS, isEventCompleted, recalculateMilestoneDueDates, calculateDueDate } from "@/lib/paymentScheduleUtils";
import { formatINR, formatDate, todayISO, logAudit } from "@/lib/poUtils";
import { CheckCircle, Circle, Zap, RefreshCw, AlertTriangle, PackageCheck } from "lucide-react";
import { toast } from "sonner";

export default function TriggerEventsPanel({ po, milestones = [], onEventUpdate, canEdit, userName }) {
  const [customEvent, setCustomEvent] = useState("");
  const [saving, setSaving] = useState(null);
  const [recalculating, setRecalculating] = useState(false);
  const [pendingEvent, setPendingEvent] = useState(null);

  const isDeliveryRelated = (eventKey) => ["delivery", "material_dispatched"].includes(eventKey);

  // Preview which milestones would be affected if this event is marked now
  const affectedMilestones = useMemo(() => {
    if (!pendingEvent) return [];
    const event = TRIGGER_EVENTS.find((e) => e.value === pendingEvent);
    if (!event) return [];
    const previewPo = { ...po, [event.poField]: todayISO() };
    return milestones
      .filter((m) => m.status !== "cancelled" && m.status !== "paid")
      .map((m) => {
        const oldDue = m.due_date;
        const newDue = calculateDueDate({ ...m }, previewPo);
        return { m, oldDue, newDue, changed: newDue && newDue !== oldDue };
      })
      .filter((x) => x.changed);
  }, [pendingEvent, po, milestones]);

  // Update PO event date, then recalculate & persist all affected milestone due dates.
  const applyEventChange = async (eventKey, poUpdate, auditLabel) => {
    setSaving(eventKey);
    try {
      const updatedPo = { ...po, ...poUpdate };
      await base44.entities.PurchaseOrder.update(po.id, poUpdate);

      // Recalculate milestone due dates based on the new event date
      const updates = recalculateMilestoneDueDates(milestones, updatedPo);
      if (updates.length > 0) {
        await base44.entities.PaymentMilestone.bulkUpdate(updates);
        toast.success(`${updates.length} milestone due date(s) recalculated`);
      }
      if (auditLabel) {
        await logAudit("PurchaseOrder", po.id, po.po_number, userName, auditLabel, "", formatDate(Object.values(poUpdate)[0] || todayISO()), "Trigger event updated");
      }
      await onEventUpdate();
    } catch (err) {
      toast.error("Failed to update event");
    } finally {
      setSaving(null);
    }
  };

  const toggleEvent = (eventKey) => {
    if (!canEdit) return;
    const event = TRIGGER_EVENTS.find((e) => e.value === eventKey);
    if (!event || event.auto) return;
    const isDone = isEventCompleted(eventKey, po);
    if (isDone) {
      // Unmarking is safe — no confirmation needed
      applyEventChange(eventKey, { [event.poField]: "" }, `${event.label} Unmarked`).then(() =>
        toast.success(`${event.label} unmarked`)
      );
    } else {
      // Marking requires verification/confirmation
      setPendingEvent(eventKey);
    }
  };

  const confirmPendingEvent = async () => {
    if (!pendingEvent) return;
    const event = TRIGGER_EVENTS.find((e) => e.value === pendingEvent);
    const poUpdate = { [event.poField]: todayISO() };
    const key = pendingEvent;
    setPendingEvent(null);
    await applyEventChange(key, poUpdate, `${event.label} Marked`);
    toast.success(`${event.label} marked complete`);
  };

  const setCustomEventDate = async (date) => {
    if (!canEdit) return;
    setSaving("custom");
    try {
      await base44.entities.PurchaseOrder.update(po.id, { custom_event_date: date, custom_event_name: customEvent || po.custom_event_name || "Custom Event" });
      // Custom event doesn't drive auto milestone calc unless a milestone uses custom_manual trigger
      const updatedPo = { ...po, custom_event_date: date, custom_event_name: customEvent || po.custom_event_name || "Custom Event" };
      const updates = recalculateMilestoneDueDates(milestones, updatedPo);
      if (updates.length > 0) {
        await base44.entities.PaymentMilestone.bulkUpdate(updates);
        toast.success(`${updates.length} milestone(s) recalculated`);
      }
      await onEventUpdate();
      if (date) toast.success("Custom event marked");
    } catch { toast.error("Failed"); }
    finally { setSaving(null); }
  };

  // Manual recalculation button — recompute all milestone due dates from current PO event dates
  const recalcAll = async () => {
    setRecalculating(true);
    try {
      const freshPo = await base44.entities.PurchaseOrder.get(po.id);
      const updates = recalculateMilestoneDueDates(milestones, freshPo);
      if (updates.length > 0) {
        await base44.entities.PaymentMilestone.bulkUpdate(updates);
        toast.success(`${updates.length} milestone(s) recalculated`);
      } else {
        toast.info("All due dates are already up to date");
      }
      await onEventUpdate();
    } catch (err) {
      toast.error("Recalculation failed");
    } finally {
      setRecalculating(false);
    }
  };

  const pendingEventObj = pendingEvent ? TRIGGER_EVENTS.find((e) => e.value === pendingEvent) : null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-amber-500" />
          <h3 className="font-semibold text-slate-800 text-sm">Trigger Events</h3>
          <span className="text-xs text-slate-400">Mark events to auto-recalculate milestone due dates</span>
        </div>
        {canEdit && (
          <Button size="sm" variant="outline" onClick={recalcAll} disabled={recalculating}>
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${recalculating ? "animate-spin" : ""}`} />
            {recalculating ? "Recalculating..." : "Recalculate All"}
          </Button>
        )}
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
        {TRIGGER_EVENTS.map((event) => {
          const done = isEventCompleted(event.value, po);
          if (event.value === "po_created") {
            return (
              <div key={event.value} className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm ${done ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "bg-slate-50 border-slate-200 text-slate-500"}`}>
                <CheckCircle className="w-4 h-4" />
                <span className="font-medium">{event.label}</span>
                <span className="text-xs text-slate-400 ml-auto">{formatDate(po.created_date)}</span>
              </div>
            );
          }
          return (
            <button
              key={event.value}
              onClick={() => toggleEvent(event.value)}
              disabled={!canEdit || saving === event.value}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm text-left transition-colors ${done ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100"} ${!canEdit ? "cursor-default" : "cursor-pointer"}`}
            >
              {done ? <CheckCircle className="w-4 h-4" /> : <Circle className="w-4 h-4 text-slate-300" />}
              <span className="font-medium truncate">{event.label}</span>
              {done && <span className="text-xs text-slate-400 ml-auto">{formatDate(po[event.poField])}</span>}
              {saving === event.value && <span className="text-xs text-slate-400 ml-auto">...</span>}
            </button>
          );
        })}
      </div>

      {/* Custom Event */}
      <div className="border border-slate-200 rounded-lg p-3 space-y-2 bg-slate-50/50">
        <Label className="text-xs font-medium">Custom Event (define your own)</Label>
        <div className="flex gap-2 items-end">
          <div className="flex-1">
            <Input value={customEvent || po.custom_event_name || ""} onChange={(e) => setCustomEvent(e.target.value)} placeholder="e.g. After Government Approval" className="h-9" disabled={!canEdit} />
          </div>
          <Input type="date" value={po.custom_event_date || ""} onChange={(e) => setCustomEventDate(e.target.value)} className="h-9 w-auto" disabled={!canEdit} />
          {po.custom_event_date && canEdit && (
            <Button size="sm" variant="ghost" onClick={() => setCustomEventDate("")}>Clear</Button>
          )}
        </div>
        {po.custom_event_date && (
          <div className="text-xs text-emerald-600 flex items-center gap-1"><CheckCircle className="w-3.5 h-3.5" /> {po.custom_event_name || "Custom Event"} — {formatDate(po.custom_event_date)}</div>
        )}
      </div>

      {/* Verification / Confirmation Modal */}
      {pendingEventObj && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setPendingEvent(null)}>
          <div className="bg-white rounded-xl w-full max-w-md max-h-[90vh] overflow-y-auto p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-9 h-9 rounded-full bg-amber-100 flex items-center justify-center"><AlertTriangle className="w-5 h-5 text-amber-600" /></div>
              <div>
                <h3 className="font-semibold text-slate-800">Confirm Trigger Event</h3>
                <p className="text-xs text-slate-500">Verify before marking as complete</p>
              </div>
            </div>

            <div className="space-y-3 text-sm">
              <div className="bg-slate-50 rounded-lg p-3">
                <div className="font-medium text-slate-800">{pendingEventObj.label}</div>
                <div className="text-xs text-slate-500 mt-0.5">Will be marked complete on {formatDate(todayISO())}.</div>
              </div>

              {/* Stock / quantity verification for delivery-related events */}
              {isDeliveryRelated(pendingEventObj.value) && (po.items || []).length > 0 && (
                <div className="border border-amber-200 rounded-lg p-3 bg-amber-50/50">
                  <div className="flex items-center gap-1.5 text-xs font-medium text-amber-700 mb-2"><PackageCheck className="w-3.5 h-3.5" /> Verify Stock / Quantities</div>
                  <div className="space-y-1 max-h-40 overflow-y-auto">
                    {po.items.map((it, i) => (
                      <div key={i} className="flex justify-between text-xs text-slate-600">
                        <span className="truncate pr-2">{it.item_name || "Item"}</span>
                        <span className="font-medium whitespace-nowrap">{it.quantity} {it.unit} · {formatINR(it.amount)}</span>
                      </div>
                    ))}
                  </div>
                  <div className="text-[11px] text-amber-600 mt-2">Confirm that the received quantity & quality match the PO before proceeding.</div>
                </div>
              )}

              {/* Affected milestones */}
              <div>
                <div className="text-xs font-medium text-slate-600 mb-1">Milestone due dates to be recalculated:</div>
                {affectedMilestones.length === 0 ? (
                  <div className="text-xs text-slate-400">No milestone due dates will change.</div>
                ) : (
                  <div className="space-y-1 max-h-40 overflow-y-auto">
                    {affectedMilestones.map((x) => (
                      <div key={x.m.id} className="flex justify-between text-xs bg-slate-50 rounded px-2 py-1">
                        <span className="truncate pr-2 text-slate-600">{x.m.milestone_name}</span>
                        <span className="whitespace-nowrap text-slate-500">{x.oldDue ? formatDate(x.oldDue) : "—"} → <span className="font-medium text-slate-700">{formatDate(x.newDue)}</span></span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-2 mt-5">
              <Button variant="outline" className="flex-1" onClick={() => setPendingEvent(null)}>Cancel</Button>
              <Button className="flex-1 bg-emerald-600 hover:bg-emerald-700" onClick={confirmPendingEvent}><CheckCircle className="w-4 h-4 mr-1.5" /> Confirm & Mark</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}