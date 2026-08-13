import React, { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { base44 } from "@/api/base44Client";
import { TRIGGER_EVENTS, isEventCompleted, recalculateMilestoneDueDates, calculateDueDate } from "@/lib/paymentScheduleUtils";
import { formatINR, formatDate, todayISO, logAudit } from "@/lib/poUtils";
import { CheckCircle, Circle, Zap, RefreshCw, AlertTriangle, PackageCheck } from "lucide-react";
import { toast } from "sonner";

export default function TriggerEventsPanel({ po, milestones = [], onEventUpdate, canEdit, userName, isSuperAdmin }) {
  const [customEvent, setCustomEvent] = useState("");
  const [saving, setSaving] = useState(null);
  const [recalculating, setRecalculating] = useState(false);
  const [pendingEvent, setPendingEvent] = useState(null);
  const [receivedQtys, setReceivedQtys] = useState([]);
  const [verifying, setVerifying] = useState(false);

  const isDeliveryRelated = (eventKey) => ["delivery", "material_dispatched"].includes(eventKey);

  // GST + payable auto-calc per item based on received quantity
  const payableFor = (item, qty) => {
    const q = Number(qty) || 0;
    const base = q * (item.rate || 0);
    const gst = base * ((item.gst_percent || 0) / 100);
    return { base, gst, total: base + gst };
  };

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

  const deliveryTotals = useMemo(() => {
    return (po.items || []).reduce((acc, item, i) => {
      const { base, gst, total } = payableFor(item, receivedQtys[i] ?? item.quantity);
      acc.baseTotal += base; acc.gstTotal += gst; acc.grandTotal += total;
      const diff = (receivedQtys[i] ?? item.quantity) - (item.quantity || 0);
      if (diff < 0) acc.shortCount += 1;
      if (diff > 0) acc.excessCount += 1;
      return acc;
    }, { baseTotal: 0, gstTotal: 0, grandTotal: 0, shortCount: 0, excessCount: 0 });
  }, [po, receivedQtys]);

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
      // Once a trigger has been activated, only Super Admin can cancel/deactivate it.
      if (!isSuperAdmin) {
        toast.error("Only Super Admin can cancel an activated trigger");
        return;
      }
      // Clearing a delivery-related event also resets its verified delivery records
      // so the payable/outstanding reverts to the PO value.
      if (isDeliveryRelated(eventKey)) {
        base44.entities.DeliveryVerification.deleteMany({ po_id: po.id }).catch(() => {});
      }
      applyEventChange(eventKey, { [event.poField]: "" }, `${event.label} Unmarked`).then(() =>
        toast.success(`${event.label} unmarked`)
      );
    } else {
      setPendingEvent(eventKey);
      if (isDeliveryRelated(eventKey)) {
        setReceivedQtys((po.items || []).map((i) => i.quantity || 0));
      }
    }
  };

  // Confirm a trigger event. For delivery-related events, first record verified quantities
  // (with GST auto-calculated) as DeliveryVerification records, then mark the event.
  const confirmPendingEvent = async () => {
    if (!pendingEvent) return;
    const event = TRIGGER_EVENTS.find((e) => e.value === pendingEvent);
    const key = pendingEvent;
    let deliveryOutstanding = null;
    let msSync = [];

    if (isDeliveryRelated(key)) {
      setVerifying(true);
      try {
        const items = po.items || [];
        const today = todayISO();
        const records = items.map((item, i) => {
          const received = Number(receivedQtys[i] ?? item.quantity) || 0;
          const poQty = item.quantity || 0;
          const short = Math.max(0, poQty - received);
          const excess = Math.max(0, received - poQty);
          const { total } = payableFor(item, received);
          const action = short > 0 ? "receive_balance_later" : excess > 0 ? "return_excess" : "close_with_received";
          return {
            po_id: po.id, po_number: po.po_number, institute_id: po.institute_id, institute_name: po.institute_name,
            vendor_id: po.vendor_id, vendor_name: po.vendor_name,
            item_name: item.item_name || "Item", po_quantity: poQty, received_quantity: received,
            short_quantity: short, excess_quantity: excess, accepted_quantity: received, returned_quantity: 0,
            unit_price: item.rate || 0, payable_amount: Math.round(total * 100) / 100,
            delivery_date: today, action_taken: action, balance_pending: short,
            verified_by_name: userName, status: short > 0 ? "balance_pending" : "verified",
          };
        });
        // Idempotent: clear any previous delivery verifications so re-verifying never
        // accumulates duplicate payable amounts (fixes trigger toggle increasing value).
        await base44.entities.DeliveryVerification.deleteMany({ po_id: po.id });
        if (records.length > 0) {
          await base44.entities.DeliveryVerification.bulkCreate(records);
        }
        // Sync milestone amounts + PO outstanding to the verified payable (received qty),
        // so Finance Calendar / Dashboard / Reports reflect the actual received quantity.
        const verifiedTotal = records.reduce((s, r) => s + (r.payable_amount || 0), 0);
        const paidSoFar = po.amount_paid || 0;
        msSync = (milestones || [])
          .filter((m) => m.status !== "cancelled" && m.status !== "paid")
          .map((m) => {
            const newCalc = m.amount_type === "percentage"
              ? Math.round((Number(m.amount || 0) / 100) * verifiedTotal * 100) / 100
              : Number(m.calculated_amount || 0);
            return { id: m.id, calculated_amount: newCalc, outstanding_amount: Math.max(0, newCalc - (m.amount_paid || 0)) };
          });
        deliveryOutstanding = Math.max(0, verifiedTotal - paidSoFar);
        await logAudit("DeliveryVerification", po.id, po.po_number, userName, `${event.label} — Quantity Verified`, "", `${records.length} item(s) · ${formatINR(verifiedTotal)}`, "Auto GST on received qty; milestones & PO outstanding synced");
        toast.success(`Delivery verified — ${records.length} item(s), payable ${formatINR(verifiedTotal)} (GST auto-calculated)`);
      } catch (err) {
        toast.error("Quantity verification failed");
        setVerifying(false);
        return;
      } finally {
        setVerifying(false);
      }
    }

    const poUpdate = { [event.poField]: todayISO() };
    if (deliveryOutstanding !== null) poUpdate.outstanding_amount = deliveryOutstanding;
    setPendingEvent(null);
    // Set the PO event date + recalc milestone due dates.
    await applyEventChange(key, poUpdate, `${event.label} Marked`);
    // Re-apply the verified-payable sync AFTER due-date recalc so outstanding_amount
    // isn't reverted by the recalc step (which uses stale milestone data).
    if (msSync.length) {
      await base44.entities.PaymentMilestone.bulkUpdate(msSync);
      await onEventUpdate();
    }
    toast.success(`${event.label} marked complete`);
  };

  const setCustomEventDate = async (date) => {
    if (!canEdit) return;
    setSaving("custom");
    try {
      await base44.entities.PurchaseOrder.update(po.id, { custom_event_date: date, custom_event_name: customEvent || po.custom_event_name || "Custom Event" });
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
  const isDeliveryEvent = pendingEventObj && isDeliveryRelated(pendingEventObj.value);

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
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => !verifying && setPendingEvent(null)}>
          <div className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-9 h-9 rounded-full bg-amber-100 flex items-center justify-center"><AlertTriangle className="w-5 h-5 text-amber-600" /></div>
              <div>
                <h3 className="font-semibold text-slate-800">{isDeliveryEvent ? "Verify Delivery & Quantities" : "Confirm Trigger Event"}</h3>
                <p className="text-xs text-slate-500">{isDeliveryEvent ? "Enter received quantities — GST & payable auto-calculated" : "Verify before marking as complete"}</p>
              </div>
            </div>

            <div className="space-y-3 text-sm">
              <div className="bg-slate-50 rounded-lg p-3">
                <div className="font-medium text-slate-800">{pendingEventObj.label}</div>
                <div className="text-xs text-slate-500 mt-0.5">Will be marked complete on {formatDate(todayISO())}.</div>
              </div>

              {/* Quantity verification for delivery-related events */}
              {isDeliveryEvent && (po.items || []).length > 0 && (
                <div className="border border-amber-200 rounded-lg p-3 bg-amber-50/50">
                  <div className="flex items-center gap-1.5 text-xs font-medium text-amber-700 mb-2"><PackageCheck className="w-3.5 h-3.5" /> Verify Received Quantities vs PO</div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead className="text-slate-500">
                        <tr className="border-b border-amber-200">
                          <th className="text-left py-1.5 pr-2 font-medium">Item</th>
                          <th className="text-right py-1.5 px-2 font-medium">PO Qty</th>
                          <th className="text-right py-1.5 px-2 font-medium">Received</th>
                          <th className="text-right py-1.5 px-2 font-medium">Rate</th>
                          <th className="text-right py-1.5 px-2 font-medium">GST%</th>
                          <th className="text-right py-1.5 px-2 font-medium">GST Amt</th>
                          <th className="text-right py-1.5 pl-2 font-medium">Payable</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-amber-100">
                        {po.items.map((item, i) => {
                          const { base, gst, total } = payableFor(item, receivedQtys[i] ?? item.quantity);
                          const diff = (Number(receivedQtys[i] ?? item.quantity) || 0) - (item.quantity || 0);
                          return (
                            <tr key={i}>
                              <td className="py-1.5 pr-2 text-slate-700">
                                <div className="truncate max-w-[140px]">{item.item_name || "Item"}</div>
                                {diff !== 0 && (
                                  <div className={`text-[10px] font-medium ${diff < 0 ? "text-red-600" : "text-amber-600"}`}>
                                    {diff < 0 ? `Short ${Math.abs(diff)}` : `Excess +${diff}`}
                                  </div>
                                )}
                              </td>
                              <td className="py-1.5 px-2 text-right text-slate-600 whitespace-nowrap">{item.quantity} {item.unit}</td>
                              <td className="py-1.5 px-2 text-right">
                                <Input type="number" min={0} value={receivedQtys[i] ?? item.quantity} onChange={(e) => setReceivedQtys((prev) => { const n = [...prev]; n[i] = Number(e.target.value); return n; })} className="h-7 w-20 text-right text-xs" disabled={verifying} />
                              </td>
                              <td className="py-1.5 px-2 text-right text-slate-600">{formatINR(item.rate)}</td>
                              <td className="py-1.5 px-2 text-right text-slate-600">{item.gst_percent || 0}%</td>
                              <td className="py-1.5 px-2 text-right text-slate-600">{formatINR(gst)}</td>
                              <td className="py-1.5 pl-2 text-right font-medium text-slate-800 whitespace-nowrap">{formatINR(total)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot className="border-t border-amber-200">
                        <tr className="font-semibold text-slate-800">
                          <td className="py-2 pr-2" colSpan={5}>Total (auto-calculated)</td>
                          <td className="py-2 px-2 text-right">{formatINR(deliveryTotals.gstTotal)}</td>
                          <td className="py-2 pl-2 text-right">{formatINR(deliveryTotals.grandTotal)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                  {(deliveryTotals.shortCount > 0 || deliveryTotals.excessCount > 0) && (
                    <div className="text-[11px] mt-2 flex gap-3">
                      {deliveryTotals.shortCount > 0 && <span className="text-red-600">⚠ {deliveryTotals.shortCount} item(s) short — balance will be tracked</span>}
                      {deliveryTotals.excessCount > 0 && <span className="text-amber-600">⚠ {deliveryTotals.excessCount} item(s) in excess</span>}
                    </div>
                  )}
                  <div className="text-[11px] text-amber-600 mt-1.5">A Delivery Verification record will be saved per item with the computed payable (incl. GST).</div>
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
              <Button variant="outline" className="flex-1" onClick={() => setPendingEvent(null)} disabled={verifying}>Cancel</Button>
              <Button className="flex-1 bg-emerald-600 hover:bg-emerald-700" onClick={confirmPendingEvent} disabled={verifying}>
                {verifying ? <><RefreshCw className="w-4 h-4 mr-1.5 animate-spin" /> Verifying...</> : <><CheckCircle className="w-4 h-4 mr-1.5" /> {isDeliveryEvent ? "Verify & Mark Delivered" : "Confirm & Mark"}</>}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}