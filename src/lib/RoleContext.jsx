import React, { createContext, useContext, useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";

const RoleContext = createContext(null);

export const useUserRole = () => useContext(RoleContext);

export const RoleProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [demoRole, setDemoRole] = useState(null);
  const [activeInstituteId, setActiveInstituteId] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const u = await base44.auth.me();
        setUser(u);
        // Default active institute to first mapped institute if available
        const ids = u?.institute_ids || (u?.institute_id ? [u.institute_id] : []);
        if (ids.length > 0) setActiveInstituteId(ids[0]);
      } catch (e) {
        setUser(null);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const effectiveRole = demoRole || user?.role || "super_admin";
  const instituteIds = user?.institute_ids || (user?.institute_id ? [user.institute_id] : []);
  const instituteNames = user?.institute_names || (user?.institute_name ? [user.institute_name] : []);
  // The active institute is the one the user is currently acting as (for multi-institute users)
  const instituteId = effectiveRole === "super_admin" ? null : (activeInstituteId || instituteIds[0] || user?.institute_id || null);
  const instituteName = effectiveRole === "super_admin" ? null : (
    instituteIds.indexOf(instituteId) >= 0 ? (instituteNames[instituteIds.indexOf(instituteId)] || user?.institute_name) : user?.institute_name
  );
  const userName = user?.full_name || user?.email || "User";

  const value = {
    user,
    role: effectiveRole,
    instituteId,
    instituteName,
    instituteIds,
    instituteNames,
    activeInstituteId,
    setActiveInstituteId,
    userName,
    loading,
    setDemoRole,
    isSuperAdmin: effectiveRole === "super_admin",
    isFinance: effectiveRole === "finance",
    isInstituteAdmin: effectiveRole === "admin",
    hasMultipleInstitutes: instituteIds.length > 1,
  };

  return <RoleContext.Provider value={value}>{children}</RoleContext.Provider>;
}