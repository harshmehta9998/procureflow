import React, { useEffect, useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useUserRole } from "@/lib/RoleContext";
import { StatCard, EmptyState } from "@/components/po/Shared";
import { formatINR, formatDate, todayISO, logAudit } from "@/lib/poUtils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RefreshCw, CheckCircle, X } from "lucide-react";
import { toast } from "sonner";

const SETTLE_LABELS = { refund: "Vendor Refund", credit_adjustment: "Vendor Credit / Adjustment", write_off: "Write-off" };
const SETTLE_COLORS = { refund: "bg-blue-100 text-blue-700", credit_adjustment: "bg-purple-100 text-purple-700", write_off: "bg-rose-100 text-rose-700" };

export default function RefundsCredits() {
  const { isSuperAdmin, isFinance, userName } = useUserRole();
  const [credits, setCredits] = useState([]);
  const [pos, setPos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showSettle, setShowSettle] = useState(null); // credit record being settled

  const fetchData = async () => {
    try {
      const [list, allPos] = await Promise.all([
        base44.entities.VendorCredit.list("-created_date", 500),
        base44.entities.PurchaseOrder.list("-created_date", 500),
      ]);
      setCredits(list.filter((c) => !c.deleted));
      setPos(allPos.filter((p) => !p.deleted));
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, []);

  const totalRefund = credits.filter((c) => c.settlement_type === "refund").reduce((s, c) => s + (c.amount || 0), 0);
  const totalCredit = credits.filter((c) => c.settlement_type === "credit_adjustment").reduce((s, c) => s + (c.amount || 0), 0);
  const totalWriteOff = credits.filter((c) => c.settlement_type === "write_off").reduce((s, c) => s + (c.amount || 0), 0);
  const pending = credits.filter((c) => c.status === "pending");

  const completeRefund = async (c) => {
    await base44.entities.VendorCredit.update(c.id, { status: "completed", refund_received: c.amount });
    await logAudit("VendorCredit", c.id, c.from_po_number, userName, "Refund Received", "", formatINR(c.amount), "");
    toast.success("Refund marked received");
    fetchData();
  };

  const applyCredit = async (c, targetPoId) => {
    const target = pos.find((p) => p.id === targetPoId);
    if (!target) return toast.error("Select target PO");
    const newOutstanding = Math.max(0, (target.outstanding_amount || 0) - (c.amount || 0));
    await base44.entities.PurchaseOrder.update(targetPoId, { outstanding_amount: newOutstanding });
    await base44.entities.VendorCredit.update(c.id, { status: "completed", credit_adjusted_to_po_id: targetPoId, credit_adjusted_to_po_number: target.po_number, credit_adjusted_amount: c.amount });
    await logAudit("VendorCredit", c.id, c.from_po_number, userName, "Credit Adjusted", "", formatINR(c.amount), `Against ${target.po_number}`);
    toast.success("Credit adjusted against " + target.po_number);
    setShowSettle(null);
    fetchData();
  };

  const confirmWriteOff = async (c) => {
    await base44.entities.VendorCredit.update(c.id, { status: "completed" });
    await logAudit("VendorCredit", c.id, c.from_po_number, userName, "Write-off Confirmed", "", formatINR(c.amount), c.write_off_reason);
    toast.success("Write-off recorded");
    fetchData();
  };

  if (loading) return <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Refunds & Credits</h1>
        <p className="text-sm text-slate-500 mt-0.5">Vendor refunds, credit adjustments and write-offs from cancelled POs</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Refunds" value={formatINR(totalRefund)} icon={RefreshCw} accent="blue" />
        <StatCard label="Credits" value={formatINR(totalCredit)} icon={RefreshCw} accent="purple" />
        <StatCard label="Write-offs" value={formatINR(totalWriteOff)} icon={X} accent="red" />
        <StatCard label="Pending" value={pending.length} icon={RefreshCw} accent="amber" />
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-200"><h3 className="font-semibold text-slate-800 text-sm">Settlement Records</h3></div>
        {credits.length === 0 ? <EmptyState icon={RefreshCw} title="No refund or credit records" sub="These are created when cancelling a partially-paid PO." /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs text-slate-500 uppercase"><tr>
                <th className="text-left px-4 py-3 font-medium">From PO</th>
                <th className="text-left px-4 py-3 font-medium">Vendor</th>
                <th className="text-left px-4 py-3 font-medium">Institute</th>
                <th className="text-left px-4 py-3 font-medium">Type</th>
                <th className="text-right px-4 py-3 font-medium">Amount</th>
                <th className="text-left px-4 py-3 font-medium">Status</th>
                <th className="text-right px-4 py-3 font-medium">Action</th>
              </tr></thead>
              <tbody className="divide-y divide-slate-100">
                {credits.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-800">{c.from_po_number}</td>
                    <td className="px-4 py-3 text-slate-600">{c.vendor_name}</td>
                    <td className="px-4 py-3 text-slate-600">{c.institute_name}</td>
                    <td className="px-4 py-3"><span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${SETTLE_COLORS[c.settlement_type]}`}>{SETTLE_LABELS[c.settlement_type]}</span></td>
                    <td className="px-4 py-3 text-right font-medium">{formatINR(c.amount)}</td>
                    <td className="px-4 py-3"><span className={`text-xs ${c.status === "completed" ? "text-emerald-600" : "text-amber-600"}`}>{c.status}</span></td>
                    <td className="px-4 py-3 text-right">
                      {c.status === "pending" && (isSuperAdmin || isFinance) && (
                        <>
                          {c.settlement_type === "refund" && <Button size="sm" className="h-7 bg-emerald-600" onClick={() => completeRefund(c)}>Mark Refund Received</Button>}
                          {c.settlement_type === "credit_adjustment" && <Button size="sm" className="h-7 bg-purple-600" onClick={() => setShowSettle(c)}>Apply Credit</Button>}
                          {c.settlement_type === "write_off" && <Button size="sm" className="h-7 bg-rose-600" onClick={() => confirmWriteOff(c)}>Confirm Write-off</Button>}
                        </>
                      )}
                      {c.status === "completed" && c.credit_adjusted_to_po_number && <span className="text-xs text-slate-500">→ {c.credit_adjusted_to_po_number}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showSettle && <ApplyCreditModal credit={showSettle} pos={pos} onClose={() => setShowSettle(null)} onApply={applyCredit} />}
    </div>
  );
}

function ApplyCreditModal({ credit, pos, onClose, onApply }) {
  const [targetPoId, setTargetPoId] = useState("");
  const vendorPos = pos.filter((p) => p.vendor_id === credit.vendor_id && ["payment_pending", "partially_paid"].includes(p.status) && p.id !== credit.from_po_id);
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl w-full max-w-md p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3"><h3 className="font-semibold text-slate-800">Apply Credit Against PO</h3><Button variant="ghost" size="sm" onClick={onClose}><X className="w-4 h-4" /></Button></div>
        <div className="text-sm text-slate-600 mb-3">Credit of <b>{formatINR(credit.amount)}</b> from {credit.from_po_number} to adjust against another PO for the same vendor.</div>
        <Label className="text-xs">Target PO (same vendor: {credit.vendor_name})</Label>
        <Select value={targetPoId} onValueChange={setTargetPoId}><SelectTrigger className="h-9 mt-1"><SelectValue placeholder="Select PO" /></SelectTrigger><SelectContent>{vendorPos.map((p) => <SelectItem key={p.id} value={p.id}>{p.po_number} · Outstanding {formatINR(p.outstanding_amount)}</SelectItem>)}</SelectContent></Select>
        <Button className="w-full bg-purple-600 mt-4" disabled={!targetPoId} onClick={() => onApply(credit, targetPoId)}>Apply Credit</Button>
      </div>
    </div>
  );
}