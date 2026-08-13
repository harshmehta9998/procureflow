import React, { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useUserRole } from "@/lib/RoleContext";
import { StatCard, EmptyState, StatusBadge, PaymentBadge } from "@/components/po/Shared";
import { formatINR, formatDate, daysOverdue, todayISO } from "@/lib/poUtils";
import { getMilestoneStatus, MILESTONE_STATUS_LABELS, MILESTONE_BADGES } from "@/lib/paymentScheduleUtils";
import PaymentCalendar from "@/components/payment-schedule/PaymentCalendar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Wallet, AlertTriangle, Clock, CheckCircle, TrendingDown, Calendar, Filter, IndianRupee, Bell } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

export default function Finance() {
  const navigate = useNavigate();
  const { scopeInstituteIds, activeInstitute, isSuperAdmin, isFinance } = useUserRole();
  const [milestones, setMilestones] = useState([]);
  const [pos, setPos] = useState([]);
  const [payments, setPayments] = useState([]);
  const [institutes, setInstitutes] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [filters, setFilters] = useState({ institute: "all", vendor: "all", poNumber: "", category: "all", milestoneStatus: "all", paymentStatus: "all", dateFrom: "", dateTo: "" });
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [allMs, allPOs, allPays, allInsts, allVens] = await Promise.all([
          base44.entities.PaymentMilestone.list("-created_date", 1000),
          base44.entities.PurchaseOrder.list("-created_date", 500),
          base44.entities.Payment.list("-payment_date", 500),
          base44.entities.Institute.list(),
          base44.entities.Vendor.list(),
        ]);
        setMilestones(allMs.filter((m) => !m.deleted));
        setPos(allPOs.filter((p) => !p.deleted));
        setPayments(allPays);
        setInstitutes(allInsts);
        setVendors(allVens);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
  const dayAfter = new Date(today); dayAfter.setDate(today.getDate() + 2);
  const weekEnd = new Date(today); weekEnd.setDate(today.getDate() + 7);
  const monthEnd = new Date(today); monthEnd.setDate(today.getDate() + 30);

  const poMap = useMemo(() => {
    const map = {};
    pos.forEach((p) => { map[p.id] = p; });
    return map;
  }, [pos]);

  // Enrich milestones with PO context and dynamic status
  const enrichedMilestones = useMemo(() => {
    return milestones.map((m) => {
      const po = poMap[m.po_id] || {};
      return { ...m, po, status: getMilestoneStatus(m, po, todayISO()) };
    });
  }, [milestones, poMap]);

  // Apply filters
  const filteredMilestones = useMemo(() => {
    return enrichedMilestones.filter((m) => {
      if (m.status === "cancelled") return false;
      const po = m.po;
      if (!po) return false;
      if (scopeInstituteIds !== null && !scopeInstituteIds.includes(po.institute_id)) return false;
      if (filters.institute !== "all" && po.institute_id !== filters.institute) return false;
      if (filters.vendor !== "all" && po.vendor_id !== filters.vendor) return false;
      if (filters.poNumber && !po.po_number?.toLowerCase().includes(filters.poNumber.toLowerCase())) return false;
      if (filters.category !== "all" && po.po_category !== filters.category) return false;
      if (filters.milestoneStatus !== "all" && m.status !== filters.milestoneStatus) return false;
      if (filters.paymentStatus !== "all") {
        if (filters.paymentStatus === "paid" && m.status !== "paid") return false;
        if (filters.paymentStatus === "partial" && m.status !== "partially_paid") return false;
        if (filters.paymentStatus === "unpaid" && ["paid", "partially_paid"].includes(m.status)) return false;
      }
      if (filters.dateFrom && m.due_date && m.due_date < filters.dateFrom) return false;
      if (filters.dateTo && m.due_date && m.due_date > filters.dateTo) return false;
      return true;
    });
  }, [enrichedMilestones, filters, scopeInstituteIds, isSuperAdmin]);

  // Categorize milestones
  const dueToday = filteredMilestones.filter((m) => m.due_date && new Date(m.due_date) <= today && (m.outstanding_amount || 0) > 0);
  const dueTomorrow = filteredMilestones.filter((m) => m.due_date && new Date(m.due_date) <= tomorrow && new Date(m.due_date) > today && (m.outstanding_amount || 0) > 0);
  const dueWeek = filteredMilestones.filter((m) => m.due_date && new Date(m.due_date) > tomorrow && new Date(m.due_date) <= weekEnd && (m.outstanding_amount || 0) > 0);
  const dueMonth = filteredMilestones.filter((m) => m.due_date && new Date(m.due_date) > weekEnd && new Date(m.due_date) <= monthEnd && (m.outstanding_amount || 0) > 0);
  const overdue = filteredMilestones.filter((m) => m.status === "overdue");
  const upcoming = filteredMilestones.filter((m) => ["upcoming", "due_today"].includes(m.status));
  const partial = filteredMilestones.filter((m) => m.status === "partially_paid");

  const totalLiability = filteredMilestones.reduce((s, m) => s + (m.outstanding_amount || 0), 0);
  const totalReleased = filteredMilestones.reduce((s, m) => s + (m.amount_paid || 0), 0);
  const overdueAmount = overdue.reduce((s, m) => s + (m.outstanding_amount || 0), 0);

  // Reminders
  const dueIn2Days = filteredMilestones.filter((m) => {
    if (!m.due_date || (m.outstanding_amount || 0) <= 0) return false;
    const d = new Date(m.due_date); d.setHours(0, 0, 0, 0);
    const diff = Math.floor((d - today) / (1000 * 60 * 60 * 24));
    return diff >= 0 && diff <= 2;
  });
  const dueIn7Days = filteredMilestones.filter((m) => {
    if (!m.due_date || (m.outstanding_amount || 0) <= 0) return false;
    const d = new Date(m.due_date); d.setHours(0, 0, 0, 0);
    const diff = Math.floor((d - today) / (1000 * 60 * 60 * 24));
    return diff >= 3 && diff <= 7;
  });

  // Monthly payment chart
  const monthlyPayments = {};
  payments.forEach((p) => {
    if (scopeInstituteIds !== null && !scopeInstituteIds.includes(p.institute_id)) return;
    const m = p.payment_date ? new Date(p.payment_date).toLocaleDateString("en-IN", { month: "short" }) : "Unknown";
    monthlyPayments[m] = (monthlyPayments[m] || 0) + (p.amount_paid || 0);
  });
  const paymentChart = Object.entries(monthlyPayments).map(([month, amount]) => ({ month, amount }));

  if (loading) return <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Finance Dashboard</h1>
          <p className="text-sm text-slate-500 mt-0.5">Track payment milestones, dues, and liabilities</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setShowFilters(!showFilters)}><Filter className="w-4 h-4 mr-1.5" /> Filters</Button>
      </div>

      {/* Reminder Engine */}
      {(overdue.length > 0 || dueIn2Days.length > 0) && (
        <div className="bg-gradient-to-r from-amber-50 to-red-50 border border-amber-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Bell className="w-4 h-4 text-amber-600" />
            <h3 className="font-semibold text-slate-800 text-sm">Payment Reminders</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <ReminderCard label="Overdue" count={overdue.length} amount={overdueAmount} color="red" milestones={overdue.slice(0, 3)} onNavigate={navigate} />
            <ReminderCard label="Due in 2 days" count={dueIn2Days.length} amount={dueIn2Days.reduce((s, m) => s + (m.outstanding_amount || 0), 0)} color="amber" milestones={dueIn2Days.slice(0, 3)} onNavigate={navigate} />
            <ReminderCard label="Due in 7 days" count={dueIn7Days.length} amount={dueIn7Days.reduce((s, m) => s + (m.outstanding_amount || 0), 0)} color="blue" milestones={dueIn7Days.slice(0, 3)} onNavigate={navigate} />
          </div>
        </div>
      )}

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
        <StatCard label="Due Today" value={dueToday.length} sub={formatINR(dueToday.reduce((s, m) => s + (m.outstanding_amount || 0), 0))} icon={Clock} accent="amber" />
        <StatCard label="Due This Week" value={dueWeek.length} sub={formatINR(dueWeek.reduce((s, m) => s + (m.outstanding_amount || 0), 0))} icon={Clock} accent="blue" />
        <StatCard label="Due This Month" value={dueMonth.length} sub={formatINR(dueMonth.reduce((s, m) => s + (m.outstanding_amount || 0), 0))} icon={Clock} accent="purple" />
        <StatCard label="Overdue" value={overdue.length} sub={formatINR(overdueAmount)} icon={AlertTriangle} accent="red" />
        <StatCard label="Outstanding" value={formatINR(totalLiability)} icon={TrendingDown} accent="amber" />
        <StatCard label="Released" value={formatINR(totalReleased)} icon={CheckCircle} accent="emerald" />
      </div>

      {/* Secondary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Due Tomorrow" value={dueTomorrow.length} sub={formatINR(dueTomorrow.reduce((s, m) => s + (m.outstanding_amount || 0), 0))} icon={Clock} accent="slate" />
        <StatCard label="Upcoming" value={upcoming.length} sub={formatINR(upcoming.reduce((s, m) => s + (m.outstanding_amount || 0), 0))} icon={Calendar} accent="blue" />
        <StatCard label="Partial Payments" value={partial.length} sub={formatINR(partial.reduce((s, m) => s + (m.outstanding_amount || 0), 0))} icon={Wallet} accent="indigo" />
        <StatCard label="Paid Milestones" value={filteredMilestones.filter((m) => m.status === "paid").length} sub={formatINR(filteredMilestones.filter((m) => m.status === "paid").reduce((s, m) => s + (m.amount_paid || 0), 0))} icon={CheckCircle} accent="emerald" />
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="bg-white border border-slate-200 rounded-xl p-4 grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <Label className="text-xs">Institute</Label>
            <Select value={filters.institute} onValueChange={(v) => setFilters({ ...filters, institute: v })}>
              <SelectTrigger className="h-9 mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Institutes</SelectItem>
                {institutes.map((i) => <SelectItem key={i.id} value={i.id}>{i.institute_name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Vendor</Label>
            <Select value={filters.vendor} onValueChange={(v) => setFilters({ ...filters, vendor: v })}>
              <SelectTrigger className="h-9 mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Vendors</SelectItem>
                {vendors.map((v) => <SelectItem key={v.id} value={v.id}>{v.vendor_name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">PO Number</Label>
            <Input value={filters.poNumber} onChange={(e) => setFilters({ ...filters, poNumber: e.target.value })} placeholder="Search PO number" className="h-9 mt-1" />
          </div>
          <div>
            <Label className="text-xs">Category</Label>
            <Select value={filters.category} onValueChange={(v) => setFilters({ ...filters, category: v })}>
              <SelectTrigger className="h-9 mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="capex">Capex</SelectItem>
                <SelectItem value="opex">Opex</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Milestone Status</Label>
            <Select value={filters.milestoneStatus} onValueChange={(v) => setFilters({ ...filters, milestoneStatus: v })}>
              <SelectTrigger className="h-9 mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                {Object.entries(MILESTONE_STATUS_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Payment Status</Label>
            <Select value={filters.paymentStatus} onValueChange={(v) => setFilters({ ...filters, paymentStatus: v })}>
              <SelectTrigger className="h-9 mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
                <SelectItem value="partial">Partially Paid</SelectItem>
                <SelectItem value="unpaid">Unpaid</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Due Date From</Label>
            <Input type="date" value={filters.dateFrom} onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })} className="h-9 mt-1" />
          </div>
          <div>
            <Label className="text-xs">Due Date To</Label>
            <Input type="date" value={filters.dateTo} onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })} className="h-9 mt-1" />
          </div>
          <div className="md:col-span-4">
            <Button size="sm" variant="ghost" onClick={() => setFilters({ institute: "all", vendor: "all", poNumber: "", category: "all", milestoneStatus: "all", paymentStatus: "all", dateFrom: "", dateTo: "" })}>Clear All Filters</Button>
          </div>
        </div>
      )}

      {/* Finance Calendar + Monthly Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Calendar className="w-4 h-4 text-indigo-500" />
            <h3 className="font-semibold text-slate-800 text-sm">Finance Calendar</h3>
          </div>
          <PaymentCalendar milestones={filteredMilestones} pos={pos} onMilestoneClick={(m) => navigate(`/po/${m.po_id}`)} />
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="font-semibold text-slate-800 mb-4 text-sm">Monthly Payments Released</h3>
          {paymentChart.length === 0 ? <div className="h-64 flex items-center justify-center text-slate-400 text-sm">No data</div> : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={paymentChart}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="month" tick={{ fontSize: 12, fill: "#64748b" }} />
                <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} tickFormatter={(v) => "₹" + (v >= 100000 ? (v / 100000).toFixed(0) + "L" : v)} />
                <Tooltip formatter={(v) => formatINR(v)} contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12 }} />
                <Bar dataKey="amount" fill="#059669" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Overdue Milestones */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-red-500" />
          <h3 className="font-semibold text-slate-800 text-sm">Overdue Milestones ({overdue.length})</h3>
        </div>
        {overdue.length === 0 ? <EmptyState title="No overdue milestones" sub="All payments are on track" /> : (
          <MilestoneTable milestones={overdue} navigate={navigate} />
        )}
      </div>

      {/* Partially Paid Milestones */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 flex items-center gap-2">
          <Wallet className="w-4 h-4 text-indigo-500" />
          <h3 className="font-semibold text-slate-800 text-sm">Partially Paid Milestones ({partial.length})</h3>
        </div>
        {partial.length === 0 ? <EmptyState title="No partially paid milestones" /> : (
          <MilestoneTable milestones={partial} navigate={navigate} />
        )}
      </div>
    </div>
  );
}

