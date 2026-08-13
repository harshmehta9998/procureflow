import React, { useEffect, useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useUserRole } from "@/lib/RoleContext";
import { StatCard, EmptyState } from "@/components/po/Shared";
import { formatINR } from "@/lib/poUtils";
import { Building2, ChevronRight } from "lucide-react";

export default function InstitutionFinance() {
  const { accessibleInstitutes, scopeInstituteIds, activeInstitute } = useUserRole();
  const [institutes, setInstitutes] = useState([]);
  const [pos, setPos] = useState([]);
  const [payments, setPayments] = useState([]);
  const [credits, setCredits] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [insts, allPos, allPays, allCredits] = await Promise.all([
          base44.entities.Institute.list(),
          base44.entities.PurchaseOrder.list("-created_date", 1000),
          base44.entities.Payment.list("-payment_date", 1000),
          base44.entities.VendorCredit.list("-created_date", 500),
        ]);
        setInstitutes(insts);
        setPos(allPos.filter((p) => !p.deleted));
        setPayments(allPays);
        setCredits(allCredits.filter((c) => !c.deleted));
      } finally { setLoading(false); }
    })();
  }, []);

  const visibleInsts = useMemo(() => {
    let list = accessibleInstitutes;
    if (scopeInstituteIds !== null) list = list.filter((i) => scopeInstituteIds.includes(i.id));
    return list;
  }, [accessibleInstitutes, scopeInstituteIds]);

  const summary = useMemo(() => visibleInsts.map((inst) => {
    const instPos = pos.filter((p) => p.institute_id === inst.id && !p.cancelled);
    const totalValue = instPos.reduce((s, p) => s + (p.grand_total || 0), 0);
    const totalPaid = instPos.reduce((s, p) => s + (p.amount_paid || 0), 0);
    const outstanding = instPos.reduce((s, p) => s + (p.outstanding_amount || 0), 0);
    const cancelled = pos.filter((p) => p.institute_id === inst.id && p.cancelled).length;
    const refunds = credits.filter((c) => c.institute_id === inst.id && c.settlement_type === "refund").reduce((s, c) => s + (c.amount || 0), 0);
    const creditsAdj = credits.filter((c) => c.institute_id === inst.id && c.settlement_type === "credit_adjustment").reduce((s, c) => s + (c.amount || 0), 0);
    return { ...inst, totalValue, totalPaid, outstanding, cancelled, refunds, creditsAdj, poCount: instPos.length };
  }), [visibleInsts, pos, credits]);

  const totalOutstanding = summary.reduce((s, i) => s + i.outstanding, 0);

  if (loading) return <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" /></div>;

  if (visibleInsts.length === 0) {
    return <div className="text-center py-20 text-slate-500">No institutions assigned to you.</div>;
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Institution-wise Finance</h1>
        <p className="text-sm text-slate-500 mt-0.5">Click any institution for its complete financial breakdown</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Institutions" value={summary.length} icon={Building2} accent="slate" />
        <StatCard label="Total PO Value" value={formatINR(summary.reduce((s, i) => s + i.totalValue, 0))} icon={Building2} accent="blue" />
        <StatCard label="Total Paid" value={formatINR(summary.reduce((s, i) => s + i.totalPaid, 0))} icon={Building2} accent="emerald" />
        <StatCard label="Total Outstanding" value={formatINR(totalOutstanding)} icon={Building2} accent="amber" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {summary.map((inst) => (
          <div key={inst.id} className="bg-white rounded-xl border border-slate-200 p-5 hover:shadow-md transition-shadow cursor-pointer" onClick={() => window.location.href = `/purchase-orders?institute=${inst.id}`}>
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center"><Building2 className="w-4 h-4 text-slate-500" /></div>
                <div><div className="font-semibold text-slate-800 text-sm">{inst.institute_name}</div><div className="text-xs text-slate-400">{inst.institute_code} · {inst.centre_head_name ? `CH: ${inst.centre_head_name}` : "No Centre Head"}</div></div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-300" />
            </div>
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between"><span className="text-slate-500">POs</span><span className="font-medium text-slate-700">{inst.poCount} ({inst.cancelled} cancelled)</span></div>
              <div className="flex justify-between"><span className="text-slate-500">PO Value</span><span className="font-medium text-slate-700">{formatINR(inst.totalValue)}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Paid</span><span className="font-medium text-emerald-600">{formatINR(inst.totalPaid)}</span></div>
              <div className="flex justify-between border-t border-slate-100 pt-1.5"><span className="text-slate-500">Outstanding</span><span className="font-medium text-amber-600">{formatINR(inst.outstanding)}</span></div>
              {inst.refunds > 0 && <div className="flex justify-between"><span className="text-slate-500">Refunds</span><span className="text-blue-600">{formatINR(inst.refunds)}</span></div>}
              {inst.creditsAdj > 0 && <div className="flex justify-between"><span className="text-slate-500">Credits</span><span className="text-purple-600">{formatINR(inst.creditsAdj)}</span></div>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}