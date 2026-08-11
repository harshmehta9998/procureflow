import React, { useState } from "react";
import { Outlet, Link, useLocation, useNavigate } from "react-router-dom";
import { useUserRole } from "@/lib/RoleContext";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard, FileText, PlusCircle, Users, Wallet, BarChart3,
  Building2, ClipboardList, LogOut, Search, Menu, X, ChevronDown,
  GitBranch, PackageCheck, Zap, CalendarClock, History, RefreshCw,
  ShieldCheck, UserCog, Receipt, Layers
} from "lucide-react";

const NAV_GROUPS = [
  {
    label: "Procurement",
    items: [
      { label: "Dashboard", path: "/", icon: LayoutDashboard, roles: ["admin", "centre_head", "super_admin", "finance"] },
      { label: "Purchase Orders", path: "/purchase-orders", icon: FileText, roles: ["admin", "centre_head", "super_admin", "finance"] },
      { label: "PO Amendments", path: "/po-amendments", icon: GitBranch, roles: ["admin", "centre_head", "super_admin", "finance"] },
      { label: "Delivery & Quantity Verification", path: "/delivery-verification", icon: PackageCheck, roles: ["admin", "centre_head", "super_admin"] },
    ],
  },
  {
    label: "Payments",
    items: [
      { label: "Payment Initiatives", path: "/payment-initiatives", icon: Zap, roles: ["admin", "centre_head", "super_admin", "finance"] },
      { label: "Request for Payment", path: "/payment-requests", icon: Receipt, roles: ["admin", "centre_head", "super_admin", "finance"] },
      { label: "Recurring Payments", path: "/recurring-payments", icon: CalendarClock, roles: ["super_admin", "finance"] },
      { label: "Payment History", path: "/payment-history", icon: History, roles: ["super_admin", "finance", "centre_head"] },
    ],
  },
  {
    label: "Finance",
    items: [
      { label: "Finance Dashboard", path: "/finance", icon: Wallet, roles: ["finance", "super_admin", "centre_head"] },
      { label: "Institution-wise Finance", path: "/institutions", icon: Building2, roles: ["super_admin", "finance", "centre_head"] },
      { label: "Vendor-wise Finance", path: "/vendors", icon: Users, roles: ["super_admin", "finance", "centre_head"] },
      { label: "Refunds & Credits", path: "/refunds-credits", icon: RefreshCw, roles: ["super_admin", "finance"] },
    ],
  },
  {
    label: "Approvals",
    items: [
      { label: "My Approvals", path: "/approvals", icon: ShieldCheck, roles: ["centre_head", "super_admin", "admin"] },
      { label: "Centre Head Approvals", path: "/approvals?stage=centre_head", icon: ShieldCheck, roles: ["centre_head", "super_admin"] },
      { label: "Super Admin Approvals", path: "/approvals?stage=super_admin", icon: ShieldCheck, roles: ["super_admin"] },
    ],
  },
  {
    label: "Management",
    items: [
      { label: "Institutions", path: "/institutes", icon: Building2, roles: ["super_admin", "centre_head"] },
      { label: "Centre Heads", path: "/centre-heads", icon: UserCog, roles: ["super_admin"] },
      { label: "Vendors", path: "/vendors", icon: Users, roles: ["admin", "super_admin", "finance", "centre_head"] },
      { label: "Users", path: "/user-management", icon: Users, roles: ["super_admin"] },
    ],
  },
  {
    label: "Reports",
    items: [
      { label: "Reports", path: "/reports", icon: BarChart3, roles: ["admin", "super_admin", "finance", "centre_head"] },
      { label: "Audit Trail", path: "/audit-log", icon: ClipboardList, roles: ["super_admin"] },
    ],
  },
];

const matchesPath = (pathname, itemPath) => {
  const clean = itemPath.split("?")[0];
  if (clean === "/") return pathname === "/";
  return pathname === clean || pathname.startsWith(clean + "/") || pathname.startsWith(clean);
};

