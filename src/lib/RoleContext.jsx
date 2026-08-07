import React, { createContext, useContext, useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";

const RoleContext = createContext(null);

export const useUserRole = () => useContext(RoleContext);

export const RoleProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [demoRole, setDemoRole] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const u = await base44.auth.me();
        setUser(u);
      } catch (e) {
        setUser(null);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const effectiveRole = demoRole || user?.role || "super_admin";
  const instituteId = user?.institute_id || null;
  const instituteName = user?.institute_name || null;
  const userName = user?.full_name || user?.email || "User";

  const value = {
    user,
    role: effectiveRole,
    instituteId,
    instituteName,
    userName,
    loading,
    setDemoRole,
    isSuperAdmin: effectiveRole === "super_admin",
    isFinance: effectiveRole === "finance",
    isInstituteAdmin: effectiveRole === "admin",
  };

  return <RoleContext.Provider value={value}>{children}</RoleContext.Provider>;
};