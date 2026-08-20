import React, { useState } from "react";
import { Outlet, Link, useLocation, useNavigate } from "react-router-dom";
import { useUserRole } from "@/lib/RoleContext";
import { ROLE_LABELS } from "@/lib/roles";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard, FileText, PlusCircle, Users as UsersIcon, Wallet, BarChart3,
  Building2, ClipboardList, LogOut, Search, Menu, X, ChevronDown,
  GitBranch, PackageCheck, Zap, CalendarClock, History, RefreshCw,
  ShieldCheck, UserCog, Receipt, Layers, UserCircle, Eye
} from "lucide-react";

const NAV_GROUPS = [
  {
    label: "Procurement",
    items: [
      { label: "Dashboard", path: "/", icon: LayoutDashboard, roles: ["institutional_admin", "department_admin", "department_head", "centre_head", "approval_admin", "finance_controller", "super_admin", "system_administrator"] },
      { label: "Purchase Orders", path: "/purchase-orders", icon: FileText, roles: ["institutional_admin", "department_admin", "department_head", "centre_head", "approval_admin", "finance_controller", "super_admin", "system_administrator"] },
      { label: "PO Amendments", path: "/po-amendments", icon: GitBranch, roles: ["institutional_admin", "approval_admin", "centre_head", "finance_controller", "super_admin", "system_administrator"] },
      { label: "Delivery & Quantity Verification", path: "/delivery-verification", icon: PackageCheck, roles: ["institutional_admin", "approval_admin", "centre_head", "super_admin", "system_administrator"] },
    ],
  },
  {
    label: "Payments",
    items: [
      { label: "Payment Initiatives", path: "/payment-initiatives", icon: Zap, roles: ["institutional_admin", "approval_admin", "centre_head", "finance_controller", "super_admin", "system_administrator"] },
      { label: "Request for Payment", path: "/payment-requests", icon: Receipt, roles: ["institutional_admin", "approval_admin", "centre_head", "finance_controller", "super_admin", "system_administrator"] },
      { label: "Recurring Payments", path: "/recurring-payments", icon: CalendarClock, roles: ["finance_controller", "super_admin", "system_administrator"] },
      { label: "Payment History", path: "/payment-history", icon: History, roles: ["centre_head", "finance_controller", "super_admin", "system_administrator"] },
    ],
  },
  {
    label: "Finance",
    items: [
      { label: "Finance Dashboard", path: "/finance", icon: Wallet, roles: ["centre_head", "finance_controller", "super_admin", "system_administrator"] },
      { label: "Institution-wise Finance", path: "/institutions", icon: Building2, roles: ["centre_head", "finance_controller", "super_admin", "system_administrator"] },
      { label: "Vendor-wise Finance", path: "/vendors", icon: UsersIcon, roles: ["centre_head", "finance_controller", "super_admin", "system_administrator"] },
      { label: "Refunds & Credits", path: "/refunds-credits", icon: RefreshCw, roles: ["finance_controller", "super_admin", "system_administrator"] },
    ],
  },
  {
    label: "Approvals",
    items: [
      { label: "My Approvals", path: "/approvals", icon: ShieldCheck, roles: ["institutional_admin", "department_head", "centre_head", "approval_admin", "finance_controller", "super_admin", "system_administrator"] },
      { label: "Centre Head Approvals", path: "/approvals?stage=centre_head", icon: ShieldCheck, roles: ["centre_head", "super_admin", "system_administrator"] },
      { label: "Super Admin Approvals", path: "/approvals?stage=super_admin", icon: ShieldCheck, roles: ["super_admin", "system_administrator"] },
    ],
  },
  {
    label: "Management",
    items: [
      { label: "Institutions", path: "/institutes", icon: Building2, roles: ["super_admin", "system_administrator", "centre_head"] },
      { label: "Centre Heads", path: "/centre-heads", icon: UserCog, roles: ["super_admin", "system_administrator"] },
      { label: "Vendors", path: "/vendors", icon: UsersIcon, roles: ["institutional_admin", "approval_admin", "centre_head", "finance_controller", "super_admin", "system_administrator"] },
      { label: "Users", path: "/user-management", icon: UsersIcon, roles: ["super_admin", "system_administrator"] },
    ],
  },
  {
    label: "Reports",
    items: [
      { label: "Reports", path: "/reports", icon: BarChart3, roles: ["institutional_admin", "approval_admin", "centre_head", "finance_controller", "super_admin", "system_administrator"] },
      { label: "Audit Trail", path: "/audit-log", icon: ClipboardList, roles: ["super_admin", "system_administrator"] },
    ],
  },
];

const matchesPath = (pathname, itemPath) => {
  const clean = itemPath.split("?")[0];
  if (clean === "/") return pathname === "/";
  return pathname === clean || pathname.startsWith(clean + "/") || pathname.startsWith(clean);
};