export default function Layout() {
  const { role, userName, setDemoRole, isSuperAdmin, isFinance, isInstituteAdmin, isCentreHead, instituteName, instituteIds, instituteNames, hasMultipleInstitutes, activeInstituteId, setActiveInstituteId } = useUserRole();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [instOpen, setInstOpen] = useState(false);

  const visibleGroups = NAV_GROUPS.map((g) => ({
    ...g,
    items: g.items.filter((i) => i.roles.includes(role)),
  })).filter((g) => g.items.length > 0);

  const handleLogout = async () => {
    await base44.auth.logout("/login");
  };

  const roleBadge = isSuperAdmin ? "Super Admin" : isCentreHead ? "Centre Head" : isFinance ? "Finance" : "Institute Admin";

  return (
    <div className="min-h-screen bg-slate-50 flex">
      <aside className={`fixed lg:static inset-y-0 left-0 z-50 w-64 bg-white border-r border-slate-200 flex flex-col transition-transform duration-300 ${mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}>
        <div className="h-16 flex items-center gap-2 px-5 border-b border-slate-200">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-slate-800 to-slate-600 flex items-center justify-center text-white font-bold text-sm">PF</div>
          <div>
            <div className="font-semibold text-sm text-slate-800 leading-tight">ProcureFlow</div>
            <div className="text-[10px] text-slate-400 uppercase tracking-wide">PO & Finance</div>
          </div>
        </div>
        <nav className="flex-1 py-2 px-2.5 space-y-3 overflow-y-auto">
          {visibleGroups.map((group) => (
            <div key={group.label}>
              <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">{group.label}</div>
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const active = matchesPath(location.pathname, item.path);
                  return (
                    <Link
                      key={item.label}
                      to={item.path}
                      onClick={() => setMobileOpen(false)}
                      className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] font-medium transition-colors ${
                        active ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"
                      }`}
                    >
                      <Icon className="w-4 h-4 flex-shrink-0" />
                      <span className="truncate">{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
        <div className="p-3 border-t border-slate-200">
          <div className="px-3 py-2 mb-2">
            <div className="text-xs font-medium text-slate-700 truncate">{userName}</div>
            <div className="text-[10px] text-slate-400">{roleBadge}{instituteName ? ` · ${instituteName}` : ""}</div>
          </div>
          <Button variant="ghost" size="sm" className="w-full justify-start text-slate-500" onClick={handleLogout}>
            <LogOut className="w-4 h-4 mr-2" /> Logout
          </Button>
        </div>
      </aside>

      {mobileOpen && <div className="fixed inset-0 bg-black/30 z-40 lg:hidden" onClick={() => setMobileOpen(false)} />}

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 lg:px-6 gap-4">
          <div className="flex items-center gap-3 flex-1">
            <button className="lg:hidden p-2 -ml-2 text-slate-500" onClick={() => setMobileOpen(!mobileOpen)}>
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
            <div className="relative max-w-md w-full hidden sm:block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search PO number, vendor, institute..."
                className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-200"
                onKeyDown={(e) => { if (e.key === "Enter" && e.target.value.trim()) navigate(`/purchase-orders?q=${encodeURIComponent(e.target.value.trim())}`); }}
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            {hasMultipleInstitutes && (
              <div className="relative">
                <button
                  onClick={() => setInstOpen(!instOpen)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-sm font-medium text-slate-600 hover:bg-slate-50"
                >
                  <Building2 className="w-3.5 h-3.5" />
                  {instituteNames[instituteIds.indexOf(activeInstituteId)] || "Select Institute"}
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>
                {instOpen && (
                  <div className="absolute right-0 mt-1 w-56 bg-white border border-slate-200 rounded-lg shadow-lg z-50 py-1">
                    <div className="px-3 py-1.5 text-[10px] uppercase tracking-wide text-slate-400 font-semibold">Active Institute</div>
                    {instituteIds.map((id, i) => (
                      <button
                        key={id}
                        onClick={() => { setActiveInstituteId(id); setInstOpen(false); }}
                        className={`w-full text-left px-3 py-2 text-sm hover:bg-slate-50 flex items-center gap-2 ${activeInstituteId === id ? "text-slate-900 font-semibold" : "text-slate-600"}`}
                      >
                        <Building2 className="w-3.5 h-3.5 text-slate-400" />
                        {instituteNames[i] || id}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            <RoleSwitcher demoRole={role} setDemoRole={setDemoRole} />
          </div>
        </header>
        <main className="flex-1 p-4 lg:p-6 overflow-x-hidden">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

const RoleSwitcher = ({ demoRole, setDemoRole }) => {
  const [open, setOpen] = useState(false);
  const roles = [
    { value: "admin", label: "Institute Admin" },
    { value: "centre_head", label: "Centre Head" },
    { value: "finance", label: "Finance" },
    { value: "super_admin", label: "Super Admin" },
  ];
  const current = roles.find((r) => r.value === demoRole);
  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-sm font-medium text-slate-600 hover:bg-slate-50"
      >
        <div className="w-2 h-2 rounded-full bg-emerald-500" />
        {current?.label}
        <ChevronDown className="w-3.5 h-3.5" />
      </button>
      {open && (
        <div className="absolute right-0 mt-1 w-44 bg-white border border-slate-200 rounded-lg shadow-lg z-50 py-1">
          <div className="px-3 py-1.5 text-[10px] uppercase tracking-wide text-slate-400 font-semibold">Demo Role Switch</div>
          {roles.map((r) => (
            <button
              key={r.value}
              onClick={() => { setDemoRole(r.value); setOpen(false); }}
              className={`w-full text-left px-3 py-2 text-sm hover:bg-slate-50 ${demoRole === r.value ? "text-slate-900 font-semibold" : "text-slate-600"}`}
            >
              {r.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};