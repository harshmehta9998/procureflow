import React, { useState } from "react";
import { Outlet, Link, useLocation, useNavigate } from "react-router-dom";
import { useUserRole } from "@/lib/RoleContext";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard, FileText, PlusCircle, Users, Wallet, BarChart3,
  Building2, ClipboardList, LogOut, Search, Menu, X, ChevronDown
} from "lucide-react";

const navItems = [
  { label: "Dashboard", path: "/", icon: LayoutDashboard, roles: ["admin", "super_admin", "finance"] },
  { label: "Purchase Orders", path: "/purchase-orders", icon: FileText, roles: ["admin", "super_admin", "finance"] },
  { label: "Create PO", path: "/create-po", icon: PlusCircle, roles: ["admin"] },
  { label: "Finance", path: "/finance", icon: Wallet, roles: ["finance", "super_admin"] },
  { label: "Vendors", path: "/vendors", icon: Users, roles: ["admin", "super_admin", "finance"] },
  { label: "Institutes", path: "/institutes", icon: Building2, roles: ["super_admin"] },
  { label: "User Management", path: "/user-management", icon: Users, roles: ["super_admin"] },
  { label: "Reports", path: "/reports", icon: BarChart3, roles: ["admin", "super_admin", "finance"] },
  { label: "Audit Log", path: "/audit-log", icon: ClipboardList, roles: ["super_admin"] },
];

export default function Layout() {
  const { role, userName, setDemoRole, isSuperAdmin, isFinance, isInstituteAdmin, instituteName, instituteIds, instituteNames, hasMultipleInstitutes, activeInstituteId, setActiveInstituteId } = useUserRole();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [instOpen, setInstOpen] = useState(false);

  const visibleItems = navItems.filter((i) => i.roles.includes(role));

  const handleLogout = async () => {
    await base44.auth.logout("/login");
  };

  const roleBadge = isSuperAdmin ? "Super Admin" : isFinance ? "Finance" : "Institute Admin";

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar */}
      <aside className={`fixed lg:static inset-y-0 left-0 z-50 w-64 bg-white border-r border-slate-200 flex flex-col transition-transform duration-300 ${mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}>
        <div className="h-16 flex items-center gap-2 px-5 border-b border-slate-200">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-slate-800 to-slate-600 flex items-center justify-center text-white font-bold text-sm">PO</div>
          <div>
            <div className="font-semibold text-sm text-slate-800 leading-tight">PO & Finance</div>
            <div className="text-[10px] text-slate-400 uppercase tracking-wide">Management System</div>
          </div>
        </div>
        <nav className="flex-1 py-3 px-3 space-y-1 overflow-y-auto">
          {visibleItems.map((item) => {
            const Icon = item.icon;
            const active = location.pathname === item.path || (item.path !== "/" && location.pathname.startsWith(item.path));
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  active ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                <Icon className="w-4 h-4" />
                {item.label}
              </Link>
            );
          })}
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

      {/* Main */}
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
    { value: "super_admin", label: "Super Admin" },
    { value: "finance", label: "Finance" },
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