import React, { useEffect, useState, useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useUserRole } from "@/lib/RoleContext";
import { StatCard, StatusBadge, PaymentBadge, EmptyState } from "@/components/po/Shared";
import { formatINR, formatDate, daysOverdue, PO_CATEGORY_LABELS, PO_TYPE_LABELS } from "@/lib/poUtils";
import { FileText, Search, Filter, Download, X, PlusCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function PurchaseOrders() {
  const { role, instituteId, isInstituteAdmin, isFinance, isSuperAdmin } = useUserRole();
  const [searchParams] = useSearchParams();
  const [pos, setPos] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [institutes, setInstitutes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);

  const [filters, setFilters] = useState({
    q: searchParams.get("q") || "",
    institute: searchParams.get("institute") || "",
    vendor: "",
    poNumber: "",
    category: searchParams.get("category") || "",
    type: "",
    status: searchParams.get("status") || "",
    paymentStatus: "",
    dateFrom: "",
    dateTo: "",
  });

  useEffect(() => {
    (async () => {
      try {
        const [list, vens, insts] = await Promise.all([
          base44.entities.PurchaseOrder.list("-created_date", 500),
          base44.entities.Vendor.list(),
          base44.entities.Institute.list(),
        ]);
        setVendors(vens);
        setInstitutes(insts);
        setPos(list.filter((p) => !p.deleted));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered = useMemo(() => {
    return pos.filter((p) => {
      if (isInstituteAdmin && instituteId && p.institute_id !== instituteId) return false;
      if (isFinance && !["approved", "payment_pending", "partially_paid", "fully_paid", "closed"].includes(p.status)) return false;
      const f = filters;
      if (f.q) {
        const q = f.q.toLowerCase();
        if (![p.po_number, p.po_title, p.vendor_name, p.institute_name, p.description].some((v) => (v || "").toLowerCase().includes(q))) return false;
      }
      if (f.institute && p.institute_id !== f.institute) return false;
      if (f.vendor && p.vendor_id !== f.vendor) return false;
      if (f.poNumber && !p.po_number.toLowerCase().includes(f.poNumber.toLowerCase())) return false;
      if (f.category && p.po_category !== f.category) return false;
      if (f.type && p.po_type !== f.type) return false;
      if (f.status && p.status !== f.status) return false;
      if (f.paymentStatus && p.payment_status !== f.paymentStatus) return false;
      if (f.dateFrom && p.created_date && new Date(p.created_date) < new Date(f.dateFrom)) return false;
      if (f.dateTo && p.created_date && new Date(p.created_date) > new Date(f.dateTo)) return false;
      return true;
    });
  }, [pos, filters, isInstituteAdmin, instituteId, isFinance]);

  const totalValue = filtered.reduce((s, p) => s + (p.grand_total || 0), 0);
  const activeFilters = Object.entries(filters).filter(([, v]) => v).length;

  const clearFilters = () => setFilters({ q: "", institute: "", vendor: "", poNumber: "", category: "", type: "", status: "", paymentStatus: "", dateFrom: "", dateTo: "" });

  const exportCSV = () => {
    const headers = ["PO Number", "Title", "Institute", "Vendor", "Category", "Type", "Status", "Payment", "Grand Total", "Paid", "Outstanding", "Due Date"];
    const rows = filtered.map((p) => [p.po_number, p.po_title, p.institute_name, p.vendor_name, p.po_category, p.po_type, p.status, p.payment_status, p.grand_total, p.amount_paid, p.outstanding_amount, p.due_date]);
    const csv = [headers, ...rows].map((r) => r.map((c) => `"${c ?? ""}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "purchase-orders.csv"; a.click();
  };

  if (loading) return <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Purchase Orders</h1>
          <p className="text-sm text-slate-500 mt-0.5">{filtered.length} POs · Total value {formatINR(totalValue)}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowFilters(!showFilters)} className="border-slate-200">
            <Filter className="w-4 h-4 mr-1.5" /> Filters {activeFilters > 0 && <span className="ml-1 px-1.5 py-0.5 bg-slate-800 text-white rounded-full text-[10px]">{activeFilters}</span>}
          </Button>
          <Button variant="outline" size="sm" onClick={exportCSV} className="border-slate-200">
            <Download className="w-4 h-4 mr-1.5" /> Export
          </Button>
          {isInstituteAdmin && (
            <Link to="/create-po">
              <Button size="sm" className="bg-slate-900 hover:bg-slate-800">
                <PlusCircle className="w-4 h-4 mr-1.5" /> Create PO
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* Search bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          placeholder="Search by PO number, vendor, institute, description..."
          value={filters.q}
          onChange={(e) => setFilters({ ...filters, q: e.target.value })}
          className="w-full pl-9 pr-3 py-2.5 text-sm rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-slate-200"
        />
      </div>

      {/* Filters panel */}
      {showFilters && (
        <div className="bg-white rounded-xl border border-slate-200 p-4 grid grid-cols-2 lg:grid-cols-4 gap-3">
          {!isInstituteAdmin && (
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">Institute</label>
              <Select value={filters.institute} onValueChange={(v) => setFilters({ ...filters, institute: v })}>
                <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="All" /></SelectTrigger>
                <SelectContent>{institutes.map((i) => <SelectItem key={i.id} value={i.id}>{i.institute_name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          )}
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">Vendor</label>
            <Select value={filters.vendor} onValueChange={(v) => setFilters({ ...filters, vendor: v })}>
              <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="All" /></SelectTrigger>
              <SelectContent>{vendors.map((v) => <SelectItem key={v.id} value={v.id}>{v.vendor_name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">PO Number</label>
            <input value={filters.poNumber} onChange={(e) => setFilters({ ...filters, poNumber: e.target.value })} className="w-full h-9 px-3 text-sm rounded-lg border border-slate-200" placeholder="PO Number" />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">Capex/Opex</label>
            <Select value={filters.category} onValueChange={(v) => setFilters({ ...filters, category: v })}>
              <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="All" /></SelectTrigger>
              <SelectContent><SelectItem value="capex">Capex</SelectItem><SelectItem value="opex">Opex</SelectItem></SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">PO Type</label>
            <Select value={filters.type} onValueChange={(v) => setFilters({ ...filters, type: v })}>
              <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="All" /></SelectTrigger>
              <SelectContent><SelectItem value="standard">Standard</SelectItem><SelectItem value="open">Open</SelectItem></SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">Status</label>
            <Select value={filters.status} onValueChange={(v) => setFilters({ ...filters, status: v })}>
              <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="All" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">Draft</SelectItem><SelectItem value="pending_approval">Pending Approval</SelectItem>
                <SelectItem value="approved">Approved</SelectItem><SelectItem value="rejected">Rejected</SelectItem>
                <SelectItem value="sent_back">Sent Back</SelectItem><SelectItem value="payment_pending">Payment Pending</SelectItem>
                <SelectItem value="partially_paid">Partially Paid</SelectItem><SelectItem value="fully_paid">Fully Paid</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">Payment Status</label>
            <Select value={filters.paymentStatus} onValueChange={(v) => setFilters({ ...filters, paymentStatus: v })}>
              <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="All" /></SelectTrigger>
              <SelectContent><SelectItem value="none">None</SelectItem><SelectItem value="pending">Pending</SelectItem><SelectItem value="partial">Partial</SelectItem><SelectItem value="paid">Paid</SelectItem></SelectContent>
            </Select>
          </div>
          <div className="flex items-end gap-2">
            <div className="flex-1"><label className="text-xs font-medium text-slate-500 mb-1 block">From</label><input type="date" value={filters.dateFrom} onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })} className="w-full h-9 px-2 text-sm rounded-lg border border-slate-200" /></div>
            <div className="flex-1"><label className="text-xs font-medium text-slate-500 mb-1 block">To</label><input type="date" value={filters.dateTo} onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })} className="w-full h-9 px-2 text-sm rounded-lg border border-slate-200" /></div>
          </div>
          {activeFilters > 0 && <Button variant="ghost" size="sm" onClick={clearFilters} className="text-slate-500"><X className="w-3.5 h-3.5 mr-1" /> Clear</Button>}
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {filtered.length === 0 ? (
          <EmptyState icon={FileText} title="No purchase orders found" sub="Try adjusting your filters or create a new PO." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">PO Number</th>
                  <th className="text-left px-4 py-3 font-medium">Title</th>
                  {isSuperAdmin && <th className="text-left px-4 py-3 font-medium">Institute</th>}
                  <th className="text-left px-4 py-3 font-medium">Vendor</th>
                  <th className="text-left px-4 py-3 font-medium">Cat/Type</th>
                  <th className="text-right px-4 py-3 font-medium">Amount</th>
                  <th className="text-right px-4 py-3 font-medium">Outstanding</th>
                  <th className="text-left px-4 py-3 font-medium">Due Date</th>
                  <th className="text-left px-4 py-3 font-medium">Status</th>
                  <th className="text-left px-4 py-3 font-medium">Payment</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((p) => {
                  const od = daysOverdue(p.due_date, p.outstanding_amount);
                  return (
                    <tr key={p.id} className="hover:bg-slate-50 cursor-pointer" onClick={() => window.location.href = `/po/${p.id}`}>
                      <td className="px-4 py-3 font-medium text-slate-800 whitespace-nowrap">{p.po_number}</td>
                      <td className="px-4 py-3 text-slate-600 max-w-[200px] truncate">{p.po_title}</td>
                      {isSuperAdmin && <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{p.institute_name}</td>}
                      <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{p.vendor_name}</td>
                      <td className="px-4 py-3"><div className="text-xs"><div className="text-slate-700 font-medium">{PO_CATEGORY_LABELS[p.po_category]}</div><div className="text-slate-400">{PO_TYPE_LABELS[p.po_type]}</div></div></td>
                      <td className="px-4 py-3 text-right font-medium text-slate-800 whitespace-nowrap">{formatINR(p.grand_total)}</td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <span className={od > 0 ? "text-red-600 font-medium" : "text-slate-600"}>{formatINR(p.outstanding_amount)}</span>
                        {od > 0 && <div className="text-[10px] text-red-500">{od}d overdue</div>}
                      </td>
                      <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{formatDate(p.due_date)}</td>
                      <td className="px-4 py-3"><StatusBadge status={p.status} /></td>
                      <td className="px-4 py-3"><PaymentBadge status={p.payment_status} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}