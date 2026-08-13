import React, { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useUserRole } from "@/lib/RoleContext";
import { StatCard, EmptyState } from "@/components/po/Shared";
import { formatINR, formatDate, todayISO, daysOverdue, FINANCE_VISIBLE_STATUSES, PO_TYPE_LABELS } from "@/lib/poUtils";
import { getInstanceStatus, PR_INSTANCE_STATUS_COLORS, PR_INSTANCE_STATUS_LABELS, RP_CATEGORY_LABELS, PR_EXPENSE_LABELS } from "@/lib/workflowUtils";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Zap, AlertTriangle, Calendar, Filter } from "lucide-react";

export default function PaymentInitiatives() {
  const navigate = useNavigate();
  const { scopeInstituteIds, activeInstitute, isSuperAdmin, isFinance, isCentreHead, isInstituteAdmin } = useUserRole();
  const [milestones, setMilestones] = useState([]);
  const [pos, setPos] = useState([]);
  const [instances, setInstances] = useState([]);
  const [paymentReqs, setPaymentReqs] = useState([]);
  const [institutes, setInstitutes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ institute: "", paymentType: "", status: "", dateFrom: "", dateTo: "" });
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [ms, allPos, inst, allPr, allInsts] = await Promise.all([
          base44.entities.PaymentMilestone.list("-created_date", 1000),
          base44.entities.PurchaseOrder.list("-created_date", 500),
          base44.entities.RecurringPaymentInstance.list("-due_date", 2000),
          base44.entities.PaymentRequest.list("-created_date", 500),
          base44.entities.Institute.list(),
        ]);
        setMilestones(ms.filter((m) => !m.deleted));
        setPos(allPos.filter((p) => !p.deleted && !p.cancelled));
        setInstances(inst.filter((i) => !i.deleted));
        setPaymentReqs(allPr.filter((r) => !r.deleted && ["sent_to_finance", "payment_pending"].includes(r.status)));
        setInstitutes(allInsts);
      } finally { setLoading(false); }
    })();
  }, []);

  const poMap = useMemo(() => { const m = {}; pos.forEach((p) => (m[p.id] = p)); return m; }, [pos]);

  // Build consolidated rows: PO milestones + recurring instances + payment requests
  const rows = useMemo(() => {
    const list = [];
    // PO milestones (only for finance-visible POs)
    milestones.forEach((m) => {
      const po = poMap[m.po_id];
      if (!po || !FINANCE_VISIBLE_STATUSES.includes(po.status)) return;
      if (m.status === "cancelled" || m.status === "paid") return;
      const od = daysOverdue(m.due_date, m.outstanding_amount || 0);
      const status = od > 0 ? "overdue" : m.due_date ? (new Date(m.due_date) <= new Date() ? "due" : "upcoming") : "pending";
      if (m.outstanding_amount <= 0) return;
      list.push({
        id: `ms-${m.id}`, dueDate: m.due_date, institute: po.institute_name, instituteId: po.institute_id,
        paymentType: "PO", reference: po.po_number, detail: m.milestone_name, vendor: po.vendor_name,
        amount: m.outstanding_amount, status, poId: po.id,
      });
    });
    // Recurring instances
    instances.forEach((i) => {
      const st = getInstanceStatus(i, todayISO());
      if (st === "paid" || st === "cancelled") return;
      list.push({
        id: `ri-${i.id}`, dueDate: i.due_date, institute: i.institute_name, instituteId: i.institute_id,
        paymentType: "Recurring", reference: i.recurring_number, detail: RP_CATEGORY_LABELS[i.payment_category] || i.payment_category, vendor: i.payee_vendor_name,
        amount: i.outstanding_amount || i.amount, status: st === "overdue" ? "overdue" : "due",
      });
    });
    // Payment requests
    paymentReqs.forEach((r) => {
      list.push({
        id: `pr-${r.id}`, dueDate: r.required_date, institute: r.institute_name, instituteId: r.institute_id,
        paymentType: "Payment Request", reference: r.request_number, detail: PR_EXPENSE_LABELS[r.expense_category] || r.expense_category, vendor: r.vendor_name,
        amount: r.amount, status: "due",
      });
    });
    return list;
  }, [milestones, poMap, instances, paymentReqs]);

  const filtered = useMemo(() => rows.filter((r) => {
    if (scopeInstituteIds !== null && !scopeInstituteIds.includes(r.instituteId)) return false;
    if (filters.institute && r.instituteId !== filters.institute) return false;
    if (filters.paymentType && r.paymentType !== filters.paymentType) return false;
    if (filters.status && r.status !== filters.status) return false;
    if (filters.dateFrom && r.dueDate && r.dueDate < filters.dateFrom) return false;
    if (filters.dateTo && r.dueDate && r.dueDate > filters.dateTo) return false;
    return true;
  }).sort((a, b) => (a.dueDate || "9999").localeCompare(b.dueDate || "9999")), [rows, filters, scopeInstituteIds]);

  const totalDue = filtered.reduce((s, r) => s + r.amount, 0);
  const overdueAmount = filtered.filter((r) => r.status === "overdue").reduce((s, r) => s + r.amount, 0);

  const typeColors = { PO: "bg-blue-100 text-blue-700", Recurring: "bg-purple-100 text-purple-700", "Payment Request": "bg-teal-100 text-teal-700" };
  const statusColors = { overdue: "bg-red-100 text-red-700", due: "bg-amber-100 text-amber-700", upcoming: "bg-blue-100 text-blue-700", pending: "bg-slate-100 text-slate-600" };

  if (loading) return <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Payment Initiatives</h1>
          <p className="text-sm text-slate-500 mt-0.5">What payments need to be made, where, and when · {filtered.length} items · {formatINR(totalDue)}</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setShowFilters(!showFilters)}><Filter className="w-4 h-4 mr-1.5" /> Filters</Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Total Due" value={formatINR(totalDue)} icon={Zap} accent="blue" />
        <StatCard label="Overdue" value={formatINR(overdueAmount)} icon={AlertTriangle} accent="red" />
        <StatCard label="Due / Upcoming" value={filtered.filter((r) => r.status !== "overdue").length} icon={Calendar} accent="amber" />
        <StatCard label="Items" value={filtered.length} icon={Filter} accent="slate" />
      </div>

      {showFilters && (
        <div className="bg-white rounded-xl border border-slate-200 p-4 grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div><Label className="text-xs">Institute</Label><Select value={filters.institute} onValueChange={(v) => setFilters({ ...filters, institute: v })}><SelectTrigger className="h-9 mt-1"><SelectValue placeholder="All" /></SelectTrigger><SelectContent><SelectItem value={null}>All</SelectItem>{institutes.map((i) => <SelectItem key={i.id} value={i.id}>{i.institute_name}</SelectItem>)}</SelectContent></Select></div>
          <div><Label className="text-xs">Payment Type</Label><Select value={filters.paymentType} onValueChange={(v) => setFilters({ ...filters, paymentType: v })}><SelectTrigger className="h-9 mt-1"><SelectValue placeholder="All" /></SelectTrigger><SelectContent><SelectItem value={null}>All</SelectItem><SelectItem value="PO">PO</SelectItem><SelectItem value="Recurring">Recurring</SelectItem><SelectItem value="Payment Request">Payment Request</SelectItem></SelectContent></Select></div>
          <div><Label className="text-xs">Status</Label><Select value={filters.status} onValueChange={(v) => setFilters({ ...filters, status: v })}><SelectTrigger className="h-9 mt-1"><SelectValue placeholder="All" /></SelectTrigger><SelectContent><SelectItem value={null}>All</SelectItem><SelectItem value="overdue">Overdue</SelectItem><SelectItem value="due">Due</SelectItem><SelectItem value="upcoming">Upcoming</SelectItem><SelectItem value="pending">Pending</SelectItem></SelectContent></Select></div>
          <div className="flex gap-2 items-end"><div className="flex-1"><Label className="text-xs">From</Label><Input type="date" value={filters.dateFrom} onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })} className="h-9 mt-1" /></div><div className="flex-1"><Label className="text-xs">To</Label><Input type="date" value={filters.dateTo} onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })} className="h-9 mt-1" /></div></div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {filtered.length === 0 ? <EmptyState icon={Zap} title="No payments due" sub="All financial obligations are settled." /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs text-slate-500 uppercase"><tr>
                <th className="text-left px-4 py-3 font-medium">Due Date</th>
                {(isSuperAdmin || isFinance || isCentreHead) && <th className="text-left px-4 py-3 font-medium">Institution</th>}
                <th className="text-left px-4 py-3 font-medium">Payment Type</th>
                <th className="text-left px-4 py-3 font-medium">Reference</th>
                <th className="text-left px-4 py-3 font-medium">Detail</th>
                <th className="text-left px-4 py-3 font-medium">Payee</th>
                <th className="text-right px-4 py-3 font-medium">Amount</th>
                <th className="text-left px-4 py-3 font-medium">Status</th>
              </tr></thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((r) => (
                  <tr key={r.id} className={`hover:bg-slate-50 cursor-pointer ${r.poId ? "" : ""}`} onClick={() => r.poId ? navigate(`/po/${r.poId}`) : null}>
                    <td className="px-4 py-3 text-slate-700 font-medium whitespace-nowrap">{formatDate(r.dueDate)}</td>
                    {(isSuperAdmin || isFinance || isCentreHead) && <td className="px-4 py-3 text-slate-600">{r.institute}</td>}
                    <td className="px-4 py-3"><span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${typeColors[r.paymentType]}`}>{r.paymentType}</span></td>
                    <td className="px-4 py-3 font-medium text-slate-800">{r.reference}</td>
                    <td className="px-4 py-3 text-slate-600">{r.detail}</td>
                    <td className="px-4 py-3 text-slate-600">{r.vendor || "-"}</td>
                    <td className="px-4 py-3 text-right font-medium">{formatINR(r.amount)}</td>
                    <td className="px-4 py-3"><span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium capitalize ${statusColors[r.status]}`}>{r.status}</span></td>
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