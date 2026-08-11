import React, { useEffect, useState, useMemo } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useUserRole } from "@/lib/RoleContext";
import { StatCard, EmptyState, StatusBadge } from "@/components/po/Shared";
import { formatINR, formatDate, todayISO, logAudit, canApproveAtCentreHead, calculateDueDate } from "@/lib/poUtils";
import { PRBadge, PR_EXPENSE_LABELS } from "@/lib/workflowUtils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ShieldCheck, CheckCircle, XCircle, Clock } from "lucide-react";
import { toast } from "sonner";

export default function Approvals() {
  const [searchParams] = useSearchParams();
  const stageFilter = searchParams.get("stage");
  const navigate = useNavigate();
  const { role, userName, isSuperAdmin, isCentreHead, instituteIds, managesInstitute } = useUserRole();
  const [pos, setPos] = useState([]);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(stageFilter || (isCentreHead ? "centre_head" : isSuperAdmin ? "super_admin" : "mine"));

  const fetchData = async () => {
    try {
      const [allPos, allPr] = await Promise.all([
        base44.entities.PurchaseOrder.list("-created_date", 500),
        base44.entities.PaymentRequest.list("-created_date", 500),
      ]);
      setPos(allPos.filter((p) => !p.deleted && !p.cancelled));
      setRequests(allPr.filter((r) => !r.deleted));
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, []);

  // POs pending centre head
  const posPendingCentreHead = useMemo(() => pos.filter((p) => {
    if (p.status !== "pending_centre_head") return false;
    if (isSuperAdmin) return true;
    if (isCentreHead) return instituteIds.includes(p.institute_id);
    return false;
  }), [pos, isSuperAdmin, isCentreHead, instituteIds]);

  // POs pending centre head rejected (back to institute admin for resubmit)
  const posRejectedToAdmin = useMemo(() => pos.filter((p) => p.status === "centre_head_rejected"), [pos]);

  // Payment requests pending centre head
  const prPendingCentreHead = useMemo(() => requests.filter((r) => {
    if (r.status !== "pending_centre_head") return false;
    if (isSuperAdmin) return true;
    if (isCentreHead) return instituteIds.includes(r.institute_id);
    return false;
  }), [requests, isSuperAdmin, isCentreHead, instituteIds]);

  // Payment requests pending super admin
  const prPendingSuperAdmin = useMemo(() => requests.filter((r) => r.status === "pending_super_admin"), [requests]);

  const approvePO = async (p, comment) => {
    const approvedDate = todayISO();
    await base44.entities.PurchaseOrder.update(p.id, {
      status: "payment_pending", centre_head_status: "approved", centre_head_comment: comment,
      centre_head_approved_by: userName, centre_head_approved_date: approvedDate, approved_date: approvedDate,
      outstanding_amount: p.grand_total || 0,
    });
    // Recalculate milestone due dates with approved_date
    try {
      const ms = await base44.entities.PaymentMilestone.filter({ po_id: p.id });
      const updatedPo = { ...p, approved_date: approvedDate };
      for (const m of ms) {
        if (m.status === "cancelled" || m.status === "paid") continue;
        const newDue = calculateDueDate({ ...m }, updatedPo);
        if (newDue) await base44.entities.PaymentMilestone.update(m.id, { due_date: newDue, original_due_date: m.original_due_date || newDue });
      }
    } catch {}
    await logAudit("PurchaseOrder", p.id, p.po_number, userName, "Centre Head Approved PO", "pending_centre_head", "payment_pending", comment);
    toast.success("PO approved & sent to Finance");
    fetchData();
  };

  const rejectPO = async (p, comment) => {
    await base44.entities.PurchaseOrder.update(p.id, { status: "centre_head_rejected", centre_head_status: "rejected", centre_head_comment: comment });
    await logAudit("PurchaseOrder", p.id, p.po_number, userName, "Centre Head Rejected PO", "pending_centre_head", "centre_head_rejected", comment);
    toast.success("PO sent back to Institute Admin");
    fetchData();
  };

  const approvePR = async (r, comment) => {
    await base44.entities.PaymentRequest.update(r.id, { status: "pending_super_admin", centre_head_approved_by: userName, centre_head_approved_date: todayISO(), centre_head_comment: comment });
    await logAudit("PaymentRequest", r.id, r.request_number, userName, "Centre Head Approved PR", "pending_centre_head", "pending_super_admin", comment);
    toast.success("Payment request approved");
    fetchData();
  };

  const rejectPR = async (r, comment) => {
    await base44.entities.PaymentRequest.update(r.id, { status: "centre_head_rejected", centre_head_comment: comment });
    await logAudit("PaymentRequest", r.id, r.request_number, userName, "Centre Head Rejected PR", "pending_centre_head", "centre_head_rejected", comment);
    toast.success("Payment request rejected");
    fetchData();
  };

  const approvePRSuper = async (r, comment) => {
    await base44.entities.PaymentRequest.update(r.id, { status: "sent_to_finance", super_admin_approved_by: userName, super_admin_approved_date: todayISO(), super_admin_comment: comment });
    await logAudit("PaymentRequest", r.id, r.request_number, userName, "Super Admin Approved PR", "pending_super_admin", "sent_to_finance", comment);
    toast.success("Sent to Finance");
    fetchData();
  };

  const rejectPRSuper = async (r, comment) => {
    await base44.entities.PaymentRequest.update(r.id, { status: "super_admin_rejected", super_admin_comment: comment });
    await logAudit("PaymentRequest", r.id, r.request_number, userName, "Super Admin Rejected PR", "pending_super_admin", "super_admin_rejected", comment);
    toast.success("Payment request rejected");
    fetchData();
  };

  if (loading) return <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" /></div>;

  const tabs = [];
  if (isCentreHead || isSuperAdmin) tabs.push({ key: "centre_head", label: "Centre Head Approvals" });
  if (isSuperAdmin) tabs.push({ key: "super_admin", label: "Super Admin Approvals" });
  tabs.push({ key: "mine", label: "Returned to Me" });

  const totalPending = posPendingCentreHead.length + prPendingCentreHead.length + prPendingSuperAdmin.length;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Approvals</h1>
        <p className="text-sm text-slate-500 mt-0.5">{totalPending} item(s) awaiting action</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <StatCard label="POs (Centre Head)" value={posPendingCentreHead.length} icon={ShieldCheck} accent="amber" />
        <StatCard label="Payment Requests (Centre Head)" value={prPendingCentreHead.length} icon={Clock} accent="blue" />
        <StatCard label="Payment Requests (Super Admin)" value={prPendingSuperAdmin.length} icon={ShieldCheck} accent="purple" />
      </div>

      <div className="flex gap-2 flex-wrap">
        {tabs.map((t) => (
          <button key={t.key} onClick={() => setActiveTab(t.key)} className={`px-3 py-1.5 rounded-lg text-sm font-medium ${activeTab === t.key ? "bg-slate-900 text-white" : "bg-white border border-slate-200 text-slate-600"}`}>{t.label}</button>
        ))}
      </div>

      {activeTab === "centre_head" && (
        <>
          <ApprovalSection title="POs Awaiting Centre Head Approval" items={posPendingCentreHead} empty="No POs awaiting your approval" type="po" onApprove={approvePO} onReject={rejectPO} navigate={navigate} />
          <ApprovalSection title="Payment Requests Awaiting Centre Head Approval" items={prPendingCentreHead} empty="No payment requests awaiting approval" type="pr" onApprove={approvePR} onReject={rejectPR} />
        </>
      )}
      {activeTab === "super_admin" && (
        <ApprovalSection title="Payment Requests Awaiting Super Admin Approval" items={prPendingSuperAdmin} empty="No payment requests awaiting approval" type="pr_super" onApprove={approvePRSuper} onReject={rejectPRSuper} />
      )}
      {activeTab === "mine" && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-200"><h3 className="font-semibold text-slate-800 text-sm">POs Returned for Correction</h3></div>
          {posRejectedToAdmin.length === 0 ? <EmptyState title="Nothing returned" sub="Rejected POs will appear here for editing." /> : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-xs text-slate-500 uppercase"><tr><th className="text-left px-4 py-3 font-medium">PO</th><th className="text-left px-4 py-3 font-medium">Title</th><th className="text-left px-4 py-3 font-medium">Vendor</th><th className="text-right px-4 py-3 font-medium">Amount</th><th className="text-left px-4 py-3 font-medium">Comment</th><th className="text-right px-4 py-3 font-medium"></th></tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {posRejectedToAdmin.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium">{p.po_number}</td>
                      <td className="px-4 py-3 text-slate-600">{p.po_title}</td>
                      <td className="px-4 py-3 text-slate-600">{p.vendor_name}</td>
                      <td className="px-4 py-3 text-right">{formatINR(p.grand_total)}</td>
                      <td className="px-4 py-3 text-slate-500 text-xs max-w-xs truncate">{p.centre_head_comment}</td>
                      <td className="px-4 py-3 text-right"><Button size="sm" onClick={() => navigate(`/po/${p.id}`)}>Open</Button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ApprovalSection({ title, items, empty, type, onApprove, onReject, navigate }) {
  const [comment, setComment] = useState({});
  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between">
        <h3 className="font-semibold text-slate-800 text-sm">{title}</h3>
        <span className="text-xs text-slate-400">{items.length}</span>
      </div>
      {items.length === 0 ? <EmptyState title={empty} /> : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500 uppercase"><tr>
              <th className="text-left px-4 py-3 font-medium">Reference</th>
              <th className="text-left px-4 py-3 font-medium">Institute</th>
              {type === "po" && <th className="text-left px-4 py-3 font-medium">Vendor</th>}
              <th className="text-right px-4 py-3 font-medium">Amount</th>
              {type !== "po" && <th className="text-left px-4 py-3 font-medium">Category</th>}
              <th className="text-left px-4 py-3 font-medium">Status</th>
              <th className="text-left px-4 py-3 font-medium w-48">Comment</th>
              <th className="text-right px-4 py-3 font-medium">Action</th>
            </tr></thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((it) => (
                <tr key={it.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-800">{type === "po" ? it.po_number : it.request_number}</td>
                  <td className="px-4 py-3 text-slate-600">{it.institute_name}</td>
                  {type === "po" && <td className="px-4 py-3 text-slate-600">{it.vendor_name}</td>}
                  <td className="px-4 py-3 text-right font-medium">{formatINR(type === "po" ? it.grand_total : it.amount)}</td>
                  {type !== "po" && <td className="px-4 py-3 text-slate-600">{PR_EXPENSE_LABELS[it.expense_category] || "-"}</td>}
                  <td className="px-4 py-3">{type === "po" ? <StatusBadge status={it.status} /> : <PRBadge status={it.status} />}</td>
                  <td className="px-4 py-3"><Textarea value={comment[it.id] || ""} onChange={(e) => setComment({ ...comment, [it.id]: e.target.value })} rows={1} className="h-8 text-xs" placeholder="Comment..." /></td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-1">
                      <Button size="sm" className="h-7 bg-emerald-600" onClick={() => onApprove(it, comment[it.id] || "")}><CheckCircle className="w-3 h-3 mr-1" /> Approve</Button>
                      <Button size="sm" variant="outline" className="h-7 border-red-200 text-red-600" onClick={() => onReject(it, comment[it.id] || "")}><XCircle className="w-3 h-3 mr-1" /> Reject</Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}