import React, { useEffect, useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useUserRole } from "@/lib/RoleContext";
import { StatCard, EmptyState } from "@/components/po/Shared";
import { formatINR, formatDate, todayISO, generateRecurringNumber, generateInstallmentSchedule, logAudit } from "@/lib/poUtils";
import { RPBadge, RP_CATEGORY_LABELS, FREQUENCY_LABELS, RP_STATUS_LABELS, getInstanceStatus, PR_INSTANCE_STATUS_COLORS, PR_INSTANCE_STATUS_LABELS } from "@/lib/workflowUtils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalendarClock, Plus, Filter, X, Upload, CheckCircle, XCircle, Wallet, Play, Pause, ShieldAlert } from "lucide-react";
import { toast } from "sonner";

export default function RecurringPayments() {
  const { role, instituteId, instituteIds, userName, isInstituteAdmin, isFinance, isSuperAdmin, isCentreHead, managesInstitute } = useUserRole();
  const [recurring, setRecurring] = useState([]);
  const [instances, setInstances] = useState([]);
  const [institutes, setInstitutes] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [selected, setSelected] = useState(null);

  const fetchData = async () => {
    try {
      const [list, insts, vens] = await Promise.all([
        base44.entities.RecurringPayment.list("-created_date", 500),
        base44.entities.RecurringPaymentInstance.list("-due_date", 2000),
        base44.entities.Institute.list(),
        base44.entities.Vendor.list(),
      ]);
      setRecurring(list.filter((r) => !r.deleted));
      setInstances(insts.filter((i) => !i.deleted));
      setInstitutes(insts);
      setVendors(vens);
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, []);

  const visibleRecurring = useMemo(() => recurring.filter((r) => {
    if (isInstituteAdmin && instituteId && r.institute_id !== instituteId) return false;
    if (isCentreHead && instituteIds && instituteIds.length > 0 && !instituteIds.includes(r.institute_id)) return false;
    return true;
  }), [recurring, isInstituteAdmin, instituteId, isCentreHead, instituteIds]);

  const visibleInstances = useMemo(() => {
    const recIds = new Set(visibleRecurring.map((r) => r.id));
    return instances.filter((i) => recIds.has(i.recurring_id));
  }, [instances, visibleRecurring]);

  const approve = async (r, stage) => {
    const update = {};
    if (stage === "centre_head") { update.status = "pending_super_admin"; update.centre_head_approved_by = userName; update.centre_head_approved_date = todayISO(); }
    if (stage === "super_admin") {
      update.status = "active"; update.super_admin_approved_by = userName; update.super_admin_approved_date = todayISO();
      // generate instances
      const schedule = generateInstallmentSchedule(r.start_date, r.end_date, r.frequency, r.due_day_of_month, r.amount);
      if (schedule.length > 0) {
        await base44.entities.RecurringPaymentInstance.bulkCreate(schedule.map((s) => ({
          recurring_id: r.id, recurring_number: r.recurring_number, institute_id: r.institute_id, institute_name: r.institute_name,
          payee_vendor_name: r.payee_vendor_name || "", payment_category: r.payment_category, frequency: r.frequency,
          installment_number: s.installment_number, due_date: s.due_date, amount: s.amount, outstanding_amount: s.amount,
          status: "pending", description: r.description || "",
        })));
      }
    }
    await base44.entities.RecurringPayment.update(r.id, update);
    await logAudit("RecurringPayment", r.id, r.recurring_number, userName, `${stage} approved`, r.status, update.status, "");
    toast.success("Approved");
    fetchData();
  };

  const reject = async (r, stage) => {
    const update = { status: stage === "centre_head" ? "centre_head_rejected" : "super_admin_rejected" };
    await base44.entities.RecurringPayment.update(r.id, update);
    await logAudit("RecurringPayment", r.id, r.recurring_number, userName, `${stage} rejected`, r.status, update.status, "");
    toast.success("Rejected");
    fetchData();
  };

  const canAct = (r) => {
    if (r.status === "pending_centre_head") return (isCentreHead && managesInstitute(r.institute_id)) || isSuperAdmin;
    if (r.status === "pending_super_admin") return isSuperAdmin;
    return false;
  };

  const payInstance = async (inst, amount, ref, mode) => {
    await base44.entities.RecurringPaymentInstance.update(inst.id, {
      status: "paid", amount_paid: Number(amount), payment_date: todayISO(), payment_reference: ref, payment_mode: mode, recorded_by_name: userName,
    });
    await logAudit("RecurringPaymentInstance", inst.id, inst.recurring_number, userName, "Installment Paid", "", formatINR(amount), ref);
    toast.success("Payment recorded");
    fetchData();
  };

  if (loading) return <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" /></div>;

  // Recurring Payments are confidential — restricted to Super Admin and Finance only.
  if (isInstituteAdmin) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <ShieldAlert className="w-12 h-12 text-slate-300 mb-3" />
        <div className="text-slate-700 font-medium text-lg">Access Restricted</div>
        <p className="text-sm text-slate-500 mt-1 max-w-sm">
          Recurring Payments are confidential and only accessible to Super Admin and Finance.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Recurring Payments</h1>
          <p className="text-sm text-slate-500 mt-0.5">{visibleRecurring.length} schedules · {visibleInstances.length} installments</p>
        </div>
        {(isFinance || isSuperAdmin) && <Button size="sm" className="bg-slate-900" onClick={() => setShowCreate(true)}><Plus className="w-4 h-4 mr-1.5" /> New Recurring Payment</Button>}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Schedules" value={visibleRecurring.length} icon={CalendarClock} accent="slate" />
        <StatCard label="Active" value={visibleRecurring.filter((r) => r.status === "active").length} icon={Play} accent="emerald" />
        <StatCard label="Pending Approval" value={visibleRecurring.filter((r) => ["pending_centre_head", "pending_super_admin"].includes(r.status)).length} icon={Filter} accent="amber" />
        <StatCard label="Installments Due" value={visibleInstances.filter((i) => getInstanceStatus(i, todayISO()) === "pending" || getInstanceStatus(i, todayISO()) === "overdue").length} icon={Wallet} accent="blue" />
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-200"><h3 className="font-semibold text-slate-800 text-sm">Recurring Schedules</h3></div>
        {visibleRecurring.length === 0 ? <EmptyState icon={CalendarClock} title="No recurring payments" sub="Create a rent, EMI or subscription schedule." /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs text-slate-500 uppercase"><tr>
                <th className="text-left px-4 py-3 font-medium">Number</th>
                {(isSuperAdmin || isCentreHead || isFinance) && <th className="text-left px-4 py-3 font-medium">Institute</th>}
                <th className="text-left px-4 py-3 font-medium">Category</th>
                <th className="text-left px-4 py-3 font-medium">Payee</th>
                <th className="text-right px-4 py-3 font-medium">Amount</th>
                <th className="text-left px-4 py-3 font-medium">Frequency</th>
                <th className="text-left px-4 py-3 font-medium">Period</th>
                <th className="text-left px-4 py-3 font-medium">Status</th>
                <th className="text-right px-4 py-3 font-medium">Action</th>
              </tr></thead>
              <tbody className="divide-y divide-slate-100">
                {visibleRecurring.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50 cursor-pointer" onClick={() => setSelected(r)}>
                    <td className="px-4 py-3 font-medium text-slate-800">{r.recurring_number}</td>
                    {(isSuperAdmin || isCentreHead || isFinance) && <td className="px-4 py-3 text-slate-600">{r.institute_name}</td>}
                    <td className="px-4 py-3 text-slate-600">{RP_CATEGORY_LABELS[r.payment_category]}</td>
                    <td className="px-4 py-3 text-slate-600">{r.payee_vendor_name || "-"}</td>
                    <td className="px-4 py-3 text-right font-medium">{formatINR(r.amount)}</td>
                    <td className="px-4 py-3 text-slate-600">{FREQUENCY_LABELS[r.frequency]}</td>
                    <td className="px-4 py-3 text-slate-600">{formatDate(r.start_date)} → {formatDate(r.end_date)}</td>
                    <td className="px-4 py-3"><RPBadge status={r.status} /></td>
                    <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                      {canAct(r) && <>
                        <Button size="sm" className="h-7 bg-emerald-600 mr-1" onClick={() => approve(r, r.status === "pending_centre_head" ? "centre_head" : "super_admin")}>Approve</Button>
                        <Button size="sm" variant="outline" className="h-7 border-red-200 text-red-600" onClick={() => reject(r, r.status === "pending_centre_head" ? "centre_head" : "super_admin")}>Reject</Button>
                      </>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selected && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between">
            <h3 className="font-semibold text-slate-800 text-sm">Installments — {selected.recurring_number}</h3>
            <Button variant="ghost" size="sm" onClick={() => setSelected(null)}><X className="w-4 h-4" /></Button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs text-slate-500 uppercase"><tr>
                <th className="text-left px-4 py-2.5 font-medium">#</th><th className="text-left px-4 py-2.5 font-medium">Due Date</th>
                <th className="text-right px-4 py-2.5 font-medium">Amount</th><th className="text-right px-4 py-2.5 font-medium">Paid</th>
                <th className="text-left px-4 py-2.5 font-medium">Status</th><th className="text-right px-4 py-2.5 font-medium">Action</th>
              </tr></thead>
              <tbody className="divide-y divide-slate-100">
                {visibleInstances.filter((i) => i.recurring_id === selected.id).sort((a, b) => a.installment_number - b.installment_number).map((inst) => (
                  <InstanceRow key={inst.id} inst={inst} canPay={isFinance || isSuperAdmin} onPay={payInstance} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showCreate && <CreateRecurringModal institutes={institutes} vendors={vendors} userName={userName} instituteId={instituteId} creatorRole={role} onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); fetchData(); }} />}
    </div>
  );
}

function InstanceRow({ inst, canPay, onPay }) {
  const [open, setOpen] = useState(false);
  const [amt, setAmt] = useState(inst.amount);
  const [ref, setRef] = useState("");
  const [mode, setMode] = useState("NEFT");
  const status = getInstanceStatus(inst, todayISO());
  return (
    <>
      <tr className="hover:bg-slate-50">
        <td className="px-4 py-3">{inst.installment_number}</td>
        <td className="px-4 py-3 text-slate-600">{formatDate(inst.due_date)}</td>
        <td className="px-4 py-3 text-right font-medium">{formatINR(inst.amount)}</td>
        <td className="px-4 py-3 text-right text-emerald-600">{formatINR(inst.amount_paid)}</td>
        <td className="px-4 py-3"><span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium border ${PR_INSTANCE_STATUS_COLORS[status]}`}>{PR_INSTANCE_STATUS_LABELS[status]}</span></td>
        <td className="px-4 py-3 text-right">
          {canPay && status !== "paid" && <Button size="sm" className="h-7 bg-slate-900" onClick={() => setOpen(!open)}><Wallet className="w-3 h-3 mr-1" /> Pay</Button>}
          {status === "paid" && <span className="text-xs text-emerald-600">{inst.payment_reference}</span>}
        </td>
      </tr>
      {open && (
        <tr><td colSpan={6} className="px-4 py-2 bg-slate-50">
          <div className="flex gap-2 items-end">
            <div><Label className="text-xs">Amount</Label><Input type="number" value={amt} onChange={(e) => setAmt(e.target.value)} className="h-8 text-xs w-28" /></div>
            <div><Label className="text-xs">Reference</Label><Input value={ref} onChange={(e) => setRef(e.target.value)} className="h-8 text-xs w-40" /></div>
            <div><Label className="text-xs">Mode</Label><Select value={mode} onValueChange={setMode}><SelectTrigger className="h-8 text-xs w-24"><SelectValue /></SelectTrigger><SelectContent>{["NEFT", "RTGS", "IMPS", "Cheque", "Cash"].map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent></Select></div>
            <Button size="sm" className="h-8 bg-emerald-600" onClick={() => { onPay(inst, amt, ref, mode); setOpen(false); }}>Confirm</Button>
          </div>
        </td></tr>
      )}
    </>
  );
}

function CreateRecurringModal({ institutes, vendors, userName, instituteId, creatorRole, onClose, onCreated }) {
  const [form, setForm] = useState({
    institute_id: instituteId || "",
    payment_category: "rent",
    payee_vendor_id: "",
    amount: 0,
    frequency: "monthly",
    start_date: todayISO(),
    end_date: "",
    due_day_of_month: 1,
    description: "",
    attachment_url: "",
    auto_renewal: false,
  });
  const [saving, setSaving] = useState(false);

  const schedule = useMemo(() => generateInstallmentSchedule(form.start_date, form.end_date, form.frequency, form.due_day_of_month, form.amount), [form.start_date, form.end_date, form.frequency, form.due_day_of_month, form.amount]);

  const upload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try { const { file_url } = await base44.integrations.Core.UploadFile({ file }); setForm({ ...form, attachment_url: file_url }); toast.success("Uploaded"); } catch { toast.error("Upload failed"); }
  };

  const save = async (submit) => {
    if (!form.institute_id) return toast.error("Select institute");
    if (!form.amount || form.amount <= 0) return toast.error("Enter amount");
    if (!form.start_date) return toast.error("Enter start date");
    setSaving(true);
    try {
      const inst = institutes.find((i) => i.id === form.institute_id);
      const ven = vendors.find((v) => v.id === form.payee_vendor_id);
      const num = await generateRecurringNumber(inst.institute_code);
      // Finance-created recurring payments require Super Admin confirmation;
      // Super Admin-created ones activate immediately with installments generated.
      let status = submit ? (creatorRole === "super_admin" ? "active" : "pending_super_admin") : "draft";
      const created = await base44.entities.RecurringPayment.create({
        ...form,
        recurring_number: num,
        institute_name: inst.institute_name,
        institute_code: inst.institute_code,
        payee_vendor_name: ven?.vendor_name || "",
        num_installments: schedule.length,
        total_amount: schedule.reduce((s, x) => s + x.amount, 0),
        created_by_name: userName,
        status,
        ...(creatorRole === "super_admin" && submit
          ? { super_admin_approved_by: userName, super_admin_approved_date: todayISO() }
          : {}),
      });
      if (submit && creatorRole === "super_admin" && schedule.length > 0) {
        await base44.entities.RecurringPaymentInstance.bulkCreate(schedule.map((s) => ({
          recurring_id: created.id, recurring_number: num, institute_id: inst.id, institute_name: inst.institute_name,
          payee_vendor_name: ven?.vendor_name || "", payment_category: form.payment_category, frequency: form.frequency,
          installment_number: s.installment_number, due_date: s.due_date, amount: s.amount, outstanding_amount: s.amount,
          status: "pending", description: form.description || "",
        })));
      }
      await logAudit("RecurringPayment", created.id, num, userName, submit ? "Recurring Payment Submitted" : "Recurring Payment Draft", "", status, creatorRole === "super_admin" ? "Auto-approved" : "Awaiting Super Admin");
      toast.success(submit ? (creatorRole === "super_admin" ? "Recurring payment created & activated" : "Submitted for Super Admin approval") : "Draft saved");
      onCreated();
    } catch (err) { toast.error(err.message || "Failed"); } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-slate-800">New Recurring Payment</h3>
          <Button variant="ghost" size="sm" onClick={onClose}><X className="w-4 h-4" /></Button>
        </div>
        <div className="space-y-3">
          <div><Label className="text-xs">Institute *</Label>
            <Select value={form.institute_id} onValueChange={(v) => setForm({ ...form, institute_id: v })} disabled={!!instituteId}><SelectTrigger className="h-9 mt-1"><SelectValue placeholder="Select" /></SelectTrigger><SelectContent>{institutes.map((i) => <SelectItem key={i.id} value={i.id}>{i.institute_name}</SelectItem>)}</SelectContent></Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label className="text-xs">Category</Label><Select value={form.payment_category} onValueChange={(v) => setForm({ ...form, payment_category: v })}><SelectTrigger className="h-9 mt-1"><SelectValue /></SelectTrigger><SelectContent>{Object.entries(RP_CATEGORY_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent></Select></div>
            <div><Label className="text-xs">Payee (optional)</Label><Select value={form.payee_vendor_id} onValueChange={(v) => setForm({ ...form, payee_vendor_id: v })}><SelectTrigger className="h-9 mt-1"><SelectValue placeholder="None" /></SelectTrigger><SelectContent><SelectItem value={null}>None</SelectItem>{vendors.map((v) => <SelectItem key={v.id} value={v.id}>{v.vendor_name}</SelectItem>)}</SelectContent></Select></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label className="text-xs">Amount / Installment *</Label><Input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })} className="h-9 mt-1" /></div>
            <div><Label className="text-xs">Frequency</Label><Select value={form.frequency} onValueChange={(v) => setForm({ ...form, frequency: v })}><SelectTrigger className="h-9 mt-1"><SelectValue /></SelectTrigger><SelectContent>{Object.entries(FREQUENCY_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent></Select></div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div><Label className="text-xs">Start Date *</Label><Input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} className="h-9 mt-1" /></div>
            <div><Label className="text-xs">End Date</Label><Input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} className="h-9 mt-1" /></div>
            <div><Label className="text-xs">Due Day</Label><Input type="number" min={1} max={28} value={form.due_day_of_month} onChange={(e) => setForm({ ...form, due_day_of_month: Number(e.target.value) })} className="h-9 mt-1" /></div>
          </div>
          <div><Label className="text-xs">Description</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} className="mt-1" /></div>
          <div><Label className="text-xs">Supporting Document</Label>
            <label className="flex items-center gap-2 mt-1 px-3 py-2 border border-dashed border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50 text-sm text-slate-500"><Upload className="w-4 h-4" /> {form.attachment_url ? "Uploaded ✓" : "Upload"}<input type="file" className="hidden" onChange={upload} /></label>
          </div>
          {schedule.length > 0 && (
            <div className="bg-slate-50 rounded-lg p-3 text-xs text-slate-600">
              <div className="font-medium mb-1">Preview: {schedule.length} installments · Total {formatINR(schedule.reduce((s, x) => s + x.amount, 0))}</div>
              <div className="flex flex-wrap gap-1">{schedule.slice(0, 6).map((s) => <span key={s.installment_number} className="px-1.5 py-0.5 bg-white border border-slate-200 rounded">{formatDate(s.due_date)}</span>)}{schedule.length > 6 && <span>...</span>}</div>
            </div>
          )}
        </div>
        <div className="flex gap-2 mt-4">
          <Button variant="outline" className="flex-1" onClick={() => save(false)} disabled={saving}>Save Draft</Button>
          <Button className="flex-1 bg-slate-900" onClick={() => save(true)} disabled={saving}>Submit for Approval</Button>
        </div>
      </div>
    </div>
  );
}