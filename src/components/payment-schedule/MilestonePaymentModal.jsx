import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, Wallet } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { formatINR, todayISO } from "@/lib/poUtils";
import { toast } from "sonner";

export default function MilestonePaymentModal({ milestone, po, userName, onClose, onPaid }) {
  const [payment, setPayment] = useState({
    payment_date: todayISO(),
    amount_paid: milestone.outstanding_amount || milestone.calculated_amount || 0,
    payment_mode: "NEFT",
    reference_number: "",
    remarks: "",
    attachment_url: "",
  });
  const [saving, setSaving] = useState(false);

  const outstanding = Number(milestone.outstanding_amount ?? milestone.calculated_amount ?? 0);

  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setPayment({ ...payment, attachment_url: file_url });
      toast.success("Proof uploaded");
    } catch { toast.error("Upload failed"); }
  };

  const save = async () => {
    const amt = Number(payment.amount_paid);
    if (!amt || amt <= 0) return toast.error("Enter valid amount");
    if (amt > outstanding) return toast.error("Amount exceeds milestone outstanding");

    setSaving(true);
    try {
      // Create payment record linked to milestone
      await base44.entities.Payment.create({
        po_id: po.id,
        po_number: po.po_number,
        milestone_id: milestone.id,
        milestone_name: milestone.milestone_name,
        institute_id: po.institute_id,
        institute_name: po.institute_name,
        vendor_name: po.vendor_name,
        payment_date: payment.payment_date,
        amount_paid: amt,
        payment_mode: payment.payment_mode,
        reference_number: payment.reference_number,
        remarks: payment.remarks,
        attachment_url: payment.attachment_url,
        recorded_by_name: userName,
      });

      // Update milestone
      const newPaid = (milestone.amount_paid || 0) + amt;
      const newOutstanding = Math.max(0, (milestone.calculated_amount || 0) - newPaid);
      const newStatus = newOutstanding <= 0 ? "paid" : "partially_paid";
      await base44.entities.PaymentMilestone.update(milestone.id, {
        amount_paid: newPaid,
        outstanding_amount: newOutstanding,
        status: newStatus,
      });

      // Sync PO-level totals from all milestones
      const allMs = await base44.entities.PaymentMilestone.filter({ po_id: po.id });
      const active = allMs.filter((m) => !m.deleted && m.status !== "cancelled");
      const totalPaid = active.reduce((s, m) => s + Number(m.amount_paid || 0), 0);
      const totalAmount = active.reduce((s, m) => s + Number(m.calculated_amount || 0), 0);
      const totalOutstanding = Math.max(0, totalAmount - totalPaid);
      const allPaid = active.length > 0 && active.every((m) => Number(m.outstanding_amount || 0) <= 0 && Number(m.calculated_amount || 0) > 0);
      const anyPaid = active.some((m) => Number(m.amount_paid || 0) > 0);
      const newPOStatus = allPaid ? "fully_paid" : anyPaid ? "partially_paid" : po.status;
      const newPayStatus = allPaid ? "paid" : anyPaid ? "partial" : "pending";
      await base44.entities.PurchaseOrder.update(po.id, {
        amount_paid: totalPaid,
        outstanding_amount: totalOutstanding,
        payment_status: newPayStatus,
        status: newPOStatus,
      });

      await onPaid(amt);
      toast.success("Payment recorded");
      onClose();
    } catch (err) {
      toast.error(err.message || "Failed to record payment");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full space-y-4 p-5" onClick={(e) => e.stopPropagation()}>
        <div>
          <h3 className="font-semibold text-slate-800 text-sm flex items-center gap-2"><Wallet className="w-4 h-4" /> Record Payment</h3>
          <p className="text-xs text-slate-500 mt-0.5">{milestone.milestone_name}</p>
        </div>

        <div className="bg-slate-50 rounded-lg p-3 text-sm space-y-1">
          <div className="flex justify-between"><span className="text-slate-500">Milestone Amount</span><span className="font-medium">{formatINR(milestone.calculated_amount || 0)}</span></div>
          <div className="flex justify-between"><span className="text-slate-500">Already Paid</span><span className="font-medium text-emerald-600">{formatINR(milestone.amount_paid || 0)}</span></div>
          <div className="flex justify-between"><span className="text-slate-500">Outstanding</span><span className="font-medium text-amber-600">{formatINR(outstanding)}</span></div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div><Label className="text-xs">Payment Date *</Label><Input type="date" value={payment.payment_date} onChange={(e) => setPayment({ ...payment, payment_date: e.target.value })} className="h-9 mt-1" /></div>
          <div><Label className="text-xs">Amount *</Label><Input type="number" value={payment.amount_paid} onChange={(e) => setPayment({ ...payment, amount_paid: e.target.value })} className="h-9 mt-1" placeholder={outstanding} /></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">Payment Mode</Label>
            <Select value={payment.payment_mode} onValueChange={(v) => setPayment({ ...payment, payment_mode: v })}>
              <SelectTrigger className="h-9 mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>{["NEFT", "RTGS", "IMPS", "Cheque", "Cash"].map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label className="text-xs">Reference No.</Label><Input value={payment.reference_number} onChange={(e) => setPayment({ ...payment, reference_number: e.target.value })} className="h-9 mt-1" /></div>
        </div>
        <div><Label className="text-xs">Remarks</Label><Textarea value={payment.remarks} onChange={(e) => setPayment({ ...payment, remarks: e.target.value })} rows={2} className="mt-1" /></div>
        <div>
          <Label className="text-xs">Payment Proof</Label>
          <label className="flex items-center gap-2 mt-1 px-3 py-2 border border-dashed border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50 text-sm text-slate-500">
            <Upload className="w-4 h-4" /> {payment.attachment_url ? "Uploaded ✓" : "Upload proof"}
            <input type="file" className="hidden" onChange={handleUpload} accept=".pdf,.jpg,.png" />
          </label>
        </div>

        <div className="flex gap-2 pt-1">
          <Button className="flex-1 bg-slate-900" onClick={save} disabled={saving}>{saving ? "Saving..." : "Save Payment"}</Button>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
        </div>
      </div>
    </div>
  );
}