export default function Layout() {
  const {
    role, roleKey, userName, isSuperAdmin, isFinance, isInstituteAdmin, isCentreHead,
    instituteName, showInstitutionSelector, accessibleInstitutes, activeInstitute,
    setActiveInstitute, previewRole, setPreviewRole, realIsSuperAdmin,
  } = useUserRole();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [instOpen, setInstOpen] = useState(false);
  const [roleOpen, setRoleOpen] = useState(false);

  const PREVIEW_ROLES = [
    { value: null, label: "Super Admin (actual)" },
    { value: "institutional_admin", label: "Institutional Admin" },
    { value: "approval_admin", label: "Admin" },
    { value: "centre_head", label: "Centre Head" },
    { value: "finance_controller", label: "Finance Controller" },
    { value: "department_admin", label: "Department Admin" },
    { value: "department_head", label: "Department Head" },
    { value: "system_administrator", label: "System Administrator" },
  ];
  const previewLabel = PREVIEW_ROLES.find((r) => r.value === previewRole)?.label || "Super Admin (actual)";

  const visibleGroups = NAV_GROUPS.map((g) => ({
    ...g,
    items: g.items.filter((i) => i.roles.includes(roleKey)),
  })).filter((g) => g.items.length > 0);

  const handleLogout = async () => {
    await base44.auth.logout(window.location.origin);
  };

  const roleBadge = ROLE_LABELS[roleKey] || (isSuperAdmin ? "Super Admin" : isCentreHead ? "Centre Head" : isFinance ? "Finance" : "Institute Admin");
  const activeInstName = activeInstitute === "all"
    ? "All Institutions"
    : (accessibleInstitutes.find((i) => i.id === activeInstitute)?.institute_name || "All Institutions");

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
          <Link to="/profile" className="block px-3 py-2 mb-2 rounded-lg hover:bg-slate-100 transition-colors">
            <div className="text-xs font-medium text-slate-700 truncate flex items-center gap-1.5">
              <UserCircle className="w-3.5 h-3.5 text-slate-400" /> {userName}
            </div>
            <div className="text-[10px] text-slate-400">{roleBadge}{instituteName ? ` · ${instituteName}` : (activeInstitute === "all" ? " · All Institutions" : "")}</div>
          </Link>
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
            {realIsSuperAdmin && (
              <div className="relative">
                <button
                  onClick={() => setRoleOpen(!roleOpen)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-amber-300 bg-amber-50 text-sm font-medium text-amber-700 hover:bg-amber-100"
                  title="Preview the app as another role. Backend permissions stay as your real account."
                >
                  <Eye className="w-3.5 h-3.5" />
                  Test as: {previewLabel}
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>
                {roleOpen && (
                  <div className="absolute right-0 mt-1 w-56 bg-white border border-slate-200 rounded-lg shadow-lg z-50 py-1">
                    <div className="px-3 py-1.5 text-[10px] uppercase tracking-wide text-amber-600 font-semibold">Test as Role (Preview)</div>
                    {PREVIEW_ROLES.map((r) => (
                      <button
                        key={String(r.value)}
                        onClick={() => { setPreviewRole(r.value); setRoleOpen(false); navigate("/"); }}
                        className={`w-full text-left px-3 py-2 text-sm hover:bg-slate-50 ${previewRole === r.value ? "text-slate-900 font-semibold bg-slate-50" : "text-slate-600"}`}
                      >
                        {r.label}
                      </button>
                    ))}
                    <div className="border-t border-slate-100 my-1" />
                    <div className="px-3 py-1.5 text-[10px] text-slate-400">Permissions stay as your real Super Admin account — use this to walk the UI flow, not to test access limits.</div>
                  </div>
                )}
              </div>
            )}
            {showInstitutionSelector && (
              <div className="relative">
                <button
                  onClick={() => setInstOpen(!instOpen)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-sm font-medium text-slate-600 hover:bg-slate-50"
                >
                  <Building2 className="w-3.5 h-3.5" />
                  {activeInstName}
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>
                {instOpen && (
                  <div className="absolute right-0 mt-1 w-60 bg-white border border-slate-200 rounded-lg shadow-lg z-50 py-1">
                    <div className="px-3 py-1.5 text-[10px] uppercase tracking-wide text-slate-400 font-semibold">Active Institution</div>
                    <button
                      onClick={() => { setActiveInstitute("all"); setInstOpen(false); }}
                      className={`w-full text-left px-3 py-2 text-sm hover:bg-slate-50 flex items-center gap-2 ${activeInstitute === "all" ? "text-slate-900 font-semibold bg-slate-50" : "text-slate-600"}`}
                    >
                      <Layers className="w-3.5 h-3.5 text-slate-400" />
                      All Institutions
                    </button>
                    <div className="border-t border-slate-100 my-1" />
                    {accessibleInstitutes.map((inst) => (
                      <button
                        key={inst.id}
                        onClick={() => { setActiveInstitute(inst.id); setInstOpen(false); }}
                        className={`w-full text-left px-3 py-2 text-sm hover:bg-slate-50 flex items-center gap-2 ${activeInstitute === inst.id ? "text-slate-900 font-semibold bg-slate-50" : "text-slate-600"}`}
                      >
                        <Building2 className="w-3.5 h-3.5 text-slate-400" />
                        {inst.institute_name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </header>
        <main className="flex-1 p-4 lg:p-6 overflow-x-hidden">
          <Outlet />
        </main>
      </div>
    </div>
  );
}