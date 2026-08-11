import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X } from "lucide-react";
import { formatINR, todayISO, logAudit } from "@/lib/poUtils";
import { toast } from "sonner";

export default function DeliveryModal({ po, userName, onClose, onCreated }) {
  const [itemName, setItemName] = useState("");
  const [poQuantity, setPoQuantity] = useState(po.items?.[0]?.quantity || 1);
  const [receivedQuantity, setReceivedQuantity] = useState(0);
  const [acceptedQuantity, setAcceptedQuantity] = useState(0);
  const [returnedQuantity, setReturnedQuantity] = useState(0);
  const [unitPrice, setUnitPrice] = useState(po.items?.[0]?.rate || 0);
  const [deliveryDate, setDeliveryDate] = useState(todayISO());
  const [remarks, setRemarks] = useState("");
  const [attachmentUrl, setAttachmentUrl] = useState("");
  const [actionTaken, setActionTaken] = useState("close_with_received");
  const [saving, setSaving] = useState(false);

  const shortQty = Math.max(0, (Number(poQuantity) || 0) - (Number(receivedQuantity) || 0));
  const excessQty = Math.max(0, (Number(receivedQuantity) || 0) - (Number(poQuantity) || 0));
  const payable = (Number(acceptedQuantity) || 0) * (Number(unitPrice) || 0);

  const submit = async () => {
    if (receivedQuantity <= 0) return toast.error("Enter received quantity");
    setSaving(true);
    try {
      await base44.entities.DeliveryVerification.create({
        po_id: po.id, po_number: po.po_number, institute_id: po.institute_id, institute_name: po.institute_name,
        vendor_id: po.vendor_id, vendor_name: po.vendor_name,
        item_name: itemName || po.items?.[0]?.item_name || "",
        po_quantity: Number(poQuantity) || 0, received_quantity: Number(receivedQuantity) || 0,
        short_quantity: shortQty, excess_quantity: excessQty,
        accepted_quantity: Number(acceptedQuantity) || 0, returned_quantity: Number(returnedQuantity) || 0,
        unit_price: Number(unitPrice) || 0, payable_amount: payable,
        delivery_date: deliveryDate, remarks, attachment_url: attachmentUrl,
        action_taken: actionTaken,
        balance_pending: actionTaken === "receive_balance_later" ? shortQty : 0,
        verified_by_name: userName,
        status: actionTaken === "receive_balance_later" ? "balance_pending" : "verified",
      });
      // Update PO delivery date
      await base44.entities.PurchaseOrder.update(po.id, { delivery_date: deliveryDate });
      await logAudit("PurchaseOrder", po.id, po.po_number, userName, "Delivery Verified", "", `${receivedQuantity} received`, remarks);
      toast.success("Delivery recorded");
      onCreated();
    } catch (err) {
      toast.error(err.message || "Failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <Card className="w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold text-slate-800">Record Delivery</h2>
          <button onClick={onClose}><X className="w-5 h-5 text-slate-400" /></button>
        </div>
        <div className="space-y-4">
          <p className="text-xs text-slate-400">PO: {po.po_number} · {po.vendor_name}</p>
          <div>
            <Label>Item Name</Label>
            <Input value={itemName} onChange={(e) => setItemName(e.target.value)} placeholder="Item received" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>PO Quantity</Label>
              <Input type="number" value={poQuantity} onChange={(e) => setPoQuantity(e.target.value)} />
            </div>
            <div>
              <Label>Received Quantity</Label>
              <Input type="number" value={receivedQuantity} onChange={(e) => setReceivedQuantity(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Accepted Quantity</Label>
              <Input type="number" value={acceptedQuantity} onChange={(e) => setAcceptedQuantity(e.target.value)} />
            </div>
            <div>
              <Label>Returned Quantity</Label>
              <Input type="number" value={returnedQuantity} onChange={(e) => setReturnedQuantity(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Unit Price</Label>
              <Input type="number" value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)} />
            </div>
            <div>
              <Label>Delivery Date</Label>
              <Input type="date" value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)} />
            </div>
          </div>
          <div className="bg-slate-50 rounded-lg p-3 text-sm space-y-1">
            <div className="flex justify-between"><span className="text-slate-500">Short / Excess</span><span>{shortQty} / {excessQty}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Payable Amount</span><span className="font-medium">{formatINR(payable)}</span></div>
          </div>
          <div>
            <Label>Action Taken</Label>
            <Select value={actionTaken} onValueChange={setActionTaken}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="close_with_received">Close PO with received qty</SelectItem>
                <SelectItem value="receive_balance_later">Receive balance later</SelectItem>
                <SelectItem value="return_excess">Return excess</SelectItem>
                <SelectItem value="create_amendment">Create amendment</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Remarks</Label>
            <Textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} rows={2} />
          </div>
          <div>
            <Label>Delivery Proof URL</Label>
            <Input value={attachmentUrl} onChange={(e) => setAttachmentUrl(e.target.value)} placeholder="https://..." />
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={submit} disabled={saving}>{saving ? "Saving..." : "Save Delivery"}</Button>
          </div>
        </div>
      </Card>
    </div>
  );
}