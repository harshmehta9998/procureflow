import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { formatINR, formatDate } from "@/lib/poUtils";
import { getMilestoneStatus, MILESTONE_STATUS_LABELS, MILESTONE_BADGES } from "@/lib/paymentScheduleUtils";
import { Calendar, AlertTriangle, Wallet, ArrowRight } from "lucide-react";

const todayStr = new Date().toISOString().split("T")[0];
const inDays = (n) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().split("T")[0];
};

export default function FinanceHomePanel() {
  const [milestones, setMilestones] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const all = await base44.entities.PaymentMilestone.list("-created_date", 500);
        setMilestones(all.filter((m) => !m.deleted && m.status !== "cancelled" && m.status !== "paid"));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <div className="flex justify-center py-10"><div className="w-6 h-6 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" /></div>;

  const overdue = milestones
    .filter((m) => m.due_date && m.due_date < todayStr && (m.outstanding_amount || 0) > 0)
    .sort((a, b) => new Date(a.due_date) - new Date(b.due_date));

  const upcoming = milestones
    .filter((m) => m.due_date && m.due_date >= todayStr && m.due_date <= inDays(30) && (m.outstanding_amount || 0) > 0)
    .sort((a, b) => new Date(a.due_date) - new Date(b.due_date));

  const totalOverdue = overdue.reduce((s, m) => s + (m.outstanding_amount || 0), 0);
  const totalUpcoming = upcoming.reduce((s, m) => s + (m.outstanding_amount || 0), 0);

  const renderRow = (m) => {
    const status = getMilestoneStatus(m, {});
    const badge = MILESTONE_BADGES[status];
    return (
      <tr key={m.id} className="hover:bg-slate-50 cursor-pointer" onClick={() => window.location.href = `/po/${m.po_id}`}>
        <td className="px-4 py-3 font-medium text-slate-800 text-xs">{m.po_number}</td>
        <td className="px-4 py-3 text-slate-600 text-xs">{m.milestone_name}</td>
        <td className="px-4 py-3 text-slate-500 text-xs">{m.vendor_name}</td>
        <td className="px-4 py-3 text-xs font-medium text-slate-700">{formatDate(m.due_date)}</td>
        <td className="px-4 py-3 text-right text-xs font-medium text-amber-600">{formatINR(m.outstanding_amount || 0)}</td>
        <td className="px-4 py-3">
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${badge.color}`}>
            <span className={`w-1 h-1 rounded-full ${badge.dot}`} />
            {MILESTONE_STATUS_LABELS[status]}
          </span>
        </td>
      </tr>
    );
  };

  return (
    <div className="space-y-4">
      {/* Summary banners */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-gradient-to-br from-red-50 to-red-50/30 border border-red-200 rounded-xl p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center"><AlertTriangle className="w-5 h-5 text-red-600" /></div>
          <div>
            <div className="text-xs text-red-600 font-medium uppercase tracking-wide">Overdue Payments</div>
            <div className="text-lg font-bold text-red-700">{formatINR(totalOverdue)}</div>
            <div className="text-[11px] text-red-500">{overdue.length} milestone{overdue.length !== 1 ? "s" : ""} past due</div>
          </div>
        </div>
        <div className="bg-gradient-to-br from-amber-50 to-amber-50/30 border border-amber-200 rounded-xl p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center"><Calendar className="w-5 h-5 text-amber-600" /></div>
          <div>
            <div className="text-xs text-amber-600 font-medium uppercase tracking-wide">Due in 30 Days</div>
            <div className="text-lg font-bold text-amber-700">{formatINR(totalUpcoming)}</div>
            <div className="text-[11px] text-amber-500">{upcoming.length} milestone{upcoming.length !== 1 ? "s" : ""} upcoming</div>
          </div>
        </div>
      </div>

      {/* Overdue milestones */}
      {overdue.length > 0 && (
        <div className="bg-white rounded-xl border border-red-200 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-red-100 bg-red-50/30">
            <h3 className="font-semibold text-red-700 text-sm flex items-center gap-2"><AlertTriangle className="w-4 h-4" /> Overdue Payment Milestones</h3>
            <Link to="/finance" className="text-xs font-medium text-red-600 hover:text-red-800 flex items-center gap-1">Finance Hub <ArrowRight className="w-3 h-3" /></Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 text-slate-500 text-[10px] uppercase tracking-wide">
                <tr>
                  <th className="text-left px-4 py-2 font-medium">PO</th>
                  <th className="text-left px-4 py-2 font-medium">Milestone</th>
                  <th className="text-left px-4 py-2 font-medium">Vendor</th>
                  <th className="text-left px-4 py-2 font-medium">Due Date</th>
                  <th className="text-right px-4 py-2 font-medium">Outstanding</th>
                  <th className="text-left px-4 py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">{overdue.slice(0, 5).map(renderRow)}</tbody>
            </table>
          </div>
        </div>
      )}

      {/* Upcoming milestones */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200">
          <h3 className="font-semibold text-slate-800 text-sm flex items-center gap-2"><Wallet className="w-4 h-4 text-slate-500" /> Upcoming Payment Milestones (30 days)</h3>
          <Link to="/finance" className="text-xs font-medium text-slate-500 hover:text-slate-800 flex items-center gap-1">View all <ArrowRight className="w-3 h-3" /></Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 text-slate-500 text-[10px] uppercase tracking-wide">
              <tr>
                <th className="text-left px-4 py-2 font-medium">PO</th>
                <th className="text-left px-4 py-2 font-medium">Milestone</th>
                <th className="text-left px-4 py-2 font-medium">Vendor</th>
                <th className="text-left px-4 py-2 font-medium">Due Date</th>
                <th className="text-right px-4 py-2 font-medium">Outstanding</th>
                <th className="text-left px-4 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {upcoming.length > 0 ? upcoming.slice(0, 6).map(renderRow) : (
                <tr><td colSpan={6} className="text-center py-8 text-sm text-slate-400">No upcoming payments in the next 30 days</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}