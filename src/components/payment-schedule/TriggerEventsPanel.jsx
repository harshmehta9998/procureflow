import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { base44 } from "@/api/base44Client";
import { TRIGGER_EVENTS, isEventCompleted } from "@/lib/paymentScheduleUtils";
import { formatDate, todayISO } from "@/lib/poUtils";
import { CheckCircle, Circle, Zap } from "lucide-react";
import { toast } from "sonner";

export default function TriggerEventsPanel({ po, onEventUpdate, canEdit }) {
  const [customEvent, setCustomEvent] = useState("");
  const [saving, setSaving] = useState(null);

  const toggleEvent = async (eventKey) => {
    if (!canEdit) return;
    const event = TRIGGER_EVENTS.find((e) => e.value === eventKey);
    if (!event || event.auto) return;

    setSaving(eventKey);
    const isDone = isEventCompleted(eventKey, po);
    try {
      const update = isDone ? { [event.poField]: "" } : { [event.poField]: todayISO() };
      await base44.entities.PurchaseOrder.update(po.id, update);
      await onEventUpdate();
      toast.success(isDone ? `${event.label} unmarked` : `${event.label} marked complete`);
    } catch (err) {
      toast.error("Failed to update event");
    } finally {
      setSaving(null);
    }
  };

  const setCustomEventDate = async (date) => {
    if (!canEdit) return;
    setSaving("custom");
    try {
      await base44.entities.PurchaseOrder.update(po.id, { custom_event_date: date, custom_event_name: customEvent || po.custom_event_name || "Custom Event" });
      await onEventUpdate();
      if (date) toast.success("Custom event marked");
    } catch { toast.error("Failed"); }
    finally { setSaving(null); }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-1">
        <Zap className="w-4 h-4 text-amber-500" />
        <h3 className="font-semibold text-slate-800 text-sm">Trigger Events</h3>
        <span className="text-xs text-slate-400">Mark events to auto-recalculate milestone due dates</span>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
        {TRIGGER_EVENTS.map((event) => {
          const done = isEventCompleted(event.value, po);
          const isCustom = event.value === "custom_event" || event.value === "po_created";
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
    </div>
  );
}