import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { formatINR } from "@/lib/poUtils";
import { Building2 } from "lucide-react";
import { Card } from "@/components/ui/card";

export default function Institutes() {
  const [institutes, setInstitutes] = useState([]);
  const [pos, setPos] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [insts, allPOs] = await Promise.all([base44.entities.Institute.list(), base44.entities.PurchaseOrder.list("-created_date", 500)]);
        setInstitutes(insts);
        setPos(allPOs.filter((p) => !p.deleted));
      } finally { setLoading(false); }
    })();
  }, []);

  if (loading) return <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Institute Master</h1>
        <p className="text-sm text-slate-500 mt-0.5">{institutes.length} institutes registered</p>
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
                <div>
                  <div className="font-semibold text-slate-800 text-sm">{i.institute_name}</div>
                  <div className="text-xs text-slate-400">Code: {i.institute_code}</div>
                </div>
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
    </div>
  );
}