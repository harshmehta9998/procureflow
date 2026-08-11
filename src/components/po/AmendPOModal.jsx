import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X, Plus, Trash2 } from "lucide-react";
import { formatINR, calcTotals } from "@/lib/poUtils";

export default function AmendPOModal({ po, onClose, onConfirm, presetItems, presetReason, presetType }) {
  const [reason, setReason] = useState(presetReason || "");
  const [type, setType] = useState(presetType || "quantity_change");
  const [items, setItems] = useState(
    (presetItems || po.items || []).map((i) => ({ ...i }))
  );

  const updateItem = (idx, field, val) => {
    const next = [...items];
    next[idx] = { ...next[idx], [field]: field === "quantity" || field === "rate" || field === "gst_percent" ? Number(val) || 0 : val };
    if (field === "quantity" || field === "rate" || field === "gst_percent") {
      const it = next[idx];
      const base = (it.quantity || 0) * (it.rate || 0);
      it.amount = Math.round(base * (1 + (it.gst_percent || 0) / 100) * 100) / 100;
    }
    setItems(next);
  };

  const addItem = () => setItems([...items, { item_name: "", description: "", quantity: 1, unit: "Nos", rate: 0, gst_percent: 0, amount: 0 }]);
  const removeItem = (idx) => setItems(items.filter((_, i) => i !== idx));

  const totals = calcTotals(items);
  const submit = () => {
    if (!reason) return;
    onConfirm({ reason, type, items, grandTotal: totals.grandTotal });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <Card className="w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-800">Create PO Amendment</h2>
            <p className="text-xs text-slate-400">Parent PO: {po.po_number}</p>
          </div>
          <button onClick={onClose}><X className="w-5 h-5 text-slate-400" /></button>
        </div>
        <div className="space-y-4">
          <div>
            <Label>Amendment Type *</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="quantity_change">Quantity Change</SelectItem>
                <SelectItem value="price_change">Price Change</SelectItem>
                <SelectItem value="additional_items">Additional Items</SelectItem>
                <SelectItem value="item_removal">Item Removal</SelectItem>
                <SelectItem value="delivery_change">Delivery Change</SelectItem>
                <SelectItem value="other_commercial">Other Commercial</SelectItem>
                <SelectItem value="excess_quantity">Excess Quantity</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Amendment Reason *</Label>
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} />
          </div>
          <div>
            <div className="flex justify-between items-center mb-2">
              <Label>Items (edit quantities/rates as needed)</Label>
              <Button size="sm" variant="outline" onClick={addItem}><Plus className="w-3.5 h-3.5 mr-1" /> Add Item</Button>
            </div>
            <div className="space-y-2">
              {items.map((it, idx) => (
                <div key={idx} className="border border-slate-200 rounded-lg p-3 grid grid-cols-12 gap-2 items-center">
                  <Input className="col-span-4" placeholder="Item name" value={it.item_name} onChange={(e) => updateItem(idx, "item_name", e.target.value)} />
                  <Input className="col-span-2" type="number" placeholder="Qty" value={it.quantity} onChange={(e) => updateItem(idx, "quantity", e.target.value)} />
                  <Input className="col-span-2" type="number" placeholder="Rate" value={it.rate} onChange={(e) => updateItem(idx, "rate", e.target.value)} />
                  <Input className="col-span-2" type="number" placeholder="GST%" value={it.gst_percent} onChange={(e) => updateItem(idx, "gst_percent", e.target.value)} />
                  <div className="col-span-1 text-xs text-slate-600 text-right">{formatINR(it.amount || 0)}</div>
                  <button className="col-span-1 text-rose-500" onClick={() => removeItem(idx)}><Trash2 className="w-4 h-4" /></button>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-slate-50 rounded-lg p-3 flex justify-between text-sm font-medium">
            <span>New Grand Total</span>
            <span className="text-slate-800">{formatINR(totals.grandTotal)}</span>
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={submit}>Create Amendment</Button>
          </div>
        </div>
      </Card>
    </div>
  );
}