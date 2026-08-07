import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useUserRole } from "@/lib/RoleContext";
import { StatCard, EmptyState } from "@/components/po/Shared";
import { StatusBadge, PaymentBadge } from "@/components/po/Shared";
import { formatINR, formatDate, daysOverdue } from "@/lib/poUtils";
import { Wallet, AlertTriangle, Clock, CheckCircle, IndianRupee, TrendingDown } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from "recharts";

export default function Finance() {
  const { isInstituteAdmin } = useUserRole();
  const [pos, setPos] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [allPOs, allPays] = await Promise.all([
          base44.entities.PurchaseOrder.list("-created_date", 500),
          base44.entities.Payment.list("-payment_date", 500),
        ]);
        setPos(allPOs.filter((p) => !p.deleted && ["approved", "payment_pending", "partially_paid", "fully_paid", "closed"].includes(p.status)));
        setPayments(allPays);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const weekEnd = new Date(today); weekEnd.setDate(today.getDate() + 7);
  const monthEnd = new Date(today); monthEnd.setDate(today.getDate() + 30);

  const dueToday = pos.filter((p) => p.outstanding_amount > 0 && new Date(p.due_date) <= today);
  const dueWeek = pos.filter((p) => p.outstanding_amount > 0 && new Date(p.due_date) > today && new Date(p.due_date) <= weekEnd);
  const dueMonth = pos.filter((p) => p.outstanding_amount > 0 && new Date(p.due_date) > weekEnd && new Date(p.due_date) <= monthEnd);
  const overdue = pos.filter((p) => daysOverdue(p.due_date, p.outstanding_amount) > 0);
  const partiallyPaid = pos.filter((p) => p.status === "partially_paid");
  const completed = pos.filter((p) => p.status === "fully_paid" || p.status === "closed");

  const totalLiability = pos.reduce((s, p) => s + (p.outstanding_amount || 0), 0);
  const overdueAmount = overdue.reduce((s, p) => s + (p.outstanding_amount || 0), 0);
  const totalPaid = payments.reduce((s, p) => s + (p.amount_paid || 0), 0);

  const monthlyPayments = {};
  payments.forEach((p) => {
    const m = p.payment_date ? new Date(p.payment_date).toLocaleDateString("en-IN", { month: "short" }) : "Unknown";
    monthlyPayments[m] = (monthlyPayments[m] || 0) + (p.amount_paid || 0);
  });
  const paymentChart = Object.entries(monthlyPayments).map(([month, amount]) => ({ month, amount }));

  const liabilityTrend = Object.entries(monthlyPayments).map(([month, amount]) => ({ month, liability: totalLiability, paid: amount }));

  if (loading) return <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Finance Dashboard</h1>
        <p className="text-sm text-slate-500 mt-0.5">Track payments, dues, and outstanding liabilities</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
        <StatCard label="Due Today" value={dueToday.length} sub={formatINR(dueToday.reduce((s, p) => s + p.outstanding_amount, 0))} icon={Clock} accent="amber" />
        <StatCard label="Due This Week" value={dueWeek.length} sub={formatINR(dueWeek.reduce((s, p) => s + p.outstanding_amount, 0))} icon={Clock} accent="blue" />
        <StatCard label="Due This Month" value={dueMonth.length} sub={formatINR(dueMonth.reduce((s, p) => s + p.outstanding_amount, 0))} icon={Clock} accent="purple" />
        <StatCard label="Overdue" value={overdue.length} sub={formatINR(overdueAmount)} icon={AlertTriangle} accent="red" />
        <StatCard label="Outstanding" value={formatINR(totalLiability)} icon={TrendingDown} accent="amber" />
        <StatCard label="Completed" value={completed.length} sub={formatINR(totalPaid)} icon={CheckCircle} accent="emerald" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="font-semibold text-slate-800 mb-4 text-sm">Monthly Payments</h3>
          {paymentChart.length === 0 ? <div className="h-64 flex items-center justify-center text-slate-400 text-sm">No data</div> : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={paymentChart}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="month" tick={{ fontSize: 12, fill: "#64748b" }} />
                <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} tickFormatter={(v) => "₹" + (v >= 100000 ? (v / 100000).toFixed(0) + "L" : v)} />
                <Tooltip formatter={(v) => formatINR(v)} contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12 }} />
                <Bar dataKey="amount" fill="#059669" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="font-semibold text-slate-800 mb-4 text-sm">Liability Trend</h3>
          {liabilityTrend.length === 0 ? <div className="h-64 flex items-center justify-center text-slate-400 text-sm">No data</div> : (
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={liabilityTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="month" tick={{ fontSize: 12, fill: "#64748b" }} />
                <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} tickFormatter={(v) => "₹" + (v >= 100000 ? (v / 100000).toFixed(0) + "L" : v)} />
                <Tooltip formatter={(v) => formatINR(v)} contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12 }} />
                <Line type="monotone" dataKey="liability" stroke="#d97706" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Overdue POs */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-red-500" />
          <h3 className="font-semibold text-slate-800 text-sm">Overdue Payments ({overdue.length})</h3>
        </div>
        {overdue.length === 0 ? <EmptyState title="No overdue payments" sub="All payments are on track" /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs text-slate-500 uppercase">
                <tr>
                  <th className="text-left px-5 py-2.5 font-medium">PO Number</th>
                  <th className="text-left px-5 py-2.5 font-medium">Vendor</th>
                  <th className="text-left px-5 py-2.5 font-medium">Due Date</th>
                  <th className="text-right px-5 py-2.5 font-medium">Days Overdue</th>
                  <th className="text-right px-5 py-2.5 font-medium">Outstanding</th>
                  <th className="text-left px-5 py-2.5 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {overdue.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50 cursor-pointer" onClick={() => window.location.href = `/po/${p.id}`}>
                    <td className="px-5 py-3 font-medium text-slate-800">{p.po_number}</td>
                    <td className="px-5 py-3 text-slate-600">{p.vendor_name}</td>
                    <td className="px-5 py-3 text-slate-600">{formatDate(p.due_date)}</td>
                    <td className="px-5 py-3 text-right text-red-600 font-medium">{daysOverdue(p.due_date, p.outstanding_amount)} days</td>
                    <td className="px-5 py-3 text-right font-medium text-red-600">{formatINR(p.outstanding_amount)}</td>
                    <td className="px-5 py-3"><StatusBadge status={p.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Partially Paid */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 flex items-center gap-2">
          <Wallet className="w-4 h-4 text-indigo-500" />
          <h3 className="font-semibold text-slate-800 text-sm">Partially Paid POs ({partiallyPaid.length})</h3>
        </div>
        {partiallyPaid.length === 0 ? <EmptyState title="No partially paid POs" /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs text-slate-500 uppercase">
                <tr>
                  <th className="text-left px-5 py-2.5 font-medium">PO Number</th>
                  <th className="text-left px-5 py-2.5 font-medium">Vendor</th>
                  <th className="text-right px-5 py-2.5 font-medium">Total</th>
                  <th className="text-right px-5 py-2.5 font-medium">Paid</th>
                  <th className="text-right px-5 py-2.5 font-medium">Outstanding</th>
                  <th className="text-left px-5 py-2.5 font-medium">Payment</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {partiallyPaid.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50 cursor-pointer" onClick={() => window.location.href = `/po/${p.id}`}>
                    <td className="px-5 py-3 font-medium text-slate-800">{p.po_number}</td>
                    <td className="px-5 py-3 text-slate-600">{p.vendor_name}</td>
                    <td className="px-5 py-3 text-right">{formatINR(p.grand_total)}</td>
                    <td className="px-5 py-3 text-right text-emerald-600">{formatINR(p.amount_paid)}</td>
                    <td className="px-5 py-3 text-right text-amber-600 font-medium">{formatINR(p.outstanding_amount)}</td>
                    <td className="px-5 py-3"><PaymentBadge status={p.payment_status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}