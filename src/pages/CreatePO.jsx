import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useUserRole } from "@/lib/RoleContext";
import { formatINR, calcItemAmount, calcTotals, generatePONumber, todayISO, logAudit } from "@/lib/poUtils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2, Upload, ChevronRight, ChevronLeft, Save, Send, X, UserPlus } from "lucide-react";
import { toast } from "sonner";

const STEPS = ["Institute & Type", "Vendor", "Quotation", "PO Details", "Items", "Payment Terms", "Review"];

export default function CreatePO() {
  const navigate = useNavigate();
  const { instituteId, instituteName, userName } = useUserRole();
  const [step, setStep] = useState(0);
  const [institutes, setInstitutes] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showNewVendor, setShowNewVendor] = useState(false);
  const [newVendor, setNewVendor] = useState({ vendor_name: "", vendor_type: "Stationery", contact_person: "", mobile_number: "", email: "", gst_number: "", pan_number: "", address: "", bank_details: "", status: "active" });

  const [form, setForm] = useState({
    institute_id: instituteId || "",
    po_category: "capex",
    po_type: "standard",
    vendor_id: "",
    quotation_url: "",
    po_title: "",
    department: "",
    description: "",
    purpose: "",
    items: [{ item_name: "", description: "", quantity: 1, unit: "Nos", rate: 0, gst_percent: 18, amount: 0 }],
    payment_terms: "",
    due_date: "",
    delivery_terms: "",
    tax_terms: "GST applicable",
    special_conditions: "",
    status: "draft",
  });

  useEffect(() => {
    (async () => {
      try {
        const [insts, vens] = await Promise.all([base44.entities.Institute.list(), base44.entities.Vendor.list()]);
        setInstitutes(insts);
        setVendors(vens.filter((v) => v.status === "active"));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const totals = calcTotals(form.items);

  const updateItem = (idx, field, value) => {
    const items = [...form.items];
    items[idx] = { ...items[idx], [field]: field === "quantity" || field === "rate" || field === "gst_percent" ? Number(value) : value };
    items[idx].amount = calcItemAmount(items[idx]).total;
    setForm({ ...form, items });
  };

  const addItem = () => setForm({ ...form, items: [...form.items, { item_name: "", description: "", quantity: 1, unit: "Nos", rate: 0, gst_percent: 18, amount: 0 }] });
  const removeItem = (idx) => setForm({ ...form, items: form.items.filter((_, i) => i !== idx) });

  const handleUpload = async (e, field) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setForm({ ...form, [field]: file_url });
      toast.success("File uploaded");
    } catch (err) {
      toast.error("Upload failed");
    }
  };

  const createVendor = async () => {
    if (!newVendor.vendor_name) return toast.error("Vendor name required");
    try {
      const created = await base44.entities.Vendor.create(newVendor);
      setVendors([...vendors, created]);
      setForm({ ...form, vendor_id: created.id });
      setShowNewVendor(false);
      setNewVendor({ vendor_name: "", vendor_type: "Stationery", contact_person: "", mobile_number: "", email: "", gst_number: "", pan_number: "", address: "", bank_details: "", status: "active" });
      toast.success("Vendor created");
    } catch (err) {
      toast.error("Failed to create vendor");
    }
  };

  const validate = () => {
    if (step === 0 && !form.institute_id) return "Please select an institute";
    if (step === 1 && !form.vendor_id) return "Please select a vendor";
    if (step === 3 && !form.po_title) return "PO title is required";
    if (step === 4 && form.items.every((i) => !i.item_name)) return "Add at least one item";
    return null;
  };

  const next = () => { const err = validate(); if (err) return toast.error(err); setStep(step + 1); };
  const back = () => setStep(step - 1);

  const savePO = async (submitForApproval = false) => {
    const err = validate();
    if (err) return toast.error(err);
    if (!form.po_title) return toast.error("PO title required");

    setSaving(true);
    try {
      const inst = institutes.find((i) => i.id === form.institute_id);
      const vendor = vendors.find((v) => v.id === form.vendor_id);
      const poNumber = await generatePONumber(inst.institute_code, form.po_category);
      const status = submitForApproval ? "pending_approval" : "draft";

      const poData = {
        ...form,
        po_number: poNumber,
        institute_name: inst.institute_name,
        institute_code: inst.institute_code,
        vendor_name: vendor.vendor_name,
        subtotal: totals.subtotal,
        gst_total: totals.gstTotal,
        grand_total: totals.grandTotal,
        outstanding_amount: submitForApproval ? totals.grandTotal : 0,
        amount_paid: 0,
        payment_status: "none",
        status,
        created_by_name: userName,
        deleted: false,
      };

      const created = await base44.entities.PurchaseOrder.create(poData);
      await logAudit("PurchaseOrder", created.id, poNumber, userName, submitForApproval ? "Submitted for Approval" : "PO Created", "", status, submitForApproval ? "Submitted for approval" : "Created as draft");

      toast.success(submitForApproval ? "PO submitted for approval" : "PO saved as draft");
      navigate(`/po/${created.id}`);
    } catch (err) {
      toast.error(err.message || "Failed to save PO");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" /></div>;

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Create Purchase Order</h1>
          <p className="text-sm text-slate-500 mt-0.5">Step {step + 1} of {STEPS.length}: {STEPS[step]}</p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => navigate("/purchase-orders")}><X className="w-4 h-4" /> Cancel</Button>
      </div>

      {/* Stepper */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1">
        {STEPS.map((s, i) => (
          <React.Fragment key={s}>
            <button onClick={() => i < step && setStep(i)} className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${i === step ? "bg-slate-900 text-white" : i < step ? "bg-slate-100 text-slate-600" : "text-slate-400"}`}>
              {i + 1}. {s}
            </button>
            {i < STEPS.length - 1 && <ChevronRight className="w-3 h-3 text-slate-300 flex-shrink-0" />}
          </React.Fragment>
        ))}
      </div>

      <Card className="p-6 space-y-4">
        {/* Step 0: Institute & Type */}
        {step === 0 && (
          <div className="space-y-4">
            <div>
              <Label className="text-sm font-medium">Institute *</Label>
              <Select value={form.institute_id} onValueChange={(v) => setForm({ ...form, institute_id: v })} disabled={!!instituteId}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Select institute" /></SelectTrigger>
                <SelectContent>{institutes.map((i) => <SelectItem key={i.id} value={i.id}>{i.institute_name} ({i.institute_code})</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium">Category *</Label>
                <div className="grid grid-cols-2 gap-2 mt-1">
                  {["capex", "opex"].map((c) => (
                    <button key={c} onClick={() => setForm({ ...form, po_category: c })} className={`px-4 py-3 rounded-lg border-2 text-sm font-medium transition-colors ${form.po_category === c ? "border-slate-900 bg-slate-50 text-slate-900" : "border-slate-200 text-slate-500"}`}>
                      {c === "capex" ? "Capex" : "Opex"}
                      <div className="text-[10px] text-slate-400 font-normal mt-0.5">{c === "capex" ? "Capital Expenditure" : "Operating Expenditure"}</div>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <Label className="text-sm font-medium">PO Type *</Label>
                <div className="grid grid-cols-2 gap-2 mt-1">
                  {["standard", "open"].map((t) => (
                    <button key={t} onClick={() => setForm({ ...form, po_type: t })} className={`px-4 py-3 rounded-lg border-2 text-sm font-medium transition-colors ${form.po_type === t ? "border-slate-900 bg-slate-50 text-slate-900" : "border-slate-200 text-slate-500"}`}>
                      {t === "standard" ? "Standard" : "Open"}
                      <div className="text-[10px] text-slate-400 font-normal mt-0.5">{t === "standard" ? "Fixed quantity" : "Variable quantity"}</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 1: Vendor */}
        {step === 1 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Select Vendor *</Label>
              <Button variant="outline" size="sm" onClick={() => setShowNewVendor(!showNewVendor)}><UserPlus className="w-4 h-4 mr-1" /> Create New Vendor</Button>
            </div>
            <Select value={form.vendor_id} onValueChange={(v) => setForm({ ...form, vendor_id: v })}>
              <SelectTrigger><SelectValue placeholder="Search and select vendor" /></SelectTrigger>
              <SelectContent>{vendors.map((v) => <SelectItem key={v.id} value={v.id}>{v.vendor_name} · {v.vendor_type}</SelectItem>)}</SelectContent>
            </Select>
            {form.vendor_id && (() => {
              const v = vendors.find((x) => x.id === form.vendor_id);
              return v ? (
                <div className="bg-slate-50 rounded-lg p-4 text-sm grid grid-cols-2 gap-2">
                  <div><span className="text-slate-400">Contact:</span> {v.contact_person || "-"}</div>
                  <div><span className="text-slate-400">Mobile:</span> {v.mobile_number || "-"}</div>
                  <div><span className="text-slate-400">GST:</span> {v.gst_number || "-"}</div>
                  <div><span className="text-slate-400">PAN:</span> {v.pan_number || "-"}</div>
                  <div className="col-span-2"><span className="text-slate-400">Address:</span> {v.address || "-"}</div>
                </div>
              ) : null;
            })()}
            {showNewVendor && (
              <div className="border border-slate-200 rounded-lg p-4 space-y-3 bg-white">
                <h4 className="font-medium text-slate-800 text-sm">New Vendor Details</h4>
                <div className="grid grid-cols-2 gap-3">
                  <Input placeholder="Vendor Name *" value={newVendor.vendor_name} onChange={(e) => setNewVendor({ ...newVendor, vendor_name: e.target.value })} />
                  <Select value={newVendor.vendor_type} onValueChange={(v) => setNewVendor({ ...newVendor, vendor_type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{["Construction", "Furniture", "Equipment", "Stationery", "Marketing", "Repairs", "Consumables", "Services", "Electrical", "Plumbing", "Civil", "Other"].map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                  </Select>
                  <Input placeholder="Contact Person" value={newVendor.contact_person} onChange={(e) => setNewVendor({ ...newVendor, contact_person: e.target.value })} />
                  <Input placeholder="Mobile Number" value={newVendor.mobile_number} onChange={(e) => setNewVendor({ ...newVendor, mobile_number: e.target.value })} />
                  <Input placeholder="Email" value={newVendor.email} onChange={(e) => setNewVendor({ ...newVendor, email: e.target.value })} />
                  <Input placeholder="GST Number" value={newVendor.gst_number} onChange={(e) => setNewVendor({ ...newVendor, gst_number: e.target.value })} />
                  <Input placeholder="PAN Number" value={newVendor.pan_number} onChange={(e) => setNewVendor({ ...newVendor, pan_number: e.target.value })} />
                  <Input placeholder="Bank Details" value={newVendor.bank_details} onChange={(e) => setNewVendor({ ...newVendor, bank_details: e.target.value })} />
                  <Input placeholder="Address" className="col-span-2" value={newVendor.address} onChange={(e) => setNewVendor({ ...newVendor, address: e.target.value })} />
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={createVendor} className="bg-slate-900">Save Vendor</Button>
                  <Button size="sm" variant="ghost" onClick={() => setShowNewVendor(false)}>Cancel</Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Step 2: Quotation */}
        {step === 2 && (
          <div className="space-y-4">
            <Label className="text-sm font-medium">Upload Approved Quotation</Label>
            <p className="text-xs text-slate-500">Upload the approved quotation document (PDF, JPG, PNG)</p>
            <label className="flex flex-col items-center justify-center border-2 border-dashed border-slate-200 rounded-xl p-8 cursor-pointer hover:border-slate-400 transition-colors">
              <Upload className="w-8 h-8 text-slate-300 mb-2" />
              <span className="text-sm text-slate-500">{form.quotation_url ? "File uploaded ✓ Click to replace" : "Click to upload or drag file here"}</span>
              <input type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" onChange={(e) => handleUpload(e, "quotation_url")} />
            </label>
            {form.quotation_url && (
              <div className="flex items-center gap-2 text-sm text-emerald-600"><span>📎 Quotation attached</span><a href={form.quotation_url} target="_blank" rel="noreferrer" className="text-blue-600 underline">View</a></div>
            )}
          </div>
        )}

        {/* Step 3: PO Details */}
        {step === 3 && (
          <div className="space-y-4">
            <div><Label className="text-sm font-medium">PO Title *</Label><Input className="mt-1" value={form.po_title} onChange={(e) => setForm({ ...form, po_title: e.target.value })} placeholder="e.g. Classroom Furniture - Block A" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-sm font-medium">Department</Label><Input className="mt-1" value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} placeholder="e.g. Administration" /></div>
              <div><Label className="text-sm font-medium">Purpose</Label><Input className="mt-1" value={form.purpose} onChange={(e) => setForm({ ...form, purpose: e.target.value })} placeholder="e.g. New block furnishing" /></div>
            </div>
            <div><Label className="text-sm font-medium">Description</Label><Textarea className="mt-1" rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Detailed description of the purchase..." /></div>
          </div>
        )}

        {/* Step 4: Items */}
        {step === 4 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Item Table</Label>
              <Button size="sm" variant="outline" onClick={addItem}><Plus className="w-4 h-4 mr-1" /> Add Item</Button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-xs text-slate-500">
                  <tr>
                    <th className="text-left px-2 py-2 font-medium">Item Name</th>
                    <th className="text-left px-2 py-2 font-medium">Description</th>
                    <th className="text-right px-2 py-2 font-medium w-16">Qty</th>
                    <th className="text-left px-2 py-2 font-medium w-20">Unit</th>
                    <th className="text-right px-2 py-2 font-medium w-24">Rate</th>
                    <th className="text-right px-2 py-2 font-medium w-16">GST%</th>
                    <th className="text-right px-2 py-2 font-medium w-28">Amount</th>
                    <th className="w-8"></th>
                  </tr>
                </thead>
                <tbody>
                  {form.items.map((item, idx) => (
                    <tr key={idx} className="border-b border-slate-100">
                      <td className="px-1 py-1"><Input value={item.item_name} onChange={(e) => updateItem(idx, "item_name", e.target.value)} placeholder="Item name" className="h-8 text-sm" /></td>
                      <td className="px-1 py-1"><Input value={item.description} onChange={(e) => updateItem(idx, "description", e.target.value)} placeholder="Description" className="h-8 text-sm" /></td>
                      <td className="px-1 py-1"><Input type="number" value={item.quantity} onChange={(e) => updateItem(idx, "quantity", e.target.value)} className="h-8 text-sm text-right" /></td>
                      <td className="px-1 py-1"><Input value={item.unit} onChange={(e) => updateItem(idx, "unit", e.target.value)} placeholder="Nos" className="h-8 text-sm" /></td>
                      <td className="px-1 py-1"><Input type="number" value={item.rate} onChange={(e) => updateItem(idx, "rate", e.target.value)} className="h-8 text-sm text-right" /></td>
                      <td className="px-1 py-1"><Input type="number" value={item.gst_percent} onChange={(e) => updateItem(idx, "gst_percent", e.target.value)} className="h-8 text-sm text-right" /></td>
                      <td className="px-1 py-1 text-right font-medium text-slate-700">{formatINR(item.amount)}</td>
                      <td className="px-1 py-1">{form.items.length > 1 && <button onClick={() => removeItem(idx)} className="text-red-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex justify-end">
              <div className="w-64 space-y-1.5 text-sm">
                <div className="flex justify-between text-slate-600"><span>Subtotal</span><span className="font-medium">{formatINR(totals.subtotal)}</span></div>
                <div className="flex justify-between text-slate-600"><span>GST Total</span><span className="font-medium">{formatINR(totals.gstTotal)}</span></div>
                <div className="flex justify-between text-base font-bold text-slate-800 border-t border-slate-200 pt-1.5"><span>Grand Total</span><span>{formatINR(totals.grandTotal)}</span></div>
              </div>
            </div>
          </div>
        )}

        {/* Step 5: Payment Terms */}
        {step === 5 && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-sm font-medium">Payment Terms</Label><Input className="mt-1" value={form.payment_terms} onChange={(e) => setForm({ ...form, payment_terms: e.target.value })} placeholder="e.g. 50% advance, 50% on delivery" /></div>
              <div><Label className="text-sm font-medium">Due Date</Label><Input type="date" className="mt-1" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} /></div>
              <div><Label className="text-sm font-medium">Delivery Terms</Label><Input className="mt-1" value={form.delivery_terms} onChange={(e) => setForm({ ...form, delivery_terms: e.target.value })} placeholder="e.g. Within 30 days" /></div>
              <div><Label className="text-sm font-medium">Tax Terms</Label><Input className="mt-1" value={form.tax_terms} onChange={(e) => setForm({ ...form, tax_terms: e.target.value })} placeholder="e.g. GST 18%" /></div>
            </div>
            <div><Label className="text-sm font-medium">Special Conditions</Label><Textarea className="mt-1" rows={3} value={form.special_conditions} onChange={(e) => setForm({ ...form, special_conditions: e.target.value })} placeholder="Any special conditions..." /></div>
          </div>
        )}

        {/* Step 6: Review */}
        {step === 6 && (
          <div className="space-y-4">
            <div className="bg-slate-50 rounded-lg p-4 space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-slate-500">Institute:</span><span className="font-medium">{institutes.find((i) => i.id === form.institute_id)?.institute_name}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Category / Type:</span><span className="font-medium">{form.po_category.toUpperCase()} / {form.po_type}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Vendor:</span><span className="font-medium">{vendors.find((v) => v.id === form.vendor_id)?.vendor_name}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">PO Title:</span><span className="font-medium">{form.po_title}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Department:</span><span className="font-medium">{form.department || "-"}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Items:</span><span className="font-medium">{form.items.length} item(s)</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Due Date:</span><span className="font-medium">{form.due_date || "-"}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Quotation:</span><span className="font-medium">{form.quotation_url ? "Attached" : "Not attached"}</span></div>
            </div>
            <div className="flex justify-end">
              <div className="w-64 space-y-1.5 text-sm">
                <div className="flex justify-between text-slate-600"><span>Subtotal</span><span className="font-medium">{formatINR(totals.subtotal)}</span></div>
                <div className="flex justify-between text-slate-600"><span>GST Total</span><span className="font-medium">{formatINR(totals.gstTotal)}</span></div>
                <div className="flex justify-between text-base font-bold text-slate-800 border-t border-slate-200 pt-1.5"><span>Grand Total</span><span>{formatINR(totals.grandTotal)}</span></div>
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={back} disabled={step === 0}><ChevronLeft className="w-4 h-4 mr-1" /> Back</Button>
        <div className="flex gap-2">
          {step === STEPS.length - 1 && (
            <>
              <Button variant="outline" onClick={() => savePO(false)} disabled={saving}><Save className="w-4 h-4 mr-1" /> Save as Draft</Button>
              <Button onClick={() => savePO(true)} disabled={saving} className="bg-slate-900 hover:bg-slate-800"><Send className="w-4 h-4 mr-1" /> Submit for Approval</Button>
            </>
          )}
          {step < STEPS.length - 1 && <Button onClick={next} className="bg-slate-900 hover:bg-slate-800">Next <ChevronRight className="w-4 h-4 ml-1" /></Button>}
        </div>
      </div>
    </div>
  );
}