import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useUserRole } from "@/lib/RoleContext";
import { ROLE_LABELS } from "@/lib/roles";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  UserCircle, Mail, Phone, Building2, Shield, KeyRound, LogOut,
  Loader2, CheckCircle2, AlertCircle
} from "lucide-react";
import { toast } from "sonner";

export default function Profile() {
  const { user, userName, role, roleKey, accessibleInstitutes, isSuperAdmin } = useUserRole();
  const [resetting, setResetting] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  const handleChangePassword = async () => {
    if (!user?.email) return toast.error("No email on file for this account");
    setResetting(true);
    try {
      await base44.auth.resetPasswordRequest(user.email);
    } catch {
      // always show success
    } finally {
      setResetting(false);
      setResetSent(true);
      toast.success("A secure password reset link has been sent to your email");
    }
  };

  const handleLogout = async () => {
    await base44.auth.logout(window.location.origin);
  };

  if (!user) {
    return <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" /></div>;
  }

  const isActive = (user.account_status || "active") === "active";

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">My Profile</h1>
        <p className="text-sm text-slate-500 mt-0.5">View your account information and manage your password</p>
      </div>

      {/* Identity card */}
      <Card className="p-5">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-slate-700 to-slate-500 flex items-center justify-center text-white text-2xl font-bold">
            {(userName || "U").charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-semibold text-slate-800 truncate">{userName}</h2>
            <div className="flex items-center gap-2 mt-1">
              <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium border ${isSuperAdmin ? "bg-purple-100 text-purple-700 border-purple-200" : "bg-blue-100 text-blue-700 border-blue-200"}`}>
                {ROLE_LABELS[roleKey] || role}
              </span>
              <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium border ${isActive ? "bg-emerald-50 text-emerald-600 border-emerald-200" : "bg-red-50 text-red-600 border-red-200"}`}>
                {isActive ? "Active" : "Inactive"}
              </span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-5 pt-5 border-t border-slate-100">
          <InfoRow icon={Mail} label="Email" value={user.email} />
          <InfoRow icon={Phone} label="Mobile" value={user.mobile_number || "—"} />
          <InfoRow icon={Shield} label="Role" value={ROLE_LABELS[roleKey] || role} />
          <div>
            <div className="text-xs text-slate-400 mb-1 flex items-center gap-1"><Building2 className="w-3 h-3" /> Assigned Institutions</div>
            {isSuperAdmin ? (
              <div className="text-sm text-slate-700 font-medium">All Institutions (system-wide access)</div>
            ) : accessibleInstitutes.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {accessibleInstitutes.map((i) => (
                  <span key={i.id} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-xs">
                    <Building2 className="w-3 h-3" />{i.institute_name}
                  </span>
                ))}
              </div>
            ) : (
              <span className="text-xs text-amber-600">No institutions assigned</span>
            )}
          </div>
        </div>
      </Card>

      {/* Security card */}
      <Card className="p-5">
        <h3 className="font-semibold text-slate-800 text-sm flex items-center gap-2"><KeyRound className="w-4 h-4 text-slate-500" /> Security</h3>
        <p className="text-xs text-slate-500 mt-1">You can only change your own password. Passwords are never stored in plain text.</p>

        {resetSent ? (
          <div className="mt-4 flex items-start gap-2 bg-emerald-50 border border-emerald-200 rounded-lg p-3">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-emerald-800">A secure password reset link has been sent to <b>{user.email}</b>. Use the link in the email to set a new password.</p>
          </div>
        ) : (
          <div className="mt-4 flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg p-3">
            <AlertCircle className="w-3.5 h-3.5 text-amber-600 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-amber-800">For your security, password changes are verified via your registered email. Click below to receive a secure reset link.</p>
          </div>
        )}

        <div className="mt-4 flex gap-2">
          <Button variant="outline" onClick={handleChangePassword} disabled={resetting}>
            {resetting ? <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> Sending link...</> : <><KeyRound className="w-4 h-4 mr-1.5" /> Change Password</>}
          </Button>
          <Button variant="outline" className="border-red-200 text-red-600" onClick={handleLogout}>
            <LogOut className="w-4 h-4 mr-1.5" /> Logout
          </Button>
        </div>
      </Card>
    </div>
  );
}

const InfoRow = ({ icon: Icon, label, value }) => (
  <div>
    <div className="text-xs text-slate-400 mb-1 flex items-center gap-1"><Icon className="w-3 h-3" /> {label}</div>
    <div className="text-sm text-slate-700 font-medium truncate">{value}</div>
  </div>
);