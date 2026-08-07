import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, ChevronUp, ChevronDown, GripVertical, Calendar, Percent, IndianRupee } from "lucide-react";
import {
  TRIGGER_TYPES, getTriggerType, calcMilestoneAmount, calculateDueDate, createEmptyMilestone,
  MILESTONE_STATUS_LABELS, MILESTONE_BADGES, getMilestoneStatus,
} from "@/lib/paymentScheduleUtils";
import { formatINR } from "@/lib/poUtils";

export default function ScheduleBuilder({ milestones, setMilestones, grandTotal }) {
  const [showCustomName, setShowCustomName] = useState({});

  const addMilestone = () => {
    setMilestones([...milestones, createEmptyMilestone(milestones.length)]);
  };

  const updateMilestone = (idx, field, value) => {
    const updated = [...milestones];
    updated[idx] = { ...updated[idx], [field]: value };

    if (field === "amount" || field === "amount_type") {
      updated[idx].calculated_amount = calcMilestoneAmount(updated[idx], grandTotal);
      updated[idx].outstanding_amount = updated[idx].calculated_amount - (updated[idx].amount_paid || 0);
    }
    if (field === "trigger_type") {
      const tt = getTriggerType(value);
      updated[idx].trigger_event = tt?.eventKey || "";
      if (value === "custom_manual") {
        setShowCustomName({ ...showCustomName, [idx]: true });
      }
      updated[idx].offset_days = tt?.hasOffset ? updated[idx].offset_days || 0 : 0;
    }
    setMilestones(updated);
  };

  const removeMilestone = (idx) => {
    setMilestones(milestones.filter((_, i) => i !== idx));
  };

  const moveMilestone = (idx, dir) => {
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= milestones.length) return;
    const updated = [...milestones];
    [updated[idx], updated[newIdx]] = [updated[newIdx], updated[idx]];
    updated.forEach((m, i) => (m.order_index = i));
    setMilestones(updated);
  };

  const totalScheduled = milestones.reduce((s, m) => s + Number(m.calculated_amount || 0), 0);
  const totalPercent = grandTotal > 0 ? (totalScheduled / grandTotal) * 100 : 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <Label className="text-sm font-medium">Payment Schedule Milestones</Label>
          <p className="text-xs text-slate-500 mt-0.5">Define one or multiple payment milestones. No limit on count.</p>
        </div>
        <Button size="sm" variant="outline" onClick={addMilestone}><Plus className="w-4 h-4 mr-1" /> Add Milestone</Button>
      </div>

      {milestones.length === 0 ? (
        <div className="text-center py-10 border-2 border-dashed border-slate-200 rounded-xl">
          <Calendar className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <p className="text-sm text-slate-400">No milestones added yet. Click "Add Milestone" to start.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {milestones.map((m, idx) => {
            const tt = getTriggerType(m.trigger_type);
            const showPercent = m.amount_type === "percentage";
            return (
              <div key={idx} className="border border-slate-200 rounded-xl p-4 space-y-3 bg-slate-50/50">
                {/* Header row */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-400 bg-white px-2 py-1 rounded border border-slate-200">#{idx + 1}</span>
                    {m.milestone_name && <span className="text-sm font-medium text-slate-700">{m.milestone_name}</span>}
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => moveMilestone(idx, -1)} disabled={idx === 0} className="p-1 text-slate-400 hover:text-slate-600 disabled:opacity-30"><ChevronUp className="w-4 h-4" /></button>
                    <button onClick={() => moveMilestone(idx, 1)} disabled={idx === milestones.length - 1} className="p-1 text-slate-400 hover:text-slate-600 disabled:opacity-30"><ChevronDown className="w-4 h-4" /></button>
                    <button onClick={() => removeMilestone(idx)} className="p-1 text-red-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </div>

                {/* Name & Description */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Milestone Name *</Label>
                    <Input value={m.milestone_name} onChange={(e) => updateMilestone(idx, "milestone_name", e.target.value)} placeholder="e.g. Advance Payment" className="h-9 mt-1" />
                  </div>
                  <div>
                    <Label className="text-xs">Description</Label>
                    <Input value={m.description} onChange={(e) => updateMilestone(idx, "description", e.target.value)} placeholder="Optional description" className="h-9 mt-1" />
                  </div>
                </div>

                {/* Amount */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <Label className="text-xs">Amount Type</Label>
                    <Select value={m.amount_type} onValueChange={(v) => updateMilestone(idx, "amount_type", v)}>
                      <SelectTrigger className="h-9 mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="fixed">Fixed Amount</SelectItem>
                        <SelectItem value="percentage">Percentage of PO Total</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">{showPercent ? "Percentage (%)" : "Amount (₹)"}</Label>
                    <div className="relative mt-1">
                      {showPercent ? <Percent className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" /> : <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />}
                      <Input type="number" value={m.amount} onChange={(e) => updateMilestone(idx, "amount", e.target.value)} className={`h-9 ${showPercent ? "pl-7" : "pl-7"}`} placeholder={showPercent ? "e.g. 50" : "e.g. 50000"} />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs">Calculated Amount</Label>
                    <div className="h-9 mt-1 px-3 flex items-center rounded-md border border-slate-200 bg-white text-sm font-medium text-slate-700">{formatINR(m.calculated_amount || 0)}</div>
                  </div>
                </div>

                {/* Trigger Type */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Trigger Type</Label>
                    <Select value={m.trigger_type} onValueChange={(v) => updateMilestone(idx, "trigger_type", v)}>
                      <SelectTrigger className="h-9 mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent className="max-h-72">
                        {TRIGGER_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  {m.trigger_type === "custom_manual" && (
                    <div>
                      <Label className="text-xs">Custom Trigger Name</Label>
                      <Input value={m.custom_trigger_name} onChange={(e) => updateMilestone(idx, "custom_trigger_name", e.target.value)} placeholder="e.g. After Government Approval" className="h-9 mt-1" />
                    </div>
                  )}
                </div>

                {/* Offset or Fixed Date */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {tt?.hasOffset && (
                    <div>
                      <Label className="text-xs">
                        {tt.direction === -1 ? "Days Before Event" : tt.direction === 1 ? "Days After Event" : "Days"}
                      </Label>
                      <Input type="number" value={m.offset_days} onChange={(e) => updateMilestone(idx, "offset_days", Number(e.target.value))} className="h-9 mt-1" placeholder="0" />
                    </div>
                  )}
                  {m.trigger_type === "fixed_date" && (
                    <div>
                      <Label className="text-xs">Fixed Due Date</Label>
                      <Input type="date" value={m.fixed_date} onChange={(e) => updateMilestone(idx, "fixed_date", e.target.value)} className="h-9 mt-1" />
                    </div>
                  )}
                  {m.trigger_type === "custom_manual" && (
                    <div>
                      <Label className="text-xs">Actual Trigger Date (when triggered)</Label>
                      <Input type="date" value={m.actual_trigger_date} onChange={(e) => updateMilestone(idx, "actual_trigger_date", e.target.value)} className="h-9 mt-1" />
                    </div>
                  )}
                  <div>
                    <Label className="text-xs">Remarks</Label>
                    <Input value={m.remarks} onChange={(e) => updateMilestone(idx, "remarks", e.target.value)} placeholder="Optional" className="h-9 mt-1" />
                  </div>
                </div>

                {/* Due date preview */}
                <div className="text-xs text-slate-500 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
                  <Calendar className="w-3.5 h-3.5 inline mr-1 text-blue-500" />
                  Due date will be calculated automatically when the trigger event occurs.
                  {tt && !tt.hasOffset && m.trigger_type !== "fixed_date" && m.trigger_type !== "custom_manual" && (
                    <span className="ml-1">No offset needed for this trigger type.</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Summary */}
      {milestones.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-slate-500">Total Scheduled Amount</span>
            <span className="font-semibold text-slate-800">{formatINR(totalScheduled)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-slate-500">PO Grand Total</span>
            <span className="font-semibold text-slate-800">{formatINR(grandTotal)}</span>
          </div>
          <div className="flex justify-between text-sm border-t border-slate-100 pt-2">
            <span className="text-slate-500">Coverage</span>
            <span className={`font-semibold ${totalPercent > 100 ? "text-red-600" : totalPercent < 100 ? "text-amber-600" : "text-emerald-600"}`}>
              {totalPercent.toFixed(1)}%
            </span>
          </div>
          {totalPercent !== 100 && (
            <div className="text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2">
              {totalPercent < 100 ? `Only ${totalPercent.toFixed(1)}% of PO total is scheduled. Remaining ${formatINR(grandTotal - totalScheduled)} will have no milestone.` : `${(totalPercent - 100).toFixed(1)}% over-scheduled — milestones exceed PO total.`}
            </div>
          )}
        </div>
      )}
    </div>
  );
}