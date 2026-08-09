import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useUserRole } from "@/lib/RoleContext";
import { formatINR } from "@/lib/poUtils";
import { Building2, Plus } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import AddInstituteModal from "@/components/institute/AddInstituteModal";

export default function Institutes() {
  const { isSuperAdmin, userName } = useUserRole();
  const [institutes, setInstitutes] = useState([]);
  const [pos, setPos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);

  const fetchData = async () => {
    try {
      const [insts, allPOs] = await Promise.all([base44.entities.Institute.list(), base44.entities.PurchaseOrder.list("-created_date", 500)]);
      setInstitutes(insts);
      setPos(allPOs.filter((p) => !p.deleted));
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, []);

  if (loading) return <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Institute Master</h1>
          <p className="text-sm text-slate-500 mt-0.5">{institutes.length} institutes registered</p>
        </div>
        {isSuperAdmin && (
          <Button onClick={() => setShowAdd(true)} className="bg-slate-900">
            <Plus className="w-4 h-4 mr-1.5" /> Add Institute
          </Button>
        )}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {institutes.map((i) => {
          const instPOs = pos.filter((p) => p.institute_id === i.id);
          const totalSpend = instPOs.reduce((s, p) => s + (p.grand_total || 0), 0);
          const outstanding = instPOs.reduce((s, p) => s + (p.outstanding_amount || 0), 0);
          return (
            <Card key={i.id} className="p-5 hover:shadow-md transition-shadow">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-11 h-11 rounded-lg bg-gradient-to-br from-slate-700 to-slate-500 flex items-center justify-center text-white font-bold">{i.institute_code?.[0] || "I"}</div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-slate-800 text-sm truncate">{i.institute_name}</div>
                  <div className="text-xs text-slate-400">Code: {i.institute_code}</div>
                </div>
                <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium ${i.status === "active" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                  {i.status === "active" ? "Active" : "Inactive"}
                </span>
              </div>
              {i.address && <div className="text-xs text-slate-500 mb-3">{i.address}</div>}
              <div className="grid grid-cols-3 gap-2 text-center pt-3 border-t border-slate-100">
                <div><div className="text-lg font-bold text-slate-800">{instPOs.length}</div><div className="text-[10px] text-slate-400 uppercase">POs</div></div>
                <div><div className="text-sm font-bold text-slate-800">{formatINR(totalSpend)}</div><div className="text-[10px] text-slate-400 uppercase">Spend</div></div>
                <div><div className="text-sm font-bold text-amber-600">{formatINR(outstanding)}</div><div className="text-[10px] text-slate-400 uppercase">Outstanding</div></div>
              </div>
            </Card>
          );
        })}
      </div>

      {showAdd && <AddInstituteModal userName={userName} onClose={() => setShowAdd(false)} onCreated={fetchData} />}
    </div>
  );
}