import React, { useEffect, useState, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useUserRole } from "@/lib/RoleContext";
import { StatCard, EmptyState } from "@/components/po/Shared";
import { formatINR, formatDate, todayISO, generateRequestNumber, logAudit, ROLE_LABELS } from "@/lib/poUtils";
import { PRBadge, PR_EXPENSE_LABELS, PR_STATUS_LABELS } from "@/lib/workflowUtils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Receipt, Plus, Filter, X, Upload, CheckCircle, XCircle, Wallet } from "lucide-react";
import { toast } from "sonner";

export default function PaymentRequests() {
  const { role, instituteId, instituteIds, userName, isInstituteAdmin, isFinance, isSuperAdmin, isCentreHead, managesInstitute } = useUserRole();
  const [searchParams] = useSearchParams();
  const [requests, setRequests] = useState([]);
  const [institutes, setInstitutes] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    q: searchParams.get("q") || "",
    institute: searchParams.get("institute") || "",
    category: "",
    status: "",
    dateFrom: "",
    dateTo: "",
  });

  const fetchData = async () => {
    try {
      const [list, insts, vens] = await Promise.all([
        base44.entities.PaymentRequest.list("-created_date", 500),
        base44.entities.Institute.list(),
        base44.entities.Vendor.list(),
      ]);
      setRequests(list.filter((r) => !r.deleted));
      setInstitutes(insts);
      setVendors(vens);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const filtered = useMemo(() => {
    return requests.filter((r) => {
      if (isInstituteAdmin && instituteId && r.institute_id !== instituteId) return false;
      if (isCentreHead && instituteIds && instituteIds.length > 0 && !instituteIds.includes(r.institute_id)) return false;
      const f = filters;
      if (f.q) {
        const q = f.q.toLowerCase();
        if (![r.request_number, r.requester_name, r.vendor_name, r.institute_name, r.description].some((v) => (v || "").toLowerCase().includes(q))) return false;
      }
      if (f.institute && r.institute_id !== f.institute) return false;
      if (f.category && r.expense_category !== f.category) return false;
      if (f.status && r.status !== f.status) return false;
      if (f.dateFrom && r.required_date && r.required_date < f.dateFrom) return false;
      if (f.dateTo && r.required_date && r.required_date > f.dateTo) return false;
      return true;
    });
  }, [requests, filters, isInstituteAdmin, instituteId, isCentreHead, instituteIds]);

  const totalRequested = filtered.reduce((s, r) => s + (r.amount || 0), 0);
  const totalPaid = filtered.filter((r) => r.status === "paid").reduce((s, r) => s + (r.amount_paid || 0), 0);
  const totalPending = filtered.filter((r) => ["pending_centre_head", "pending_super_admin", "payment_pending", "sent_to_finance"].includes(r.status)).reduce((s, r) => s + (r.amount || 0), 0);

  // Institute-wise summary
  const instSummary = useMemo(() => {
    const map = {};
    filtered.forEach((r) => {
      const k = r.institute_id;
      if (!map[k]) map[k] = { name: r.institute_name, requested: 0, approved: 0, paid: 0, pending: 0 };
      map[k].requested += r.amount || 0;
      if (["centre_head_approved", "super_admin_approved", "sent_to_finance", "payment_pending", "paid"].includes(r.status)) map[k].approved += r.amount || 0;
      if (r.status === "paid") map[k].paid += r.amount_paid || 0;
      if (["pending_centre_head", "pending_super_admin", "payment_pending", "sent_to_finance"].includes(r.status)) map[k].pending += r.amount || 0;
    });
    return Object.entries(map).map(([id, v]) => ({ id, ...v }));
  }, [filtered]);

  const canAct = (r) => {
    if (r.status === "pending_centre_head") return isCentreHead && managesInstitute(r.institute_id) || isSuperAdmin;
    if (r.status === "pending_super_admin") return isSuperAdmin;
    if (["sent_to_finance", "payment_pending"].includes(r.status)) return isFinance;
    return false;
  };

  const act = async (r, newStatus, commentField, commentValue, action) => {
    const update = { status: newStatus };
    if (commentField) update[commentField] = commentValue;
    if (newStatus === "centre_head_approved") { update.centre_head_approved_by = userName; update.centre_head_approved_date = todayISO(); update.status = "pending_super_admin"; }
    if (newStatus === "super_admin_approved") { update.super_admin_approved_by = userName; update.super_admin_approved_date = todayISO(); update.status = "sent_to_finance"; }
    await base44.entities.PaymentRequest.update(r.id, update);
    await logAudit("PaymentRequest", r.id, r.request_number, userName, action, r.status, update.status, commentValue || "");
    toast.success(action);
    fetchData();
  };

  const recordPayment = async (r, amount, ref, mode) => {
    await base44.entities.PaymentRequest.update(r.id, {
      status: "paid", amount_paid: Number(amount), payment_date: todayISO(), payment_reference: ref, payment_mode: mode, recorded_by_name: userName,
    });
    await logAudit("PaymentRequest", r.id, r.request_number, userName, "Payment Request Paid", "", formatINR(amount), ref);
    toast.success("Payment recorded");
    fetchData();
  };

  if (loading) return <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Request for Payment</h1>
          <p className="text-sm text-slate-500 mt-0.5">{filtered.length} requests · Requested {formatINR(totalRequested)} · Paid {formatINR(totalPaid)}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowFilters(!showFilters)}><Filter className="w-4 h-4 mr-1.5" /> Filters</Button>
          {isInstituteAdmin && (
            <Button size="sm" className="bg-slate-900" onClick={() => setShowCreate(true)}><Plus className="w-4 h-4 mr-1.5" /> New Request</Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Total Requests" value={filtered.length} icon={Receipt} accent="slate" />
        <StatCard label="Requested Amount" value={formatINR(totalRequested)} icon={Wallet} accent="blue" />
        <StatCard label="Pending Approval" value={formatINR(totalPending)} icon={Filter} accent="amber" />
        <StatCard label="Paid" value={formatINR(totalPaid)} icon={CheckCircle} accent="emerald" />
      </div>

      {showFilters && (
        <div className="bg-white rounded-xl border border-slate-200 p-4 grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div><label className="text-xs font-medium text-slate-500 mb-1 block">Institute</label>
            <Select value={filters.institute} onValueChange={(v) => setFilters({ ...filters, institute: v })}><SelectTrigger className="h-9"><SelectValue placeholder="All" /></SelectTrigger><SelectContent><SelectItem value={null}>All</SelectItem>{institutes.map((i) => <SelectItem key={i.id} value={i.id}>{i.institute_name}</SelectItem>)}</SelectContent></Select>
          </div>
          <div><label className="text-xs font-medium text-slate-500 mb-1 block">Category</label>
            <Select value={filters.category} onValueChange={(v) => setFilters({ ...filters, category: v })}><SelectTrigger className="h-9"><SelectValue placeholder="All" /></SelectTrigger><SelectContent><SelectItem value={null}>All</SelectItem>{Object.entries(PR_EXPENSE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent></Select>
          </div>
          <div><label className="text-xs font-medium text-slate-500 mb-1 block">Status</label>
            <Select value={filters.status} onValueChange={(v) => setFilters({ ...filters, status: v })}><SelectTrigger className="h-9"><SelectValue placeholder="All" /></SelectTrigger><SelectContent><SelectItem value={null}>All</SelectItem>{Object.entries(PR_STATUS_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent></Select>
          </div>
          <div className="flex gap-2 items-end">
            <div className="flex-1"><label className="text-xs font-medium text-slate-500 mb-1 block">From</label><Input type="date" value={filters.dateFrom} onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })} className="h-9" /></div>
            <div className="flex-1"><label className="text-xs font-medium text-slate-500 mb-1 block">To</label><Input type="date" value={filters.dateTo} onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })} className="h-9" /></div>
          </div>
        </div>
      )}

      {instSummary.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-200"><h3 className="font-semibold text-slate-800 text-sm">Institution-wise Summary</h3></div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs text-slate-500 uppercase"><tr><th className="text-left px-5 py-2.5 font-medium">Institution</th><th className="text-right px-5 py-2.5 font-medium">Requested</th><th className="text-right px-5 py-2.5 font-medium">Approved</th><th className="text-right px-5 py-2.5 font-medium">Paid</th><th className="text-right px-5 py-2.5 font-medium">Pending</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {instSummary.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50 cursor-pointer" onClick={() => setFilters({ ...filters, institute: s.id })}>
                    <td className="px-5 py-3 font-medium text-slate-700">{s.name}</td>
                    <td className="px-5 py-3 text-right">{formatINR(s.requested)}</td>
                    <td className="px-5 py-3 text-right">{formatINR(s.approved)}</td>
                    <td className="px-5 py-3 text-right text-emerald-600">{formatINR(s.paid)}</td>
                    <td className="px-5 py-3 text-right text-amber-600">{formatINR(s.pending)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {filtered.length === 0 ? <EmptyState icon={Receipt} title="No payment requests" sub="Create a new request to get started." /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs text-slate-500 uppercase"><tr>
                <th className="text-left px-4 py-3 font-medium">Request #</th>
                {(isSuperAdmin || isCentreHead || isFinance) && <th className="text-left px-4 py-3 font-medium">Institute</th>}
                <th className="text-left px-4 py-3 font-medium">Requester</th>
                <th className="text-left px-4 py-3 font-medium">Category</th>
                <th className="text-right px-4 py-3 font-medium">Amount</th>
                <th className="text-left px-4 py-3 font-medium">Required Date</th>
                <th className="text-left px-4 py-3 font-medium">Status</th>
                <th className="text-right px-4 py-3 font-medium">Action</th>
              </tr></thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((r) => (
                  <PRRow key={r.id} r={r} canAct={canAct(r)} onAct={act} onPay={recordPayment} showInstitute={isSuperAdmin || isCentreHead || isFinance} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showCreate && <CreateRequestModal institutes={institutes} vendors={vendors} userName={userName} instituteId={instituteId} onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); fetchData(); }} />}
    </div>
  );
}

function PRRow({ r, canAct, onAct, onPay, showInstitute }) {
  const [comment, setComment] = useState("");
  const [payOpen, setPayOpen] = useState(false);
  const [amt, setAmt] = useState(r.amount || 0);
  const [ref, setRef] = useState("");
  const [mode, setMode] = useState("NEFT");
  return (
    <tr className="hover:bg-slate-50">
      <td className="px-4 py-3 font-medium text-slate-800">{r.request_number}</td>
      {showInstitute && <td className="px-4 py-3 text-slate-600">{r.institute_name}</td>}
      <td className="px-4 py-3 text-slate-600">{r.requester_name}</td>
      <td className="px-4 py-3 text-slate-600">{PR_EXPENSE_LABELS[r.expense_category]}</td>
      <td className="px-4 py-3 text-right font-medium">{formatINR(r.amount)}</td>
      <td className="px-4 py-3 text-slate-600">{formatDate(r.required_date)}</td>
      <td className="px-4 py-3"><PRBadge status={r.status} /></td>
      <td className="px-4 py-3 text-right">
        {canAct && (
          <div className="flex justify-end gap-1">
            {r.status === "pending_centre_head" && <>
              <Button size="sm" className="h-7 bg-emerald-600" onClick={() => onAct(r, "centre_head_approved", "centre_head_comment", comment, "Centre Head Approved")}>Approve</Button>
              <Button size="sm" variant="outline" className="h-7 border-red-200 text-red-600" onClick={() => onAct(r, "centre_head_rejected", "centre_head_comment", comment, "Centre Head Rejected")}>Reject</Button>
            </>}
            {r.status === "pending_super_admin" && <>
              <Button size="sm" className="h-7 bg-emerald-600" onClick={() => onAct(r, "super_admin_approved", "super_admin_comment", comment, "Super Admin Approved")}>Approve</Button>
              <Button size="sm" variant="outline" className="h-7 border-red-200 text-red-600" onClick={() => onAct(r, "super_admin_rejected", "super_admin_comment", comment, "Super Admin Rejected")}>Reject</Button>
            </>}
            {["sent_to_finance", "payment_pending"].includes(r.status) && (
              <Button size="sm" className="h-7 bg-slate-900" onClick={() => setPayOpen(!payOpen)}><Wallet className="w-3 h-3 mr-1" /> Pay</Button>
            )}
          </div>
        )}
        {r.status === "paid" && <span className="text-xs text-emerald-600">Paid {formatINR(r.amount_paid)}</span>}
        {canAct && ["pending_centre_head", "pending_super_admin"].includes(r.status) && (
          <Input value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Comment..." className="h-7 mt-1 text-xs" />
        )}
        {payOpen && (
          <div className="mt-2 p-2 border border-slate-200 rounded-lg bg-slate-50 text-left">
            <Input type="number" value={amt} onChange={(e) => setAmt(e.target.value)} className="h-7 text-xs mb-1" placeholder="Amount" />
            <Input value={ref} onChange={(e) => setRef(e.target.value)} className="h-7 text-xs mb-1" placeholder="Reference" />
            <Select value={mode} onValueChange={setMode}><SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger><SelectContent>{["NEFT", "RTGS", "IMPS", "Cheque", "Cash"].map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent></Select>
            <Button size="sm" className="h-7 bg-emerald-600 mt-1 w-full" onClick={() => onPay(r, amt, ref, mode)}>Confirm Payment</Button>
          </div>
        )}
      </td>
    </tr>
  );
}

function CreateRequestModal({ institutes, vendors, userName, instituteId, onClose, onCreated }) {
  const [form, setForm] = useState({
    institute_id: instituteId || "",
    amount: 0,
    expense_category: "petty_cash",
    description: "",
    required_date: todayISO(),
    vendor_id: "",
    payment_mode: "NEFT",
    remarks: "",
    attachment_url: "",
  });
  const [saving, setSaving] = useState(false);

  const upload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try { const { file_url } = await base44.integrations.Core.UploadFile({ file }); setForm({ ...form, attachment_url: file_url }); toast.success("Uploaded"); } catch { toast.error("Upload failed"); }
  };

  const save = async (submit) => {
    if (!form.institute_id) return toast.error("Select institute");
    if (!form.amount || form.amount <= 0) return toast.error("Enter amount");
    setSaving(true);
    try {
      const inst = institutes.find((i) => i.id === form.institute_id);
      const ven = vendors.find((v) => v.id === form.vendor_id);
      const num = await generateRequestNumber(inst.institute_code);
      await base44.entities.PaymentRequest.create({
        ...form,
        request_number: num,
        institute_name: inst.institute_name,
        institute_code: inst.institute_code,
        requester_name: userName,
        vendor_name: ven?.vendor_name || "",
        status: submit ? "pending_centre_head" : "draft",
      });
      toast.success(submit ? "Request submitted for approval" : "Draft saved");
      onCreated();
    } catch (err) { toast.error(err.message || "Failed"); } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-slate-800">New Payment Request</h3>
          <Button variant="ghost" size="sm" onClick={onClose}><X className="w-4 h-4" /></Button>
        </div>
        <div className="space-y-3">
          <div><Label className="text-xs">Institute *</Label>
            <Select value={form.institute_id} onValueChange={(v) => setForm({ ...form, institute_id: v })} disabled={!!instituteId}><SelectTrigger className="h-9 mt-1"><SelectValue placeholder="Select" /></SelectTrigger><SelectContent>{institutes.map((i) => <SelectItem key={i.id} value={i.id}>{i.institute_name}</SelectItem>)}</SelectContent></Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label className="text-xs">Amount *</Label><Input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })} className="h-9 mt-1" /></div>
            <div><Label className="text-xs">Required Date *</Label><Input type="date" value={form.required_date} onChange={(e) => setForm({ ...form, required_date: e.target.value })} className="h-9 mt-1" /></div>
          </div>
          <div><Label className="text-xs">Expense Category</Label>
            <Select value={form.expense_category} onValueChange={(v) => setForm({ ...form, expense_category: v })}><SelectTrigger className="h-9 mt-1"><SelectValue /></SelectTrigger><SelectContent>{Object.entries(PR_EXPENSE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent></Select>
          </div>
          <div><Label className="text-xs">Payee / Vendor (optional)</Label>
            <Select value={form.vendor_id} onValueChange={(v) => setForm({ ...form, vendor_id: v })}><SelectTrigger className="h-9 mt-1"><SelectValue placeholder="None" /></SelectTrigger><SelectContent><SelectItem value={null}>None</SelectItem>{vendors.map((v) => <SelectItem key={v.id} value={v.id}>{v.vendor_name}</SelectItem>)}</SelectContent></Select>
          </div>
          <div><Label className="text-xs">Description</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} className="mt-1" /></div>
          <div><Label className="text-xs">Remarks</Label><Input value={form.remarks} onChange={(e) => setForm({ ...form, remarks: e.target.value })} className="h-9 mt-1" /></div>
          <div><Label className="text-xs">Supporting Document</Label>
            <label className="flex items-center gap-2 mt-1 px-3 py-2 border border-dashed border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50 text-sm text-slate-500"><Upload className="w-4 h-4" /> {form.attachment_url ? "Uploaded ✓" : "Upload"}<input type="file" className="hidden" onChange={upload} /></label>
          </div>
        </div>
        <div className="flex gap-2 mt-4">
          <Button variant="outline" className="flex-1" onClick={() => save(false)} disabled={saving}>Save Draft</Button>
          <Button className="flex-1 bg-slate-900" onClick={() => save(true)} disabled={saving}>Submit for Approval</Button>
        </div>
      </div>
    </div>
  );
}