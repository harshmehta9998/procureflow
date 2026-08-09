import React, { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useUserRole } from "@/lib/RoleContext";
import { StatusBadge, PaymentBadge } from "@/components/po/Shared";
import { formatINR, formatDate, daysOverdue, PO_CATEGORY_LABELS, PO_TYPE_LABELS, logAudit, todayISO } from "@/lib/poUtils";
import { calculateDueDate, computePOPaymentStatus, computePOTotals } from "@/lib/paymentScheduleUtils";
import ScheduleView from "@/components/payment-schedule/ScheduleView";
import TriggerEventsPanel from "@/components/payment-schedule/TriggerEventsPanel";
import PaymentTimeline from "@/components/payment-schedule/PaymentTimeline";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ArrowLeft, CheckCircle, XCircle, RotateCcw, Wallet, FileDown, Upload,
  History, Paperclip, Building2, User, IndianRupee, FileText, Clock, Calendar, Zap
} from "lucide-react";
import { toast } from "sonner";
import jsPDF from "jspdf";

export default function PODetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { role, userName, isSuperAdmin, isFinance, isInstituteAdmin } = useUserRole();
  const [po, setPo] = useState(null);
  const [payments, setPayments] = useState([]);
  const [logs, setLogs] = useState([]);
  const [milestones, setMilestones] = useState([]);
  const [vendor, setVendor] = useState(null);
  const [institute, setInstitute] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showPayment, setShowPayment] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [showReject, setShowReject] = useState(false);

  const [payment, setPayment] = useState({
    payment_date: todayISO(),
    amount_paid: 0,
    payment_mode: "NEFT",
    reference_number: "",
    remarks: "",
    attachment_url: "",
  });

  useEffect(() => {
    (async () => {
      try {
        const p = await base44.entities.PurchaseOrder.get(id);
        if (p.deleted) { navigate("/purchase-orders"); return; }
        setPo(p);
        const [pays, allLogs, ms] = await Promise.all([
          base44.entities.Payment.filter({ po_id: id }, "-payment_date"),
          base44.entities.AuditLog.filter({ entity_id: id }, "-created_date"),
          base44.entities.PaymentMilestone.filter({ po_id: id }, "order_index"),
        ]);
        setPayments(pays);
        setLogs(allLogs);
        setMilestones(ms.filter((m) => !m.deleted));
        if (p.vendor_id) { try { setVendor(await base44.entities.Vendor.get(p.vendor_id)); } catch {} }
        if (p.institute_id) { try { setInstitute(await base44.entities.Institute.get(p.institute_id)); } catch {} }
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const refreshPO = async () => {
    const p = await base44.entities.PurchaseOrder.get(id);
    setPo(p);
    const [pays, allLogs, ms] = await Promise.all([
      base44.entities.Payment.filter({ po_id: id }, "-payment_date"),
      base44.entities.AuditLog.filter({ entity_id: id }, "-created_date"),
      base44.entities.PaymentMilestone.filter({ po_id: id }, "order_index"),
    ]);
    setPayments(pays);
    setLogs(allLogs);
    setMilestones(ms.filter((m) => !m.deleted));
  };

  const updateStatus = async (newStatus, action, remarks = "") => {
    const oldStatus = po.status;
    await base44.entities.PurchaseOrder.update(id, { status: newStatus, rejection_reason: remarks });
    await logAudit("PurchaseOrder", id, po.po_number, userName, action, oldStatus, newStatus, remarks);
    toast.success(action);
    refreshPO();
  };

  const approvePO = async () => {
    const newStatus = po.grand_total > 0 ? "payment_pending" : "approved";
    try {
      const approvedDate = todayISO();
      const updateData = { status: newStatus, rejection_reason: "", approved_date: approvedDate };
      await base44.entities.PurchaseOrder.update(id, updateData);

      // Recalculate milestone due dates with the approved_date set
      const activeMs = milestones.filter((m) => m.status !== "cancelled" && m.status !== "paid");
      const updatedPo = { ...po, approved_date: approvedDate };
      for (const m of activeMs) {
        const newDue = calculateDueDate({ ...m }, updatedPo);
        if (newDue) {
          await base44.entities.PaymentMilestone.update(m.id, {
            due_date: newDue,
            original_due_date: m.original_due_date || newDue,
          });
        }
      }
      await logAudit("PurchaseOrder", id, po.po_number, userName, "PO Approved", po.status, newStatus, "Approved by Super Admin");
      toast.success("PO Approved");
      refreshPO();
    } catch (err) {
      toast.error("Approval failed");
    }
  };
  const rejectPO = () => { if (!rejectionReason) return toast.error("Please provide rejection reason"); updateStatus("rejected", "PO Rejected", rejectionReason); setShowReject(false); };
  const sendBack = () => updateStatus("sent_back", "Sent Back for Revision", "Requires modification");
  const closePO = () => updateStatus("closed", "PO Closed", "Closed by Finance");

  const handlePaymentUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setPayment({ ...payment, attachment_url: file_url });
      toast.success("Proof uploaded");
    } catch { toast.error("Upload failed"); }
  };

  const recordPayment = async () => {
    if (!payment.amount_paid || payment.amount_paid <= 0) return toast.error("Enter valid amount");
    const newPaid = (po.amount_paid || 0) + Number(payment.amount_paid);
    if (newPaid > po.grand_total) return toast.error("Payment exceeds PO value");
    const isFull = newPaid >= po.grand_total;
    const newOutstanding = po.grand_total - newPaid;

    try {
      await base44.entities.Payment.create({
        po_id: id,
        po_number: po.po_number,
        institute_id: po.institute_id,
        institute_name: po.institute_name,
        vendor_name: po.vendor_name,
        ...payment,
        amount_paid: Number(payment.amount_paid),
        recorded_by_name: userName,
      });
      await base44.entities.PurchaseOrder.update(id, {
        amount_paid: newPaid,
        outstanding_amount: newOutstanding,
        payment_status: isFull ? "paid" : "partial",
        status: isFull ? "fully_paid" : "partially_paid",
      });
      await logAudit("PurchaseOrder", id, po.po_number, userName, "Payment Recorded", String(po.amount_paid || 0), String(newPaid), `${formatINR(payment.amount_paid)} via ${payment.payment_mode}`);
      toast.success("Payment recorded");
      setShowPayment(false);
      setPayment({ payment_date: todayISO(), amount_paid: 0, payment_mode: "NEFT", reference_number: "", remarks: "", attachment_url: "" });
      refreshPO();
    } catch (err) {
      toast.error(err.message || "Failed to record payment");
    }
  };

  const generatePDF = () => {
    const doc = new jsPDF();
    const w = doc.internal.pageSize.getWidth();
    let y = 20;

    // Header
    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, w, 30, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16); doc.setFont("helvetica", "bold");
    doc.text("PURCHASE ORDER", 14, 14);
    doc.setFontSize(9); doc.setFont("helvetica", "normal");
    doc.text(po.institute_name || "", 14, 22);
    doc.text(`PO Number: ${po.po_number}`, w - 14, 14, { align: "right" });
    doc.text(`Date: ${formatDate(po.created_date)}`, w - 14, 22, { align: "right" });

    y = 40;
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(10); doc.setFont("helvetica", "bold");
    doc.text("PO Details", 14, y); y += 6;
    doc.setFont("helvetica", "normal"); doc.setFontSize(9);
    doc.text(`Title: ${po.po_title}`, 14, y); y += 5;
    doc.text(`Category: ${PO_CATEGORY_LABELS[po.po_category]} | Type: ${PO_TYPE_LABELS[po.po_type]}`, 14, y); y += 5;
    doc.text(`Department: ${po.department || "-"}`, 14, y); y += 5;
    doc.text(`Status: ${po.status}`, 14, y); y += 5;
    if (po.description) { doc.text(`Description: ${po.description}`, 14, y); y += 5; }

    y += 4;
    doc.setFont("helvetica", "bold"); doc.setFontSize(10);
    doc.text("Vendor Details", 14, y); y += 6;
    doc.setFont("helvetica", "normal"); doc.setFontSize(9);
    if (vendor) {
      doc.text(`Name: ${vendor.vendor_name}`, 14, y); y += 5;
      doc.text(`Contact: ${vendor.contact_person || "-"} | Mobile: ${vendor.mobile_number || "-"}`, 14, y); y += 5;
      doc.text(`GST: ${vendor.gst_number || "-"} | PAN: ${vendor.pan_number || "-"}`, 14, y); y += 5;
      if (vendor.address) { doc.text(`Address: ${vendor.address}`, 14, y); y += 5; }
    }

    y += 4;
    doc.setFont("helvetica", "bold"); doc.setFontSize(10);
    doc.text("Items", 14, y); y += 6;
    doc.setFillColor(241, 245, 249);
    doc.rect(14, y - 4, w - 28, 7, "F");
    doc.setFontSize(8); doc.setFont("helvetica", "bold");
    doc.text("Item", 16, y); doc.text("Qty", 100, y); doc.text("Rate", 115, y); doc.text("GST%", 135, y); doc.text("Amount", w - 16, y, { align: "right" });
    y += 8;
    doc.setFont("helvetica", "normal");
    (po.items || []).forEach((item) => {
      doc.text(`${item.item_name}`, 16, y);
      doc.text(`${item.quantity} ${item.unit}`, 100, y);
      doc.text(formatINR(item.rate), 115, y);
      doc.text(`${item.gst_percent}%`, 135, y);
      doc.text(formatINR(item.amount), w - 16, y, { align: "right" });
      y += 6;
    });

    y += 4;
    doc.setFont("helvetica", "bold"); doc.setFontSize(10);
    doc.text(`Subtotal: ${formatINR(po.subtotal)}`, w - 16, y, { align: "right" }); y += 6;
    doc.text(`GST Total: ${formatINR(po.gst_total)}`, w - 16, y, { align: "right" }); y += 6;
    doc.setFontSize(12);
    doc.text(`Grand Total: ${formatINR(po.grand_total)}`, w - 16, y, { align: "right" }); y += 8;

    doc.setFontSize(9); doc.setFont("helvetica", "normal");
    if (po.payment_terms) { doc.text(`Payment Terms: ${po.payment_terms}`, 14, y); y += 5; }
    if (po.due_date) { doc.text(`Due Date: ${formatDate(po.due_date)}`, 14, y); y += 5; }
    if (po.delivery_terms) { doc.text(`Delivery Terms: ${po.delivery_terms}`, 14, y); y += 5; }
    if (po.special_conditions) { doc.text(`Special Conditions: ${po.special_conditions}`, 14, y); y += 5; }

    y += 10;
    doc.setFontSize(9); doc.setTextColor(100);
    doc.text("Authorized by:", 14, y); y += 15;
    doc.setDrawColor(200); doc.line(14, y, 80, y);
    doc.text("Signature & Stamp", 14, y + 5);

    doc.save(`${po.po_number}.pdf`);
  };

  if (loading) return <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" /></div>;
  if (!po) return <div className="text-center py-20 text-slate-500">PO not found</div>;

  const od = daysOverdue(po.due_date, po.outstanding_amount);
  const canApprove = isSuperAdmin && po.status === "pending_approval";
  const hasSchedule = milestones.length > 0;
  const canPay = isFinance && !hasSchedule && ["payment_pending", "partially_paid"].includes(po.status);
  const canEdit = false;

  return (
    <div className="space-y-5 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate("/purchase-orders")}><ArrowLeft className="w-4 h-4" /></Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-slate-800">{po.po_number}</h1>
              <StatusBadge status={po.status} />
              <PaymentBadge status={po.payment_status} />
            </div>
            <p className="text-sm text-slate-500 mt-0.5">{po.po_title}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={generatePDF}><FileDown className="w-4 h-4 mr-1.5" /> Download PDF</Button>
        </div>
      </div>

      {hasSchedule ? (
        milestones.filter((m) => {
          if (m.status === "cancelled" || m.status === "paid") return false;
          const odm = daysOverdue(m.due_date, m.outstanding_amount);
          return odm > 0;
        }).length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-2 text-sm text-red-700">
            <Clock className="w-4 h-4" /> {milestones.filter((m) => m.status !== "cancelled" && m.status !== "paid" && daysOverdue(m.due_date, m.outstanding_amount) > 0).length} milestone(s) are overdue.
          </div>
        )
      ) : (
        od > 0 && po.outstanding_amount > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-2 text-sm text-red-700">
            <Clock className="w-4 h-4" /> This PO is <strong>{od} days overdue</strong>. Outstanding: {formatINR(po.outstanding_amount)}
          </div>
        )
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left: PO Info + Items + Vendor */}
        <div className="lg:col-span-2 space-y-4">
          {/* PO Info */}
          <Card className="p-5">
            <h3 className="font-semibold text-slate-800 text-sm mb-3 flex items-center gap-2"><FileText className="w-4 h-4" /> PO Information</h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <Info label="PO Number" value={po.po_number} />
              <Info label="Category" value={PO_CATEGORY_LABELS[po.po_category]} />
              <Info label="PO Type" value={PO_TYPE_LABELS[po.po_type]} />
              <Info label="Department" value={po.department || "-"} />
              <Info label="Created By" value={po.created_by_name || "-"} />
              <Info label="Created On" value={formatDate(po.created_date)} />
              <Info label="Approved On" value={formatDate(po.approved_date)} />
              <Info label="Payment Schedule" value={milestones.length > 0 ? `${milestones.length} milestones` : "Not defined"} />
            </div>
            {po.description && <div className="mt-3 text-sm"><span className="text-slate-400">Description: </span><span className="text-slate-600">{po.description}</span></div>}
            {po.purpose && <div className="mt-1 text-sm"><span className="text-slate-400">Purpose: </span><span className="text-slate-600">{po.purpose}</span></div>}
            {po.special_conditions && <div className="mt-1 text-sm"><span className="text-slate-400">Special Conditions: </span><span className="text-slate-600">{po.special_conditions}</span></div>}
          </Card>

          {/* Items */}
          <Card className="p-5">
            <h3 className="font-semibold text-slate-800 text-sm mb-3">Items</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs text-slate-500 border-b border-slate-200">
                  <tr>
                    <th className="text-left py-2 font-medium">Item</th>
                    <th className="text-left py-2 font-medium">Description</th>
                    <th className="text-right py-2 font-medium">Qty</th>
                    <th className="text-right py-2 font-medium">Rate</th>
                    <th className="text-right py-2 font-medium">GST%</th>
                    <th className="text-right py-2 font-medium">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(po.items || []).map((item, i) => (
                    <tr key={i}>
                      <td className="py-2 font-medium text-slate-700">{item.item_name}</td>
                      <td className="py-2 text-slate-500">{item.description || "-"}</td>
                      <td className="py-2 text-right">{item.quantity} {item.unit}</td>
                      <td className="py-2 text-right">{formatINR(item.rate)}</td>
                      <td className="py-2 text-right">{item.gst_percent}%</td>
                      <td className="py-2 text-right font-medium">{formatINR(item.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex justify-end mt-3">
              <div className="w-56 space-y-1 text-sm">
                <Row label="Subtotal" value={formatINR(po.subtotal)} />
                <Row label="GST Total" value={formatINR(po.gst_total)} />
                <div className="flex justify-between font-bold text-slate-800 border-t border-slate-200 pt-1.5"><span>Grand Total</span><span>{formatINR(po.grand_total)}</span></div>
                <div className="flex justify-between text-emerald-600"><span>Paid</span><span>{formatINR(po.amount_paid)}</span></div>
                <div className="flex justify-between text-amber-600 font-medium"><span>Outstanding</span><span>{formatINR(po.outstanding_amount)}</span></div>
              </div>
            </div>
          </Card>

          {/* Payment Schedule */}
          {milestones.length > 0 && (
            <Card className="p-5">
              <div className="flex items-center gap-2 mb-4">
                <Calendar className="w-4 h-4 text-indigo-500" />
                <h3 className="font-semibold text-slate-800 text-sm">Payment Schedule</h3>
                <span className="text-xs text-slate-400">{milestones.length} milestone(s)</span>
              </div>
              <ScheduleView po={po} milestones={milestones} payments={payments} userName={userName} isFinance={isFinance} isInstituteAdmin={isInstituteAdmin} onRefresh={refreshPO} />
            </Card>
          )}

          {/* Trigger Events */}
          {milestones.length > 0 && po.status !== "draft" && po.status !== "pending_approval" && (
            <Card className="p-5">
              <TriggerEventsPanel po={po} milestones={milestones} onEventUpdate={refreshPO} canEdit={isFinance || isInstituteAdmin} userName={userName} />
            </Card>
          )}

          {/* Payment Timeline */}
          {milestones.length > 0 && (
            <Card className="p-5">
              <div className="flex items-center gap-2 mb-4">
                <Clock className="w-4 h-4 text-slate-500" />
                <h3 className="font-semibold text-slate-800 text-sm">Payment Timeline</h3>
              </div>
              <PaymentTimeline po={po} milestones={milestones} payments={payments} />
            </Card>
          )}

          {/* Vendor */}
          {vendor && (
            <Card className="p-5">
              <h3 className="font-semibold text-slate-800 text-sm mb-3 flex items-center gap-2"><Building2 className="w-4 h-4" /> Vendor Information</h3>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <Info label="Vendor Name" value={vendor.vendor_name} />
                <Info label="Vendor Type" value={vendor.vendor_type} />
                <Info label="Contact Person" value={vendor.contact_person || "-"} />
                <Info label="Mobile" value={vendor.mobile_number || "-"} />
                <Info label="Email" value={vendor.email || "-"} />
                <Info label="GST Number" value={vendor.gst_number || "-"} />
                <Info label="PAN Number" value={vendor.pan_number || "-"} />
                <Info label="Status" value={vendor.status} />
              </div>
              {vendor.address && <div className="mt-2 text-sm"><span className="text-slate-400">Address: </span><span className="text-slate-600">{vendor.address}</span></div>}
              {vendor.bank_details && <div className="mt-1 text-sm"><span className="text-slate-400">Bank: </span><span className="text-slate-600">{vendor.bank_details}</span></div>}
            </Card>
          )}

          {/* Documents */}
          <Card className="p-5">
            <h3 className="font-semibold text-slate-800 text-sm mb-3 flex items-center gap-2"><Paperclip className="w-4 h-4" /> Documents</h3>
            <div className="space-y-2">
              <DocItem label="Approved Quotation" url={po.quotation_url} />
              {payments.map((p) => <DocItem key={p.id} label={`Payment Proof - ${formatINR(p.amount_paid)} (${p.payment_mode})`} url={p.attachment_url} />)}
              {!po.quotation_url && payments.length === 0 && <div className="text-sm text-slate-400">No documents attached</div>}
            </div>
          </Card>
        </div>

        {/* Right: Actions + Payments + Audit */}
        <div className="space-y-4">
          {/* Actions */}
          <Card className="p-5">
            <h3 className="font-semibold text-slate-800 text-sm mb-3">Actions</h3>
            {canApprove && (
              <div className="space-y-2">
                <Button className="w-full bg-emerald-600 hover:bg-emerald-700" onClick={approvePO}><CheckCircle className="w-4 h-4 mr-1.5" /> Approve PO</Button>
                <Button variant="outline" className="w-full border-amber-200 text-amber-700" onClick={sendBack}><RotateCcw className="w-4 h-4 mr-1.5" /> Send Back for Revision</Button>
                {!showReject ? (
                  <Button variant="outline" className="w-full border-red-200 text-red-600" onClick={() => setShowReject(true)}><XCircle className="w-4 h-4 mr-1.5" /> Reject PO</Button>
                ) : (
                  <div className="space-y-2 p-2 border border-red-200 rounded-lg bg-red-50">
                    <Textarea placeholder="Rejection reason..." value={rejectionReason} onChange={(e) => setRejectionReason(e.target.value)} rows={2} />
                    <div className="flex gap-2">
                      <Button size="sm" className="bg-red-600 flex-1" onClick={rejectPO}>Confirm Reject</Button>
                      <Button size="sm" variant="ghost" onClick={() => setShowReject(false)}>Cancel</Button>
                    </div>
                  </div>
                )}
              </div>
            )}
            {canPay && (
              <Button className="w-full bg-slate-900" onClick={() => setShowPayment(!showPayment)}><Wallet className="w-4 h-4 mr-1.5" /> Record Payment</Button>
            )}
            {isFinance && po.status === "fully_paid" && (
              <Button className="w-full bg-slate-700" onClick={closePO}><CheckCircle className="w-4 h-4 mr-1.5" /> Close PO</Button>
            )}
            {!canApprove && !canPay && po.status !== "fully_paid" && (
              <div className="text-sm text-slate-400 text-center py-2">No actions available for your role</div>
            )}
            {po.status === "closed" && <div className="text-sm text-slate-400 text-center py-2">PO is closed</div>}
          </Card>

          {/* Payment form */}
          {showPayment && (
            <Card className="p-5 space-y-3">
              <h3 className="font-semibold text-slate-800 text-sm">Record Payment</h3>
              <div className="bg-slate-50 rounded-lg p-3 text-sm space-y-1">
                <Row label="PO Value" value={formatINR(po.grand_total)} />
                <Row label="Already Paid" value={formatINR(po.amount_paid)} />
                <Row label="Outstanding" value={formatINR(po.outstanding_amount)} />
              </div>
              <div><Label className="text-xs">Payment Date *</Label><Input type="date" value={payment.payment_date} onChange={(e) => setPayment({ ...payment, payment_date: e.target.value })} className="h-9 mt-1" /></div>
              <div><Label className="text-xs">Amount *</Label><Input type="number" value={payment.amount_paid} onChange={(e) => setPayment({ ...payment, amount_paid: e.target.value })} className="h-9 mt-1" placeholder={po.outstanding_amount} /></div>
              <div><Label className="text-xs">Payment Mode</Label>
                <Select value={payment.payment_mode} onValueChange={(v) => setPayment({ ...payment, payment_mode: v })}>
                  <SelectTrigger className="h-9 mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>{["NEFT", "RTGS", "IMPS", "Cheque", "Cash"].map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label className="text-xs">Reference Number</Label><Input value={payment.reference_number} onChange={(e) => setPayment({ ...payment, reference_number: e.target.value })} className="h-9 mt-1" /></div>
              <div><Label className="text-xs">Remarks</Label><Textarea value={payment.remarks} onChange={(e) => setPayment({ ...payment, remarks: e.target.value })} rows={2} className="mt-1" /></div>
              <div>
                <Label className="text-xs">Payment Proof</Label>
                <label className="flex items-center gap-2 mt-1 px-3 py-2 border border-dashed border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50 text-sm text-slate-500">
                  <Upload className="w-4 h-4" /> {payment.attachment_url ? "Uploaded ✓" : "Upload proof"}
                  <input type="file" className="hidden" onChange={handlePaymentUpload} accept=".pdf,.jpg,.png" />
                </label>
              </div>
              <Button className="w-full bg-slate-900" onClick={recordPayment}><Wallet className="w-4 h-4 mr-1.5" /> Save Payment</Button>
            </Card>
          )}

          {/* Payment History */}
          <Card className="p-5">
            <h3 className="font-semibold text-slate-800 text-sm mb-3 flex items-center gap-2"><IndianRupee className="w-4 h-4" /> Payment History</h3>
            {payments.length === 0 ? <div className="text-sm text-slate-400">No payments recorded</div> : (
              <div className="space-y-3">
                {payments.map((p) => (
                  <div key={p.id} className="border border-slate-100 rounded-lg p-3 text-sm">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-medium text-slate-800">{formatINR(p.amount_paid)}</div>
                        <div className="text-xs text-slate-400">{formatDate(p.payment_date)} · {p.payment_mode}</div>
                      </div>
                      {p.attachment_url && <a href={p.attachment_url} target="_blank" rel="noreferrer" className="text-blue-500 text-xs">View proof</a>}
                    </div>
                    {p.reference_number && <div className="text-xs text-slate-500 mt-1">Ref: {p.reference_number}</div>}
                    {p.remarks && <div className="text-xs text-slate-400 mt-0.5">{p.remarks}</div>}
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Audit Trail */}
          <Card className="p-5">
            <h3 className="font-semibold text-slate-800 text-sm mb-3 flex items-center gap-2"><History className="w-4 h-4" /> Audit Trail</h3>
            <div className="space-y-3">
              {logs.length === 0 ? <div className="text-sm text-slate-400">No activity</div> : logs.map((log) => (
                <div key={log.id} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className="w-2 h-2 rounded-full bg-slate-400 mt-1.5" />
                    <div className="w-px flex-1 bg-slate-200" />
                  </div>
                  <div className="flex-1 pb-2">
                    <div className="text-sm font-medium text-slate-700">{log.action}</div>
                    <div className="text-xs text-slate-400">{log.user_name} · {formatDate(log.created_date)}</div>
                    {log.remarks && <div className="text-xs text-slate-500 mt-0.5">{log.remarks}</div>}
                    {log.old_value && log.new_value && <div className="text-xs text-slate-400 mt-0.5">{log.old_value} → {log.new_value}</div>}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

const Info = ({ label, value }) => (
  <div><div className="text-xs text-slate-400">{label}</div><div className="text-sm text-slate-700 font-medium">{value || "-"}</div></div>
);

const Row = ({ label, value }) => (
  <div className="flex justify-between text-slate-600"><span>{label}</span><span className="font-medium text-slate-700">{value}</span></div>
);

const DocItem = ({ label, url }) => (
  url ? (
    <div className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2 text-sm">
      <span className="text-slate-600"><Paperclip className="w-3.5 h-3.5 inline mr-1.5 text-slate-400" />{label}</span>
      <a href={url} target="_blank" rel="noreferrer" className="text-blue-600 text-xs font-medium">View / Download</a>
    </div>
  ) : <div className="text-sm text-slate-400 px-3 py-2">{label}: Not attached</div>
);