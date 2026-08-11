import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X } from "lucide-react";
import { formatINR } from "@/lib/poUtils";

export default function CancelPOModal({ po, onClose, onConfirm }) {
  const [reason, setReason] = useState("");
  const [comments, setComments] = useState("");
  const [settlementType, setSettlementType] = useState("none");
  const [amount, setAmount] = useState(0);
  const [targetPoId, setTargetPoId] = useState("");
  const [targetPoNumber, setTargetPoNumber] = useState("");
  const [remarks, setRemarks] = useState("");
  const [docUrl, setDocUrl] = useState("");

  const submit = () => {
    if (!reason) return;
    onConfirm({ reason, comments, settlementType, amount: Number(amount) || 0, targetPoId, targetPoNumber, remarks, docUrl });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <Card className="w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold text-slate-800">Cancel PO & Settlement</h2>
          <button onClick={onClose}><X className="w-5 h-5 text-slate-400" /></button>
        </div>
        <div className="space-y-4">
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-700">
            Cancelling <b>{po.po_number}</b> · Outstanding: {formatINR(po.outstanding_amount || 0)}
          </div>
          <div>
            <Label>Cancellation Reason *</Label>
            <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Order no longer required" />
          </div>
          <div>
            <Label>Comments</Label>
            <Textarea value={comments} onChange={(e) => setComments(e.target.value)} rows={2} />
          </div>
          <div>
            <Label>Financial Settlement Type</Label>
            <Select value={settlementType} onValueChange={setSettlementType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None (no money involved)</SelectItem>
                <SelectItem value="refund">Refund expected from vendor</SelectItem>
                <SelectItem value="credit_adjustment">Credit adjustment to another PO</SelectItem>
                <SelectItem value="write_off">Write-off</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {settlementType !== "none" && (
            <div>
              <Label>Settlement Amount</Label>
              <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
          )}
          {settlementType === "credit_adjustment" && (
            <>
              <div>
                <Label>Target PO ID</Label>
                <Input value={targetPoId} onChange={(e) => setTargetPoId(e.target.value)} placeholder="PO id to apply credit" />
              </div>
              <div>
                <Label>Target PO Number</Label>
                <Input value={targetPoNumber} onChange={(e) => setTargetPoNumber(e.target.value)} />
              </div>
            </>
          )}
          {settlementType === "write_off" && (
            <div>
              <Label>Write-off Reason</Label>
              <Input value={remarks} onChange={(e) => setRemarks(e.target.value)} />
            </div>
          )}
          <div>
            <Label>Settlement Remarks</Label>
            <Textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} rows={2} />
          </div>
          <div>
            <Label>Cancellation Document URL</Label>
            <Input value={docUrl} onChange={(e) => setDocUrl(e.target.value)} placeholder="https://..." />
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button className="bg-rose-600 hover:bg-rose-700" onClick={submit}>Confirm Cancellation</Button>
          </div>
        </div>
      </Card>
    </div>
  );
}