function ReminderCard({ label, count, amount, color, milestones, onNavigate }) {
  const colors = {
    red: "bg-red-50 border-red-200 text-red-700",
    amber: "bg-amber-50 border-amber-200 text-amber-700",
    blue: "bg-blue-50 border-blue-200 text-blue-700",
  };
  return (
    <div className={`border rounded-lg p-3 ${colors[color]}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium uppercase tracking-wide">{label}</span>
        <span className="text-lg font-bold">{count}</span>
      </div>
      <div className="text-sm font-semibold mb-2">{formatINR(amount)}</div>
      {milestones.length > 0 && (
        <div className="space-y-1 border-t border-current/10 pt-2">
          {milestones.map((m) => (
            <div key={m.id} className="text-xs flex justify-between cursor-pointer hover:underline" onClick={() => onNavigate(`/po/${m.po_id}`)}>
              <span className="truncate">{m.po_number}</span>
              <span className="flex-shrink-0 ml-2">{formatINR(m.outstanding_amount || 0)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function MilestoneTable({ milestones, navigate }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-xs text-slate-500 uppercase">
          <tr>
            <th className="text-left px-5 py-2.5 font-medium">PO Number</th>
            <th className="text-left px-5 py-2.5 font-medium">Milestone</th>
            <th className="text-left px-5 py-2.5 font-medium">Vendor</th>
            <th className="text-left px-5 py-2.5 font-medium">Institute</th>
            <th className="text-left px-5 py-2.5 font-medium">Due Date</th>
            <th className="text-right px-5 py-2.5 font-medium">Amount</th>
            <th className="text-right px-5 py-2.5 font-medium">Paid</th>
            <th className="text-right px-5 py-2.5 font-medium">Outstanding</th>
            <th className="text-left px-5 py-2.5 font-medium">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {milestones.map((m) => {
            const badge = MILESTONE_BADGES[m.status];
            return (
              <tr key={m.id} className="hover:bg-slate-50 cursor-pointer" onClick={() => navigate(`/po/${m.po_id}`)}>
                <td className="px-5 py-3 font-medium text-slate-800">{m.po_number}</td>
                <td className="px-5 py-3 text-slate-600">{m.milestone_name}</td>
                <td className="px-5 py-3 text-slate-600">{m.vendor_name}</td>
                <td className="px-5 py-3 text-slate-600">{m.institute_name}</td>
                <td className="px-5 py-3 text-slate-600">{formatDate(m.due_date)}</td>
                <td className="px-5 py-3 text-right font-medium">{formatINR(m.calculated_amount || 0)}</td>
                <td className="px-5 py-3 text-right text-emerald-600">{formatINR(m.amount_paid || 0)}</td>
                <td className="px-5 py-3 text-right text-amber-600 font-medium">{formatINR(m.outstanding_amount || 0)}</td>
                <td className="px-5 py-3">
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${badge.color}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${badge.dot}`} />
                    {MILESTONE_STATUS_LABELS[m.status]}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}