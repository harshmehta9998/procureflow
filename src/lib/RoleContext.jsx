import React, { createContext, useContext, useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { normalizeRole } from "@/lib/roles";

const RoleContext = createContext(null);
export const useUserRole = () => useContext(RoleContext);

const STORAGE_KEY = (uid) => `pf_active_institute_${uid || "anon"}`;

// Resolve the user's canonical workflow role. New accounts carry
// `workflow_role`; legacy accounts fall back to `app_role` (normalized) so
// nothing existing breaks.
const resolveRole = (u) => u?.workflow_role || u?.app_role || (u?.role === "admin" ? "super_admin" : null);

export const RoleProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [institutes, setInstitutes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [accountInactive, setAccountInactive] = useState(false);
  const [activeInstitute, setActiveInstituteState] = useState("all");
  const [previewRole, setPreviewRoleState] = useState(null); // Super-Admin-only "Test as Role" override

  // Load authenticated user + the institutes they may access (RLS returns only
  // mapped institutes for non-admins, all for platform admins/super_admins).
  useEffect(() => {
    (async () => {
      try {
        const u = await base44.auth.me();
        setUser(u);
        // Deactivated accounts cannot use the app — enforce immediately after auth.
        if (u?.account_status === "inactive") {
          setAccountInactive(true);
          setLoading(false);
          return;
        }
        // Bootstrap the platform app owner (created before roles existed) as
        // Super Admin and persist so future loads are deterministic.
        if (!u?.workflow_role && !u?.app_role && u?.role === "admin") {
          try {
            await base44.auth.updateMe({ workflow_role: "super_admin", app_role: "super_admin" });
          } catch {}
        }

        const insts = await base44.entities.Institute.list();
        setInstitutes(insts);

        const myInstIds = u?.institute_ids || (u?.institute_id ? [u.institute_id] : []);
        const realRoleKey = normalizeRole(resolveRole(u));
        const realIsSuperAdmin = realRoleKey === "super_admin" || realRoleKey === "system_administrator";

        let initial;
        try {
          initial = localStorage.getItem(STORAGE_KEY(u.id)) || "all";
        } catch { initial = "all"; }
        // Validate the persisted selection is still accessible to the user.
        if (initial !== "all" && !realIsSuperAdmin && !myInstIds.includes(initial)) {
          initial = "all";
        }
        // If the user has exactly one institute and is not super admin, default to it.
        if (initial === "all" && !realIsSuperAdmin && myInstIds.length === 1) {
          initial = myInstIds[0];
        }
        setActiveInstituteState(initial);
        // Restore any saved "Test as Role" preview (only meaningful for super admin).
        let savedPreview = null;
        try { savedPreview = localStorage.getItem(`pf_preview_role_${u.id}`); } catch {}
        if (savedPreview && u?.role === "admin") setPreviewRoleState(savedPreview);
      } catch (e) {
        setUser(null);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const setActiveInstitute = (val) => {
    setActiveInstituteState(val);
    try { localStorage.setItem(STORAGE_KEY(user?.id), val); } catch {}
  };

  // "Test as Role" — lets the platform admin (Super Admin) preview the UI/flow of
  // another role WITHOUT changing backend permissions. RLS still enforces the real
  // user's access; this only changes which nav items/buttons the frontend shows.
  const setPreviewRole = (val) => {
    setPreviewRoleState(val);
    try {
      if (val) localStorage.setItem(`pf_preview_role_${user?.id}`, val);
      else localStorage.removeItem(`pf_preview_role_${user?.id}`);
    } catch {}
  };

  const realRole = resolveRole(user);
  const realRoleKey = normalizeRole(realRole);
  const realIsSuperAdmin = realRoleKey === "super_admin" || realRoleKey === "system_administrator";

  // The effective role for UI: a Super-Admin "Test as Role" preview overrides it.
  // `role` is the raw value (canonical or legacy); `roleKey` is the normalized
  // canonical key the rest of the app keys off.
  const role = previewRole || realRole;
  const roleKey = normalizeRole(role) || realRoleKey;

  // Role flags — legacy aliases kept working so existing screens don't break.
  const isSuperAdmin = roleKey === "super_admin" || roleKey === "system_administrator";
  const isCentreHead = roleKey === "centre_head";
  const isFinance = roleKey === "finance_controller"; // also matches legacy "finance"
  const isInstituteAdmin = roleKey === "institutional_admin"; // also matches legacy "admin"

  // New role flags per the approval-workflow hierarchy.
  const isInstitutionalAdmin = isInstituteAdmin;
  const isDepartmentAdmin = roleKey === "department_admin";
  const isDepartmentHead = roleKey === "department_head";
  const isApprovalAdmin = roleKey === "approval_admin";
  const isFinanceController = isFinance;
  const isSystemAdministrator = roleKey === "system_administrator";

  // Configurable approval authorities (Admin / Centre Head / Department Head).
  // Super Admin can act as any authority for oversight.
  const approvalAuthorities = Array.isArray(user?.approval_authorities) ? user.approval_authorities : [];
  const hasAuthority = (type) => isSuperAdmin || approvalAuthorities.includes(type);

  // Workflow permission helpers (OPEX / CAPEX routing). These describe what the
  // current effective role is allowed to do; the approval queues enforce them.
  const canRaiseOpex = isInstitutionalAdmin;
  const canRaiseCapex = isApprovalAdmin;
  const canApproveAdminLayer = isApprovalAdmin || isSuperAdmin;
  const canApproveCentreHead = isCentreHead || isSuperAdmin;
  const canApproveFinanceController = isFinance || isSuperAdmin;
  const canApproveManagement = isSuperAdmin;

  const myInstIds = user?.institute_ids || (user?.institute_id ? [user.institute_id] : []);
  // Institutes available in the selector follow the REAL account (Super Admin sees
  // every institute); the "Test as Role" preview only changes UI flags, not data scope.
  const accessibleInstitutes = realIsSuperAdmin
    ? institutes
    : institutes.filter((i) => myInstIds.includes(i.id));
  const instituteIds = accessibleInstitutes.map((i) => i.id);
  const instituteNames = accessibleInstitutes.map((i) => i.institute_name);

  // scopeInstituteIds: the set of institute IDs the current view should show data for.
  //   null  -> no filter (super admin viewing All Institutions = entire system)
  //   [...] -> restrict to these institute IDs
  let scopeInstituteIds = null;
  if (activeInstitute === "all") {
    scopeInstituteIds = realIsSuperAdmin ? null : (myInstIds.length ? myInstIds : []);
  } else {
    scopeInstituteIds = [activeInstitute];
  }

  const instituteId = activeInstitute === "all" ? (myInstIds[0] || null) : activeInstitute;
  const instituteName = activeInstitute === "all"
    ? null
    : (accessibleInstitutes.find((i) => i.id === activeInstitute)?.institute_name || null);

  const userName = user?.full_name || user?.email || "User";

  const value = {
    user,
    role,
    roleKey,
    userName,
    loading,
    accountInactive,
    // institution selector
    activeInstitute,
    setActiveInstitute,
    scopeInstituteIds,
    accessibleInstitutes,
    instituteIds,
    instituteNames,
    instituteId,
    instituteName,
    // role flags (legacy + new)
    isSuperAdmin,
    isCentreHead,
    isFinance,
    isInstituteAdmin,
    isInstitutionalAdmin,
    isDepartmentAdmin,
    isDepartmentHead,
    isApprovalAdmin,
    isFinanceController,
    isSystemAdministrator,
    hasMultipleInstitutes: instituteIds.length > 1 || realIsSuperAdmin,
    showInstitutionSelector: realIsSuperAdmin || myInstIds.length > 1,
    // approval authority
    approvalAuthorities,
    hasAuthority,
    // workflow permissions
    canRaiseOpex,
    canRaiseCapex,
    canApproveAdminLayer,
    canApproveCentreHead,
    canApproveFinanceController,
    canApproveManagement,
    // "Test as Role" preview (Super Admin only)
    previewRole,
    setPreviewRole,
    realRole,
    realRoleKey,
    realIsSuperAdmin,
    // permission helpers
    managesInstitute: (instId) => {
      if (!instId) return false;
      if (realIsSuperAdmin) return true;
      return myInstIds.includes(instId);
    },
    inScope: (instId) => {
      if (scopeInstituteIds === null) return true;
      return scopeInstituteIds.includes(instId);
    },
  };

  if (accountInactive) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <div className="max-w-md text-center bg-white rounded-2xl border border-slate-200 shadow-sm p-8">
          <div className="w-14 h-14 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl">🔒</span>
          </div>
          <h1 className="text-xl font-bold text-slate-800">Account Deactivated</h1>
          <p className="text-sm text-slate-500 mt-2">
            Your account has been deactivated by the administrator. You can no longer access this application.
            Please contact your Super Admin if you believe this is an error.
          </p>
          <button
            onClick={() => base44.auth.logout(window.location.origin)}
            className="mt-6 px-5 py-2.5 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-800"
          >
            Return to Login
          </button>
        </div>
      </div>
    );
  }

  return <RoleContext.Provider value={value}>{children}</RoleContext.Provider>;
};