import React from "react";
import { formatDate } from "@/lib/poUtils";
import { getMilestoneStatus, MILESTONE_BADGES, MILESTONE_STATUS_LABELS, getTriggerType } from "@/lib/paymentScheduleUtils";
import { CheckCircle, Circle, ArrowDown, FileText, Calendar, Zap } from "lucide-react";

export default function PaymentTimeline({ po, milestones, payments }) {
  const events = [];

  // PO Created
  events.push({
    icon: FileText,
    label: "PO Created",
    date: po.created_date,
    done: true,
    color: "text-blue-500",
  });

  // PO Approved
  if (po.approved_date) {
    events.push({ icon: CheckCircle, label: "PO Approved", date: po.approved_date, done: true, color: "text-emerald-500" });
  }

  // Sort milestones by order_index
  const sortedMs = [...milestones].filter((m) => m.status !== "cancelled").sort((a, b) => (a.order_index || 0) - (b.order_index || 0));

  sortedMs.forEach((m) => {
    const status = getMilestoneStatus(m, po);
    const badge = MILESTONE_BADGES[status];
    const tt = getTriggerType(m.trigger_type);

    // Trigger event
    if (m.trigger_type === "custom_manual" && m.actual_trigger_date) {
      events.push({ icon: Zap, label: `${m.custom_trigger_name || m.milestone_name} (Triggered)`, date: m.actual_trigger_date, done: true, color: "text-amber-500" });
    } else if (tt?.eventKey && tt.eventKey !== "po_created" && tt.eventKey !== "po_approved") {
      const eventDate = po[getTriggerEventDateField(tt.eventKey)];
      if (eventDate) {
        events.push({ icon: Zap, label: `${tt.label} (Trigger)`, date: eventDate, done: true, color: "text-amber-500" });
      }
    }

    // Milestone due
    if (m.due_date) {
      events.push({
        icon: Calendar,
        label: `${m.milestone_name} — Due`,
        sub: `${formatINR(m.calculated_amount)}`,
        date: m.due_date,
        done: false,
        badge: { text: MILESTONE_STATUS_LABELS[status], color: badge.color, dot: badge.dot },
        color: "text-slate-500",
      });
    }

    // Payments for this milestone
    const msPays = payments.filter((p) => p.milestone_id === m.id);
    msPays.forEach((p) => {
      events.push({
        icon: CheckCircle,
        label: `${m.milestone_name} — Paid`,
        sub: `${formatINR(p.amount_paid)} via ${p.payment_mode}`,
        date: p.payment_date,
        done: true,
        color: "text-emerald-500",
      });
    });
  });

  // Sort by date
  events.sort((a, b) => {
    if (!a.date) return 1;
    if (!b.date) return -1;
    return new Date(a.date) - new Date(b.date);
  });

  return (
    <div className="space-y-0">
      {events.map((evt, i) => {
        const Icon = evt.icon;
        return (
          <div key={i} className="flex gap-3">
            <div className="flex flex-col items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${evt.done ? "bg-slate-100" : "bg-slate-50 border border-slate-200"}`}>
                <Icon className={`w-4 h-4 ${evt.color}`} />
              </div>
              {i < events.length - 1 && <div className="w-px flex-1 bg-slate-200 min-h-[2rem]" />}
            </div>
            <div className="flex-1 pb-4">
              <div className="text-sm font-medium text-slate-700">{evt.label}</div>
              {evt.sub && <div className="text-xs text-slate-500">{evt.sub}</div>}
              <div className="text-xs text-slate-400 mt-0.5">{evt.date ? formatDate(evt.date) : "Date pending"}</div>
              {evt.badge && (
                <span className={`inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${evt.badge.color}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${evt.badge.dot}`} />
                  {evt.badge.text}
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function getTriggerEventDateField(eventKey) {
  const map = {
    po_approved: "approved_date",
    work_started: "work_started_date",
    material_dispatched: "material_dispatched_date",
    delivery: "delivery_date",
    installation_started: "installation_started_date",
    installation_completed: "installation_completed_date",
    service_started: "service_started_date",
    service_completed: "service_completed_date",
    project_completed: "project_completed_date",
    invoice_received: "invoice_received_date",
    vendor_certified: "vendor_certified_date",
    custom_manual: "actual_trigger_date",
  };
  return map[eventKey];
}

function formatINR(amount) {
  return "₹" + Number(amount || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 });
}