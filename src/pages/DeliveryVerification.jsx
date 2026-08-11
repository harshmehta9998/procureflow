import React, { useEffect, useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useUserRole } from "@/lib/RoleContext";
import { StatCard, EmptyState } from "@/components/po/Shared";
import { formatINR, formatDate, todayISO, logAudit } from "@/lib/poUtils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PackageCheck, Plus, Upload, X, CheckCircle, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

export default function DeliveryVerification() {
  const { role, instituteId, instituteIds, userName, isInstituteAdmin, isSuperAdmin, isCentreHead } = useUserRole();
  const [verifications, setVerifications] = useState([]);
  const [pos, setPos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  const fetchData = async () => {
    try {
      const [list, allPos] = await Promise.all([
        base44.entities.DeliveryVerification.list("-created_date", 500),
        base44.entities.PurchaseOrder.list("-created_date", 500),
      ]);
      setVerifications(list.filter((v) => !v.deleted));
      setPos(allPos.filter((p) => !p.deleted && !p.cancelled));
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, []);

  const visible = useMemo(() => verifications.filter((v) => {
    if (isInstituteAdmin && instituteId && v.institute_id !== instituteId) return false;
    if (isCentreHead && instituteIds && instituteIds.length > 0 && !instituteIds.includes(v.institute_id)) return false;
    return true;
  }), [verifications, isInstituteAdmin, instituteId, isCentreHead, instituteIds]);

  // POs eligible for delivery verification (approved + has items, for this institute)
  const eligiblePos = useMemo(() => pos.filter((p) => {
    if (isInstituteAdmin && instituteId && p.institute_id !== instituteId) return false;
    if (isCentreHead && instituteIds && instituteIds.length > 0 && !instituteIds.includes(p.institute_id)) return false;
    return ["centre_head_approved", "approved", "payment_pending", "partially_paid"].includes(p.status);
  }), [pos, isInstituteAdmin, instituteId, isCentreHead, instituteIds]);

  if (loading) return <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Delivery & Quantity Verification</h1>
          <p className="text-sm text-slate-500 mt-0.5">{visible.length} verifications recorded</p>
        </div>
        {isInstituteAdmin && <Button size="sm" className="bg-slate-900" onClick={() => setShowCreate(true)}><Plus className="w-4 h-4 mr-1.5" /> Receive / Verify Delivery</Button>}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Verifications" value={visible.length} icon={PackageCheck} accent="slate" />
        <StatCard label="Balance Pending" value={visible.filter((v) => v.status === "balance_pending").length} icon={AlertTriangle} accent="amber" />
        <StatCard label="Amended" value={visible.filter((v) => v.status === "amended").length} icon={CheckCircle} accent="blue" />
        <StatCard label="Closed (Received)" value={visible.filter((v) => v.action_taken === "close_with_received").length} icon={CheckCircle} accent="emerald" />
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {visible.length === 0 ? <EmptyState icon={PackageCheck} title="No delivery verifications yet" sub="Receive a delivery against an approved PO." /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs text-slate-500 uppercase"><tr>
                <th className="text-left px-4 py-3 font-medium">PO Number</th>
                {(isSuperAdmin || isCentreHead) && <th className="text-left px-4 py-3 font-medium">Institute</th>}
                <th className="text-left px-4 py-3 font-medium">Vendor</th>
                <th className="text-left px-4 py-3 font-medium">Item</th>
                <th className="text-right px-4 py-3 font-medium">PO Qty</th>
                <th className="text-right px-4 py-3 font-medium">Received</th>
                <th className="text-right px-4 py-3 font-medium">Accepted</th>
                <th className="text-right px-4 py-3 font-medium">Payable</th>
                <th className="text-left px-4 py-3 font-medium">Action</th>
                <th className="text-left px-4 py-3 font-medium">Date</th>
              </tr></thead>
              <tbody className="divide-y divide-slate-100">
                {visible.map((v) => (
                  <tr key={v.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-800">{v.po_number}</td>
                    {(isSuperAdmin || isCentreHead) && <td className="px-4 py-3 text-slate-600">{v.institute_name}</td>}
                    <td className="px-4 py-3 text-slate-600">{v.vendor_name}</td>
                    <td className="px-4 py-3 text-slate-600">{v.item_name}</td>
                    <td className="px-4 py-3 text-right">{v.po_quantity}</td>
                    <td className="px-4 py-3 text-right">{v.received_quantity}</td>
                    <td className="px-4 py-3 text-right">{v.accepted_quantity}</td>
                    <td className="px-4 py-3 text-right font-medium">{formatINR(v.payable_amount)}</td>
                    <td className="px-4 py-3"><span className="text-xs text-slate-600">{ACTION_LABELS[v.action_taken]}</span></td>
                    <td className="px-4 py-3 text-slate-600">{formatDate(v.delivery_date)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showCreate && <CreateVerificationModal pos={eligiblePos} userName={userName} onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); fetchData(); }} />}
    </div>
  );
}

const ACTION_LABELS = {
  close_with_received: "Close with Received",
  receive_balance_later: "Receive Balance Later",
  return_excess: "Return Excess",
  create_amendment: "Create Amendment",
};

function CreateVerificationModal({ pos, userName, onClose, onCreated }) {
  const [poId, setPoId] = useState("");
  const [itemIdx, setItemIdx] = useState(0);
  const [form, setForm] = useState({ received_quantity: 0, accepted_quantity: 0, returned_quantity: 0, delivery_date: todayISO(), remarks: "", attachment_url: "", action_taken: "close_with_received" });
  const [saving, setSaving] = useState(false);

  const po = pos.find((p) => p.id === poId);
  const item = po?.items?.[itemIdx];
  const poQty = Number(item?.quantity || 0);
  const unitPrice = Number(item?.rate || 0);
  const received = Number(form.received_quantity || 0);
  const shortQty = received < poQty ? poQty - received : 0;
  const excessQty = received > poQty ? received - poQty : 0;
  const accepted = Number(form.accepted_quantity || received);
  const returned = Number(form.returned_quantity || (excessQty > 0 ? excessQty : 0));
  const payable = accepted * unitPrice;

  const upload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try { const { file_url } = await base44.integrations.Core.UploadFile({ file }); setForm({ ...form, attachment_url: file_url }); toast.success("Uploaded"); } catch { toast.error("Upload failed"); }
  };

  const save = async () => {
    if (!po) return toast.error("Select a PO");
    if (received <= 0) return toast.error("Enter received quantity");
    setSaving(true);
    try {
      const action = form.action_taken;
      const balancePending = action === "receive_balance_later" ? shortQty : 0;
      const status = action === "receive_balance_later" ? "balance_pending" : action === "create_amendment" ? "amended" : "verified";
      await base44.entities.DeliveryVerification.create({
        po_id: po.id, po_number: po.po_number, institute_id: po.institute_id, institute_name: po.institute_name,
        vendor_id: po.vendor_id, vendor_name: po.vendor_name, item_name: item?.item_name || "",
        po_quantity: poQty, received_quantity: received, short_quantity: shortQty, excess_quantity: excessQty,
        accepted_quantity: accepted, returned_quantity: returned, unit_price: unitPrice, payable_amount: payable,
        delivery_date: form.delivery_date, remarks: form.remarks, attachment_url: form.attachment_url,
        action_taken: action, balance_pending: balancePending, verified_by_name: userName, status,
      });
      await logAudit("DeliveryVerification", po.id, po.po_number, userName, "Delivery Verified", String(poQty), String(received), action);
      toast.success("Delivery recorded");
      onCreated();
    } catch (err) { toast.error(err.message || "Failed"); } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-slate-800">Receive / Verify Delivery</h3>
          <Button variant="ghost" size="sm" onClick={onClose}><X className="w-4 h-4" /></Button>
        </div>
        <div className="space-y-3">
          <div><Label className="text-xs">Purchase Order *</Label>
            <Select value={poId} onValueChange={(v) => { setPoId(v); setItemIdx(0); }}><SelectTrigger className="h-9 mt-1"><SelectValue placeholder="Select PO" /></SelectTrigger><SelectContent>{pos.map((p) => <SelectItem key={p.id} value={p.id}>{p.po_number} · {p.vendor_name}</SelectItem>)}</SelectContent></Select>
          </div>
          {po && po.items && po.items.length > 0 && (
            <div><Label className="text-xs">Item</Label>
              <Select value={String(itemIdx)} onValueChange={(v) => setItemIdx(Number(v))}><SelectTrigger className="h-9 mt-1"><SelectValue /></SelectTrigger><SelectContent>{po.items.map((it, i) => <SelectItem key={i} value={String(i)}>{it.item_name} ({it.quantity} {it.unit})</SelectItem>)}</SelectContent></Select>
            </div>
          )}
          {item && (
            <div className="bg-slate-50 rounded-lg p-3 text-xs text-slate-600 grid grid-cols-2 gap-1">
              <div>PO Qty: <b>{poQty}</b></div><div>Unit Price: <b>{formatINR(unitPrice)}</b></div>
              <div className={shortQty > 0 ? "text-red-600" : ""}>Short: <b>{shortQty}</b></div>
              <div className={excessQty > 0 ? "text-amber-600" : ""}>Excess: <b>{excessQty}</b></div>
              <div>Accepted: <b>{accepted}</b></div><div>Returned: <b>{returned}</b></div>
              <div className="col-span-2">Payable: <b>{formatINR(payable)}</b></div>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div><Label className="text-xs">Received Qty *</Label><Input type="number" value={form.received_quantity} onChange={(e) => setForm({ ...form, received_quantity: Number(e.target.value) })} className="h-9 mt-1" /></div>
            <div><Label className="text-xs">Accepted Qty</Label><Input type="number" value={form.accepted_quantity} onChange={(e) => setForm({ ...form, accepted_quantity: Number(e.target.value) })} className="h-9 mt-1" /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label className="text-xs">Returned Qty</Label><Input type="number" value={form.returned_quantity} onChange={(e) => setForm({ ...form, returned_quantity: Number(e.target.value) })} className="h-9 mt-1" /></div>
            <div><Label className="text-xs">Delivery Date</Label><Input type="date" value={form.delivery_date} onChange={(e) => setForm({ ...form, delivery_date: e.target.value })} className="h-9 mt-1" /></div>
          </div>
          <div><Label className="text-xs">Action *</Label>
            <Select value={form.action_taken} onValueChange={(v) => setForm({ ...form, action_taken: v })}><SelectTrigger className="h-9 mt-1"><SelectValue /></SelectTrigger><SelectContent>
              {shortQty > 0 && <><SelectItem value="close_with_received">Close PO with Received Qty</SelectItem><SelectItem value="receive_balance_later">Receive Balance Later</SelectItem></>}
              {excessQty > 0 && <><SelectItem value="return_excess">Return Excess Quantity</SelectItem><SelectItem value="create_amendment">Create Amendment for Excess</SelectItem></>}
              {shortQty === 0 && excessQty === 0 && <SelectItem value="close_with_received">Close PO (Matched)</SelectItem>}
            </SelectContent></Select>
          </div>
          <div><Label className="text-xs">Remarks</Label><Textarea value={form.remarks} onChange={(e) => setForm({ ...form, remarks: e.target.value })} rows={2} className="mt-1" /></div>
          <div><Label className="text-xs">Delivery Proof</Label>
            <label className="flex items-center gap-2 mt-1 px-3 py-2 border border-dashed border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50 text-sm text-slate-500"><Upload className="w-4 h-4" /> {form.attachment_url ? "Uploaded ✓" : "Upload"}<input type="file" className="hidden" onChange={upload} /></label>
          </div>
        </div>
        <Button className="w-full bg-slate-900 mt-4" onClick={save} disabled={saving}>Save Verification</Button>
      </div>
    </div>
  );
}