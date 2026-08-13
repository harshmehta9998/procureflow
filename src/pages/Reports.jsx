import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useUserRole } from "@/lib/RoleContext";
import { formatINR, formatDate, daysOverdue, PO_CATEGORY_LABELS } from "@/lib/poUtils";
import { Button } from "@/components/ui/button";
import { FileDown, BarChart3 } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

export default function Reports() {
  const { scopeInstituteIds, activeInstitute, isSuperAdmin } = useUserRole();
  const [pos, setPos] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [p, pays] = await Promise.all([base44.entities.PurchaseOrder.list("-created_date", 500), base44.entities.Payment.list("-payment_date", 500)]);
        let list = p.filter((x) => !x.deleted);
        let payList = pays;
        if (scopeInstituteIds !== null) {
          list = list.filter((x) => scopeInstituteIds.includes(x.institute_id));
          payList = payList.filter((x) => scopeInstituteIds.includes(x.institute_id));
        }
        setPos(list);
        setPayments(payList);
      } finally { setLoading(false); }
    })();
  }, [scopeInstituteIds, activeInstitute]);

  if (loading) return <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" /></div>;

  const exportReport = (data, filename, headers) => {
    const rows = data;
    const csv = [headers, ...rows].map((r) => r.map((c) => `"${c ?? ""}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename; a.click();
  };

  const reports = [
    {
      title: "PO Register", desc: "All purchase orders with status and value",
      action: () => exportReport(pos, "po-register.csv", ["PO Number", "Title", "Institute", "Vendor", "Category", "Status", "Grand Total", "Paid", "Outstanding", "Due Date"]),
      data: pos.map((p) => [p.po_number, p.po_title, p.institute_name, p.vendor_name, p.po_category, p.status, p.grand_total, p.amount_paid, p.outstanding_amount, p.due_date]),
    },
    {
      title: "Vendor Ledger", desc: "Vendor-wise spending summary",
      action: () => {
        const vendors = {};
        pos.forEach((p) => { vendors[p.vendor_name] = (vendors[p.vendor_name] || 0) + (p.grand_total || 0); });
        const rows = Object.entries(vendors).map(([name, total]) => [name, total]);
        exportReport(rows, "vendor-ledger.csv", ["Vendor", "Total Spend"]);
      },
    },
    {
      title: "Institute Spending", desc: "Institute-wise spending report",
      action: () => {
        const insts = {};
        pos.forEach((p) => { insts[p.institute_name] = (insts[p.institute_name] || 0) + (p.grand_total || 0); });
        const rows = Object.entries(insts).map(([name, total]) => [name, total]);
        exportReport(rows, "institute-spending.csv", ["Institute", "Total Spend"]);
      },
    },
    {
      title: "Capex Report", desc: "All capital expenditure POs",
      action: () => exportReport(pos.filter((p) => p.po_category === "capex"), "capex-report.csv", ["PO Number", "Title", "Institute", "Vendor", "Grand Total", "Status"]),
      data: pos.filter((p) => p.po_category === "capex").map((p) => [p.po_number, p.po_title, p.institute_name, p.vendor_name, p.grand_total, p.status]),
    },
    {
      title: "Opex Report", desc: "All operating expenditure POs",
      action: () => exportReport(pos.filter((p) => p.po_category === "opex"), "opex-report.csv", ["PO Number", "Title", "Institute", "Vendor", "Grand Total", "Status"]),
      data: pos.filter((p) => p.po_category === "opex").map((p) => [p.po_number, p.po_title, p.institute_name, p.vendor_name, p.grand_total, p.status]),
    },
    {
      title: "Outstanding Liability", desc: "POs with outstanding balances",
      action: () => exportReport(pos.filter((p) => p.outstanding_amount > 0), "outstanding-liability.csv", ["PO Number", "Vendor", "Institute", "Grand Total", "Paid", "Outstanding", "Due Date"]),
      data: pos.filter((p) => p.outstanding_amount > 0).map((p) => [p.po_number, p.vendor_name, p.institute_name, p.grand_total, p.amount_paid, p.outstanding_amount, p.due_date]),
    },
    {
      title: "Overdue Payments", desc: "POs with overdue payments",
      action: () => exportReport(pos.filter((p) => daysOverdue(p.due_date, p.outstanding_amount) > 0), "overdue-payments.csv", ["PO Number", "Vendor", "Due Date", "Days Overdue", "Outstanding"]),
      data: pos.filter((p) => daysOverdue(p.due_date, p.outstanding_amount) > 0).map((p) => [p.po_number, p.vendor_name, p.due_date, daysOverdue(p.due_date, p.outstanding_amount), p.outstanding_amount]),
    },
    {
      title: "Payment History", desc: "Complete payment records",
      action: () => exportReport(payments, "payment-history.csv", ["PO Number", "Institute", "Vendor", "Payment Date", "Amount", "Mode", "Reference"]),
      data: payments.map((p) => [p.po_number, p.institute_name, p.vendor_name, p.payment_date, p.amount_paid, p.payment_mode, p.reference_number]),
    },
  ];

  // Charts
  const capexOpex = [
    { name: "Capex", value: pos.filter((p) => p.po_category === "capex").reduce((s, p) => s + (p.grand_total || 0), 0) },
    { name: "Opex", value: pos.filter((p) => p.po_category === "opex").reduce((s, p) => s + (p.grand_total || 0), 0) },
  ];
  const statusData = ["draft", "pending_approval", "approved", "payment_pending", "partially_paid", "fully_paid", "closed"].map((s) => ({ name: s.replace(/_/g, " "), count: pos.filter((p) => p.status === s).length })).filter((d) => d.count > 0);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Reports & Analytics</h1>
        <p className="text-sm text-slate-500 mt-0.5">Download reports and view analytics</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="font-semibold text-slate-800 mb-4 text-sm">Capex vs Opex</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={capexOpex}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="name" tick={{ fontSize: 12, fill: "#64748b" }} />
              <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} tickFormatter={(v) => "₹" + (v >= 100000 ? (v / 100000).toFixed(0) + "L" : v)} />
              <Tooltip formatter={(v) => formatINR(v)} contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12 }} />
              <Bar dataKey="value" fill="#0f172a" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="font-semibold text-slate-800 mb-4 text-sm">PO Status Distribution</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={statusData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis type="number" tick={{ fontSize: 11, fill: "#94a3b8" }} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: "#64748b" }} width={100} />
              <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12 }} />
              <Bar dataKey="count" fill="#475569" radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {reports.map((r) => (
          <div key={r.title} className="bg-white rounded-xl border border-slate-200 p-5 hover:shadow-md transition-shadow flex flex-col">
            <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center mb-3"><BarChart3 className="w-5 h-5 text-slate-500" /></div>
            <h3 className="font-semibold text-slate-800 text-sm">{r.title}</h3>
            <p className="text-xs text-slate-400 mt-1 flex-1">{r.desc}</p>
            <Button size="sm" variant="outline" className="mt-3 border-slate-200" onClick={r.action}><FileDown className="w-4 h-4 mr-1.5" /> Export CSV</Button>
          </div>
        ))}
      </div>
    </div>
  );
}