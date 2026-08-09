import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Building2, Loader2, X } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { logAudit } from "@/lib/poUtils";
import { toast } from "sonner";

export default function AddInstituteModal({ userName, onClose, onCreated }) {
  const [form, setForm] = useState({ institute_name: "", institute_code: "", address: "" });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!form.institute_name.trim()) return toast.error("Institute name is required");
    if (!form.institute_code.trim()) return toast.error("Institute code is required");
    setSaving(true);
    try {
      const created = await base44.entities.Institute.create({
        institute_name: form.institute_name.trim(),
        institute_code: form.institute_code.trim().toUpperCase(),
        address: form.address.trim(),
        status: "active",
      });
      await logAudit("Institute", created.id, "", userName, "Institute Created", "", created.institute_name, "New institute registered");
      toast.success("Institute added successfully");
      onCreated();
      onClose();
    } catch (err) {
      toast.error(err.message || "Failed to add institute");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full space-y-4 p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between">
          <div>
            <h3 className="font-semibold text-slate-800 text-sm flex items-center gap-2"><Building2 className="w-4 h-4" /> Add New Institute</h3>
            <p className="text-xs text-slate-500 mt-0.5">Register a new school/institute in the system</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="w-4 h-4" /></button>
        </div>

        <div className="space-y-3">
          <div>
            <Label className="text-xs">Institute Name *</Label>
            <Input value={form.institute_name} onChange={(e) => setForm({ ...form, institute_name: e.target.value })} placeholder="e.g. Excellence International School" className="h-9 mt-1" />
          </div>
          <div>
            <Label className="text-xs">Institute Code *</Label>
            <Input value={form.institute_code} onChange={(e) => setForm({ ...form, institute_code: e.target.value })} placeholder="e.g. EIS" className="h-9 mt-1 uppercase" maxLength={10} />
            <p className="text-[10px] text-slate-400 mt-1">Used as a prefix for PO numbers (e.g. EIS-CAPEX-2026-00001)</p>
          </div>
          <div>
            <Label className="text-xs">Address</Label>
            <Textarea value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} rows={2} className="mt-1" placeholder="Full address of the institute" />
          </div>
        </div>

        <div className="flex gap-2 pt-1">
          <Button className="flex-1 bg-slate-900" onClick={save} disabled={saving}>
            {saving ? <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> Adding...</> : <><Building2 className="w-4 h-4 mr-1.5" /> Add Institute</>}
          </Button>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
        </div>
      </div>
    </div>
  );
}