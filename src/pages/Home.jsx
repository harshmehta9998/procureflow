import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useUserRole } from "@/lib/RoleContext";
import { StatCard } from "@/components/po/Shared";
import { StatusBadge, PaymentBadge } from "@/components/po/Shared";
import FinanceHomePanel from "@/components/finance/FinanceHomePanel";
import { formatINR, formatDate, daysOverdue, PO_CATEGORY_LABELS } from "@/lib/poUtils";
import {
  FileText, Clock, CheckCircle, XCircle, Wallet, TrendingUp, AlertTriangle,
  Building2, PlusCircle, IndianRupee
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from "recharts";

export default function Home() {
  const { role, instituteId, isSuperAdmin, isFinance, isInstituteAdmin, userName } = useUserRole();
  const [pos, setPos] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        let list = await base44.entities.PurchaseOrder.list("-created_date", 500);
        list = list.filter((p) => !p.deleted);
        if (isInstituteAdmin && instituteId) {
          list = list.filter((p) => p.institute_id === instituteId);
        }
        setPos(list);
      } finally {
        setLoading(false);
      }
    })();
  }, [role, instituteId, isInstituteAdmin]);

  const counts = {
    total: pos.length,
    draft: pos.filter((p) => p.status === "draft").length,
    pending: pos.filter((p) => p.status === "pending_approval").length,
    approved: pos.filter((p) => p.status === "approved" || p.status === "payment_pending").length,
    rejected: pos.filter((p) => p.status === "rejected").length,
    partiallyPaid: pos.filter((p) => p.status === "partially_paid").length,
    fullyPaid: pos.filter((p) => p.status === "fully_paid" || p.status === "closed").length,
    paymentPending: pos.filter((p) => p.status === "payment_pending").length,
  };

  const totalCapex = pos.filter((p) => p.po_category === "capex").reduce((s, p) => s + (p.grand_total || 0), 0);
  const totalOpex = pos.filter((p) => p.po_category === "opex").reduce((s, p) => s + (p.grand_total || 0), 0);
  const totalLiability = pos.reduce((s, p) => s + (p.outstanding_amount || 0), 0);
  const overdueAmount = pos
    .filter((p) => daysOverdue(p.due_date, p.outstanding_amount) > 0)
    .reduce((s, p) => s + (p.outstanding_amount || 0), 0);

  // Monthly spend chart
  const monthly = {};
  pos.forEach((p) => {
    const m = p.created_date ? new Date(p.created_date).toLocaleDateString("en-IN", { month: "short" }) : "Unknown";
    monthly[m] = (monthly[m] || 0) + (p.grand_total || 0);
  });
  const monthlyData = Object.entries(monthly).map(([month, amount]) => ({ month, amount }));

  // Institute or vendor spend pie
  const groupBy = isSuperAdmin ? "institute_name" : "vendor_name";
  const groupData = {};
  pos.forEach((p) => {
    const k = p[groupBy];
    if (k) groupData[k] = (groupData[k] || 0) + (p.grand_total || 0);
  });
  const pieData = Object.entries(groupData).map(([name, value]) => ({ name, value }));
  const PIE_COLORS = ["#0f172a", "#334155", "#64748b", "#94a3b8", "#cbd5e1", "#475569", "#1e293b"];

  if (loading) {
    return <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">
            {isSuperAdmin ? "Super Admin Dashboard" : isFinance ? "Finance Dashboard" : "Institute Dashboard"}
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Welcome back, {userName}. {isInstituteAdmin ? "Here's your institute overview." : "Here's the system overview."}
          </p>
        </div>
        {isInstituteAdmin && (
          <Link to="/create-po" className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-800 transition-colors">
            <PlusCircle className="w-4 h-4" /> Create New PO
          </Link>
        )}
      </div>

      {/* Stat cards */}
      {isFinance ? (
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
          <StatCard label="Total POs" value={counts.total} icon={FileText} accent="slate" />
          <StatCard label="Payment Pending" value={counts.paymentPending} icon={Clock} accent="purple" />
          <StatCard label="Partially Paid" value={counts.partiallyPaid} icon={Wallet} accent="indigo" />
          <StatCard label="Fully Paid" value={counts.fullyPaid} icon={CheckCircle} accent="emerald" />
          <StatCard label="Outstanding" value={formatINR(totalLiability)} icon={AlertTriangle} accent="amber" />
          <StatCard label="Overdue" value={formatINR(overdueAmount)} icon={AlertTriangle} accent="red" />
        </div>
      ) : isSuperAdmin ? (
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
          <StatCard label="Total POs" value={counts.total} icon={FileText} accent="slate" />
          <StatCard label="Total Capex" value={formatINR(totalCapex)} icon={TrendingUp} accent="blue" />
          <StatCard label="Total Opex" value={formatINR(totalOpex)} icon={IndianRupee} accent="purple" />
          <StatCard label="Total Liability" value={formatINR(totalLiability)} icon={AlertTriangle} accent="amber" />
          <StatCard label="Overdue" value={formatINR(overdueAmount)} icon={AlertTriangle} accent="red" />
          <StatCard label="Pending Approval" value={counts.pending} icon={Clock} accent="amber" onClick={() => window.location.href = "/purchase-orders?status=pending_approval"} />
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-8 gap-3">
          <StatCard label="Total POs" value={counts.total} icon={FileText} accent="slate" />
          <StatCard label="Drafts" value={counts.draft} icon={FileText} accent="slate" />
          <StatCard label="Pending" value={counts.pending} icon={Clock} accent="amber" />
          <StatCard label="Approved" value={counts.approved} icon={CheckCircle} accent="blue" />
          <StatCard label="Rejected" value={counts.rejected} icon={XCircle} accent="red" />
          <StatCard label="Pay Pending" value={counts.paymentPending} icon={Wallet} accent="purple" />
          <StatCard label="Partial Paid" value={counts.partiallyPaid} icon={Wallet} accent="indigo" />
          <StatCard label="Fully Paid" value={counts.fullyPaid} icon={CheckCircle} accent="emerald" />
        </div>
      )}

      {/* Charts — hidden for finance (milestone-focused view below) */}
      {!isFinance && (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="font-semibold text-slate-800 mb-4 text-sm">{isSuperAdmin ? "Monthly Spend Trend" : "Monthly Spend"}</h3>
          {monthlyData.length === 0 ? (
            <div className="h-64 flex items-center justify-center text-slate-400 text-sm">No data</div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="month" tick={{ fontSize: 12, fill: "#64748b" }} />
                <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} tickFormatter={(v) => "₹" + (v >= 100000 ? (v / 100000).toFixed(0) + "L" : v)} />
                <Tooltip formatter={(v) => formatINR(v)} contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12 }} />
                <Bar dataKey="amount" fill="#0f172a" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="font-semibold text-slate-800 mb-4 text-sm">{isSuperAdmin ? "Institute-wise Spend" : "Vendor-wise Spend"}</h3>
          {pieData.length === 0 ? (
            <div className="h-64 flex items-center justify-center text-slate-400 text-sm">No data</div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} innerRadius={45}>
                  {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v) => formatINR(v)} contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
      )}

      {/* Finance: milestone-focused panel */}
      {isFinance && <FinanceHomePanel />}

      {/* Recent POs — only for non-finance */}
      {!isFinance && (
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200">
          <h3 className="font-semibold text-slate-800 text-sm">Recent Purchase Orders</h3>
          <Link to="/purchase-orders" className="text-xs font-medium text-slate-500 hover:text-slate-800">View all →</Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
              <tr>
                <th className="text-left px-5 py-2.5 font-medium">PO Number</th>
                <th className="text-left px-5 py-2.5 font-medium">Title</th>
                {isSuperAdmin && <th className="text-left px-5 py-2.5 font-medium">Institute</th>}
                <th className="text-left px-5 py-2.5 font-medium">Vendor</th>
                <th className="text-left px-5 py-2.5 font-medium">Type</th>
                <th className="text-right px-5 py-2.5 font-medium">Amount</th>
                <th className="text-left px-5 py-2.5 font-medium">Status</th>
                <th className="text-left px-5 py-2.5 font-medium">Payment</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {pos.slice(0, 8).map((p) => (
                <tr key={p.id} className="hover:bg-slate-50 cursor-pointer" onClick={() => window.location.href = `/po/${p.id}`}>
                  <td className="px-5 py-3 font-medium text-slate-800">{p.po_number}</td>
                  <td className="px-5 py-3 text-slate-600 max-w-xs truncate">{p.po_title}</td>
                  {isSuperAdmin && <td className="px-5 py-3 text-slate-600">{p.institute_name}</td>}
                  <td className="px-5 py-3 text-slate-600">{p.vendor_name}</td>
                  <td className="px-5 py-3"><span className="text-xs text-slate-500">{PO_CATEGORY_LABELS[p.po_category]}</span></td>
                  <td className="px-5 py-3 text-right font-medium text-slate-800">{formatINR(p.grand_total)}</td>
                  <td className="px-5 py-3"><StatusBadge status={p.status} /></td>
                  <td className="px-5 py-3"><PaymentBadge status={p.payment_status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      )}
    </div>
  );
}