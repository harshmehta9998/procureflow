import React, { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useUserRole } from "@/lib/RoleContext";
import { StatCard, EmptyState, StatusBadge } from "@/components/po/Shared";
import { formatINR, formatDate, AMENDMENT_LABELS, PO_CATEGORY_LABELS } from "@/lib/poUtils";
import { GitBranch } from "lucide-react";

export default function POAmendments() {
  const navigate = useNavigate();
  const { isSuperAdmin, isFinance, isCentreHead, isInstituteAdmin, scopeInstituteIds, activeInstitute } = useUserRole();
  const [pos, setPos] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const list = await base44.entities.PurchaseOrder.list("-created_date", 1000);
        setPos(list.filter((p) => !p.deleted));
      } finally { setLoading(false); }
    })();
  }, []);

  const amendments = useMemo(() => pos.filter((p) => p.is_amendment).filter((p) => {
    if (scopeInstituteIds !== null && !scopeInstituteIds.includes(p.institute_id)) return false;
    return true;
  }), [pos, scopeInstituteIds]);

  const parents = useMemo(() => {
    const map = {};
    amendments.forEach((a) => { map[a.parent_po_id] = (map[a.parent_po_id] || []).concat(a); });
    return map;
  }, [amendments]);

  const totalAdditional = amendments.reduce((s, a) => s + Math.max(0, (a.grand_total || 0) - 0), 0);

  if (loading) return <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">PO Amendments</h1>
        <p className="text-sm text-slate-500 mt-0.5">{amendments.length} amendments · Original POs remain as immutable records</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <StatCard label="Amendments" value={amendments.length} icon={GitBranch} accent="slate" />
        <StatCard label="Excess Quantity" value={amendments.filter((a) => a.amendment_type === "excess_quantity").length} icon={GitBranch} accent="amber" />
        <StatCard label="Total Amendment Value" value={formatINR(amendments.reduce((s, a) => s + (a.grand_total || 0), 0))} icon={GitBranch} accent="blue" />
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-200"><h3 className="font-semibold text-slate-800 text-sm">Amendment Chain (Original → Amendments)</h3></div>
        {amendments.length === 0 ? <EmptyState icon={GitBranch} title="No amendments yet" sub="Create an amendment from any PO to adjust quantity, price, or add items." /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs text-slate-500 uppercase"><tr>
                <th className="text-left px-4 py-3 font-medium">Amendment #</th>
                <th className="text-left px-4 py-3 font-medium">Original PO</th>
                <th className="text-left px-4 py-3 font-medium">Type</th>
                <th className="text-left px-4 py-3 font-medium">Reason</th>
                {(isSuperAdmin || isFinance || isCentreHead) && <th className="text-left px-4 py-3 font-medium">Institute</th>}
                <th className="text-right px-4 py-3 font-medium">Value</th>
                <th className="text-left px-4 py-3 font-medium">Status</th>
                <th className="text-left px-4 py-3 font-medium">Created</th>
              </tr></thead>
              <tbody className="divide-y divide-slate-100">
                {amendments.map((a) => (
                  <tr key={a.id} className="hover:bg-slate-50 cursor-pointer" onClick={() => navigate(`/po/${a.id}`)}>
                    <td className="px-4 py-3 font-medium text-slate-800">{a.po_number}</td>
                    <td className="px-4 py-3 text-slate-600">{a.parent_po_number || "-"}</td>
                    <td className="px-4 py-3 text-slate-600">{AMENDMENT_LABELS[a.amendment_type] || "-"}</td>
                    <td className="px-4 py-3 text-slate-500 text-xs max-w-xs truncate">{a.amendment_reason}</td>
                    {(isSuperAdmin || isFinance || isCentreHead) && <td className="px-4 py-3 text-slate-600">{a.institute_name}</td>}
                    <td className="px-4 py-3 text-right font-medium">{formatINR(a.grand_total)}</td>
                    <td className="px-4 py-3"><StatusBadge status={a.status} /></td>
                    <td className="px-4 py-3 text-slate-600">{formatDate(a.created_date)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}