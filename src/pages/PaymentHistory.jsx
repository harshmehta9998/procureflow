import React, { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useUserRole } from "@/lib/RoleContext";
import { StatCard, EmptyState } from "@/components/po/Shared";
import { formatINR, formatDate } from "@/lib/poUtils";
import { History, Filter, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function PaymentHistory() {
  const { isSuperAdmin, isFinance, isCentreHead, scopeInstituteIds, activeInstitute } = useUserRole();
  const navigate = useNavigate();
  const [payments, setPayments] = useState([]);
  const [pos, setPos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ q: "", institute: "", mode: "", dateFrom: "", dateTo: "" });
  const [showFilters, setShowFilters] = useState(false);
  const [institutes, setInstitutes] = useState([]);

  useEffect(() => {
    (async () => {
      try {
        const [pays, allPos, insts] = await Promise.all([
          base44.entities.Payment.list("-payment_date", 1000),
          base44.entities.PurchaseOrder.list("-created_date", 500),
          base44.entities.Institute.list(),
        ]);
        setPayments(pays);
        setPos(allPos.filter((p) => !p.deleted));
        setInstitutes(insts);
      } finally { setLoading(false); }
    })();
  }, []);

  const poMap = useMemo(() => { const m = {}; pos.forEach((p) => (m[p.id] = p)); return m; }, [pos]);

  const filtered = useMemo(() => payments.filter((p) => {
    if (scopeInstituteIds !== null && !scopeInstituteIds.includes(p.institute_id)) return false;
    const f = filters;
    if (f.q) { const q = f.q.toLowerCase(); if (![p.po_number, p.vendor_name, p.institute_name, p.reference_number].some((v) => (v || "").toLowerCase().includes(q))) return false; }
    if (f.institute && p.institute_id !== f.institute) return false;
    if (f.mode && p.payment_mode !== f.mode) return false;
    if (f.dateFrom && p.payment_date && p.payment_date < f.dateFrom) return false;
    if (f.dateTo && p.payment_date && p.payment_date > f.dateTo) return false;
    return true;
  }), [payments, filters, scopeInstituteIds]);

  const totalPaid = filtered.reduce((s, p) => s + (p.amount_paid || 0), 0);

  if (loading) return <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div><h1 className="text-2xl font-bold text-slate-800">Payment History</h1><p className="text-sm text-slate-500 mt-0.5">{filtered.length} payments · {formatINR(totalPaid)} released</p></div>
        <Button variant="outline" size="sm" onClick={() => setShowFilters(!showFilters)}><Filter className="w-4 h-4 mr-1.5" /> Filters</Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Total Payments" value={filtered.length} icon={History} accent="slate" />
        <StatCard label="Total Released" value={formatINR(totalPaid)} icon={History} accent="emerald" />
        <StatCard label="This Month" value={formatINR(filtered.filter((p) => p.payment_date && p.payment_date.startsWith(new Date().toISOString().slice(0, 7))).reduce((s, p) => s + p.amount_paid, 0))} icon={History} accent="blue" />
        <StatCard label="Avg Payment" value={formatINR(filtered.length ? totalPaid / filtered.length : 0)} icon={History} accent="purple" />
      </div>

      {showFilters && (
        <div className="bg-white rounded-xl border border-slate-200 p-4 grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div><Label className="text-xs">Search</Label><Input value={filters.q} onChange={(e) => setFilters({ ...filters, q: e.target.value })} className="h-9 mt-1" placeholder="PO/vendor/ref" /></div>
          <div><Label className="text-xs">Institute</Label><Select value={filters.institute} onValueChange={(v) => setFilters({ ...filters, institute: v })}><SelectTrigger className="h-9 mt-1"><SelectValue placeholder="All" /></SelectTrigger><SelectContent><SelectItem value={null}>All</SelectItem>{institutes.map((i) => <SelectItem key={i.id} value={i.id}>{i.institute_name}</SelectItem>)}</SelectContent></Select></div>
          <div><Label className="text-xs">Mode</Label><Select value={filters.mode} onValueChange={(v) => setFilters({ ...filters, mode: v })}><SelectTrigger className="h-9 mt-1"><SelectValue placeholder="All" /></SelectTrigger><SelectContent><SelectItem value={null}>All</SelectItem>{["NEFT", "RTGS", "IMPS", "Cheque", "Cash"].map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent></Select></div>
          <div className="flex gap-2 items-end"><div className="flex-1"><Label className="text-xs">From</Label><Input type="date" value={filters.dateFrom} onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })} className="h-9 mt-1" /></div><div className="flex-1"><Label className="text-xs">To</Label><Input type="date" value={filters.dateTo} onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })} className="h-9 mt-1" /></div></div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {filtered.length === 0 ? <EmptyState icon={History} title="No payments recorded" /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs text-slate-500 uppercase"><tr>
                <th className="text-left px-4 py-3 font-medium">Date</th>
                <th className="text-left px-4 py-3 font-medium">PO Number</th>
                <th className="text-left px-4 py-3 font-medium">Institute</th>
                <th className="text-left px-4 py-3 font-medium">Vendor</th>
                <th className="text-left px-4 py-3 font-medium">Milestone</th>
                <th className="text-right px-4 py-3 font-medium">Amount</th>
                <th className="text-left px-4 py-3 font-medium">Mode</th>
                <th className="text-left px-4 py-3 font-medium">Reference</th>
                <th className="text-left px-4 py-3 font-medium">Proof</th>
                <th className="text-left px-4 py-3 font-medium">Recorded By</th>
              </tr></thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50 cursor-pointer" onClick={() => navigate(`/po/${p.po_id}`)}>
                    <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{formatDate(p.payment_date)}</td>
                    <td className="px-4 py-3 font-medium text-slate-800">{p.po_number}</td>
                    <td className="px-4 py-3 text-slate-600">{p.institute_name}</td>
                    <td className="px-4 py-3 text-slate-600">{p.vendor_name}</td>
                    <td className="px-4 py-3 text-slate-600">{p.milestone_name || "-"}</td>
                    <td className="px-4 py-3 text-right font-medium text-emerald-600">{formatINR(p.amount_paid)}</td>
                    <td className="px-4 py-3 text-slate-600">{p.payment_mode}</td>
                    <td className="px-4 py-3 text-slate-600">{p.reference_number || "-"}</td>
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      {p.attachment_url ? (
                        <a href={p.attachment_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-blue-600 text-xs font-medium hover:underline">
                          <ExternalLink className="w-3.5 h-3.5" /> View
                        </a>
                      ) : <span className="text-slate-300 text-xs">—</span>}
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-xs">{p.recorded_by_name || "-"}</td>
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