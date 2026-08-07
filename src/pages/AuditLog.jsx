import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { formatDate } from "@/lib/poUtils";
import { ClipboardList, Search } from "lucide-react";

export default function AuditLog() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const l = await base44.entities.AuditLog.list("-created_date", 500);
        setLogs(l);
      } finally { setLoading(false); }
    })();
  }, []);

  if (loading) return <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" /></div>;

  const filtered = logs.filter((l) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return [l.po_number, l.user_name, l.action, l.remarks].some((x) => (x || "").toLowerCase().includes(q));
  });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Audit Trail</h1>
        <p className="text-sm text-slate-500 mt-0.5">Complete activity log · {logs.length} entries</p>
      </div>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input type="text" placeholder="Search by PO number, user, action..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full pl-9 pr-3 py-2.5 text-sm rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-slate-200" />
      </div>
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center py-16 text-slate-400"><ClipboardList className="w-12 h-12 mb-2" />No audit entries</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs text-slate-500 uppercase">
                <tr>
                  <th className="text-left px-5 py-2.5 font-medium">Date</th>
                  <th className="text-left px-5 py-2.5 font-medium">User</th>
                  <th className="text-left px-5 py-2.5 font-medium">PO Number</th>
                  <th className="text-left px-5 py-2.5 font-medium">Action</th>
                  <th className="text-left px-5 py-2.5 font-medium">Change</th>
                  <th className="text-left px-5 py-2.5 font-medium">Remarks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((l) => (
                  <tr key={l.id} className="hover:bg-slate-50">
                    <td className="px-5 py-3 text-slate-500 whitespace-nowrap">{formatDate(l.created_date)}</td>
                    <td className="px-5 py-3 font-medium text-slate-700">{l.user_name}</td>
                    <td className="px-5 py-3 text-slate-600">{l.po_number || "-"}</td>
                    <td className="px-5 py-3"><span className="px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700">{l.action}</span></td>
                    <td className="px-5 py-3 text-slate-500 text-xs">{l.old_value && l.new_value ? `${l.old_value} → ${l.new_value}` : l.new_value || "-"}</td>
                    <td className="px-5 py-3 text-slate-400 text-xs">{l.remarks || "-"}</td>
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