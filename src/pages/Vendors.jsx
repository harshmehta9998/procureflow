import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useUserRole } from "@/lib/RoleContext";
import { formatINR } from "@/lib/poUtils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Users, Plus, Search, Mail, Phone, MapPin } from "lucide-react";
import { toast } from "sonner";

export default function Vendors() {
  const { isInstituteAdmin, isFinance } = useUserRole();
  const [vendors, setVendors] = useState([]);
  const [pos, setPos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ vendor_name: "", vendor_type: "Stationery", contact_person: "", mobile_number: "", email: "", gst_number: "", pan_number: "", address: "", bank_details: "", status: "active" });

  useEffect(() => {
    (async () => {
      try {
        const [v, p] = await Promise.all([base44.entities.Vendor.list(), base44.entities.PurchaseOrder.list("-created_date", 500)]);
        setVendors(v);
        setPos(p.filter((x) => !x.deleted));
      } finally { setLoading(false); }
    })();
  }, []);

  const filtered = vendors.filter((v) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return [v.vendor_name, v.vendor_type, v.contact_person, v.mobile_number, v.gst_number].some((x) => (x || "").toLowerCase().includes(q));
  });

  const vendorSpend = (id) => pos.filter((p) => p.vendor_id === id).reduce((s, p) => s + (p.grand_total || 0), 0);

  const create = async () => {
    if (!form.vendor_name) return toast.error("Vendor name required");
    try {
      const created = await base44.entities.Vendor.create(form);
      setVendors([created, ...vendors]);
      setShowForm(false);
      setForm({ vendor_name: "", vendor_type: "Stationery", contact_person: "", mobile_number: "", email: "", gst_number: "", pan_number: "", address: "", bank_details: "", status: "active" });
      toast.success("Vendor created");
    } catch { toast.error("Failed to create vendor"); }
  };

  if (loading) return <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Vendor Master</h1>
          <p className="text-sm text-slate-500 mt-0.5">{vendors.length} vendors registered</p>
        </div>
        {!isFinance && <Button className="bg-slate-900" onClick={() => setShowForm(!showForm)}><Plus className="w-4 h-4 mr-1.5" /> Add Vendor</Button>}
      </div>

      {showForm && (
        <Card className="p-5">
          <h3 className="font-semibold text-slate-800 text-sm mb-3">New Vendor</h3>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div><Label className="text-xs">Vendor Name *</Label><Input value={form.vendor_name} onChange={(e) => setForm({ ...form, vendor_name: e.target.value })} className="h-9 mt-1" /></div>
            <div><Label className="text-xs">Vendor Type</Label>
              <Select value={form.vendor_type} onValueChange={(v) => setForm({ ...form, vendor_type: v })}>
                <SelectTrigger className="h-9 mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>{["Construction", "Furniture", "Equipment", "Stationery", "Marketing", "Repairs", "Consumables", "Services", "Electrical", "Plumbing", "Civil", "Other"].map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label className="text-xs">Contact Person</Label><Input value={form.contact_person} onChange={(e) => setForm({ ...form, contact_person: e.target.value })} className="h-9 mt-1" /></div>
            <div><Label className="text-xs">Mobile</Label><Input value={form.mobile_number} onChange={(e) => setForm({ ...form, mobile_number: e.target.value })} className="h-9 mt-1" /></div>
            <div><Label className="text-xs">Email</Label><Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="h-9 mt-1" /></div>
            <div><Label className="text-xs">GST Number</Label><Input value={form.gst_number} onChange={(e) => setForm({ ...form, gst_number: e.target.value })} className="h-9 mt-1" /></div>
            <div><Label className="text-xs">PAN Number</Label><Input value={form.pan_number} onChange={(e) => setForm({ ...form, pan_number: e.target.value })} className="h-9 mt-1" /></div>
            <div><Label className="text-xs">Bank Details</Label><Input value={form.bank_details} onChange={(e) => setForm({ ...form, bank_details: e.target.value })} className="h-9 mt-1" /></div>
            <div className="col-span-2 lg:col-span-4"><Label className="text-xs">Address</Label><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className="h-9 mt-1" /></div>
          </div>
          <div className="flex gap-2 mt-3"><Button className="bg-slate-900" onClick={create}>Save</Button><Button variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button></div>
        </Card>
      )}

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input type="text" placeholder="Search vendors by name, type, contact, GST..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full pl-9 pr-3 py-2.5 text-sm rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-slate-200" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((v) => (
          <Card key={v.id} className="p-4 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center"><Users className="w-5 h-5 text-slate-500" /></div>
                <div>
                  <div className="font-semibold text-slate-800 text-sm">{v.vendor_name}</div>
                  <div className="text-xs text-slate-400">{v.vendor_type}</div>
                </div>
              </div>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${v.status === "active" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>{v.status}</span>
            </div>
            <div className="space-y-1 text-xs text-slate-500">
              {v.contact_person && <div className="flex items-center gap-1.5">{v.contact_person}</div>}
              {v.mobile_number && <div className="flex items-center gap-1.5"><Phone className="w-3 h-3" />{v.mobile_number}</div>}
              {v.email && <div className="flex items-center gap-1.5"><Mail className="w-3 h-3" />{v.email}</div>}
              {v.gst_number && <div className="flex items-center gap-1.5">GST: {v.gst_number}</div>}
            </div>
            <div className="mt-3 pt-2 border-t border-slate-100 flex justify-between items-center">
              <span className="text-xs text-slate-400">Total Spend</span>
              <span className="text-sm font-semibold text-slate-800">{formatINR(vendorSpend(v.id))}</span>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}