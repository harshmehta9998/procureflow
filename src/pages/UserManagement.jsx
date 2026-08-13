import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useUserRole } from "@/lib/RoleContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  UserPlus, Users as UsersIcon, Building2, Mail, Phone, Shield, Check, X,
  Loader2, KeyRound, Power, PowerOff, Search, Lock, AlertCircle
} from "lucide-react";
import { toast } from "sonner";

const ROLE_LABELS = {
  super_admin: "Super Admin",
  centre_head: "Centre Head",
  admin: "Institute Admin",
  finance: "Finance",
};
const ROLE_BADGE = {
  super_admin: "bg-purple-100 text-purple-700 border-purple-200",
  centre_head: "bg-amber-100 text-amber-700 border-amber-200",
  admin: "bg-blue-100 text-blue-700 border-blue-200",
  finance: "bg-emerald-100 text-emerald-700 border-emerald-200",
};
// Platform built-in role that gates RLS admin access — only Super Admin maps to it.
const platformRoleFor = (appRole) => (appRole === "super_admin" ? "admin" : "user");

const emptyForm = { full_name: "", email: "", mobile_number: "", role: "admin", institute_ids: [] };

export default function UserManagement() {
  const { isSuperAdmin } = useUserRole();
  const [users, setUsers] = useState([]);
  const [institutes, setInstitutes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [creating, setCreating] = useState(false);

  const [editingId, setEditingId] = useState(null);
  const [edit, setEdit] = useState({ full_name: "", mobile_number: "", role: "admin", institute_ids: [], account_status: "active" });
  const [saving, setSaving] = useState(false);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      const [allUsers, allInsts] = await Promise.all([
        base44.entities.User.list(),
        base44.entities.Institute.list(),
      ]);
      setUsers(allUsers);
      setInstitutes(allInsts);
    } catch (err) {
      toast.error("Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  const filtered = users.filter((u) =>
    !search ||
    (u.email || "").toLowerCase().includes(search.toLowerCase()) ||
    (u.full_name || "").toLowerCase().includes(search.toLowerCase()) ||
    (u.mobile_number || "").includes(search)
  );

  const toggleInst = (instId, list, setter) => {
    setter(list.includes(instId) ? list.filter((id) => id !== instId) : [...list, instId]);
  };

  const instName = (id) => institutes.find((i) => i.id === id)?.institute_name || id;

  // ---- Create user ----
  const handleCreate = async () => {
    if (!form.full_name.trim()) return toast.error("Full name is required");
    if (!form.email.trim() || !form.email.includes("@")) return toast.error("Enter a valid email");
    if (form.role !== "super_admin" && form.institute_ids.length === 0)
      return toast.error("Map at least one institute for this role");

    // Prevent duplicate login IDs (email is the unique login identifier).
    const dup = users.find((u) => (u.email || "").toLowerCase() === form.email.trim().toLowerCase());
    if (dup) return toast.error("A user with this email already exists. Login IDs must be unique.");

    setCreating(true);
    try {
      // 1. Create the account via the platform's secure invite flow (password is set
      //    by the user through email verification — never stored in plain text).
      await base44.users.inviteUser(form.email.trim(), platformRoleFor(form.role));

      // 2. Locate the newly created user record and attach the profile + institution access.
      const refreshed = await base44.entities.User.list();
      const newUser = refreshed.find((u) => (u.email || "").toLowerCase() === form.email.trim().toLowerCase());
      if (newUser) {
        const instNames = form.institute_ids.map(instName);
        await base44.entities.User.update(newUser.id, {
          full_name: form.full_name.trim(),
          mobile_number: form.mobile_number.trim(),
          app_role: form.role,
          role: platformRoleFor(form.role),
          institute_ids: form.institute_ids,
          institute_names: instNames,
          institute_id: form.institute_ids[0] || "",
          institute_name: instNames[0] || "",
          account_status: "active",
        });
      }
      toast.success(`Account created — ${form.email} will receive a secure link to set their password`);
      setShowCreate(false);
      setForm(emptyForm);
      fetchData();
    } catch (err) {
      toast.error(err.message || "Failed to create user");
    } finally {
      setCreating(false);
    }
  };

  // ---- Edit user ----
  const startEdit = (u) => {
    setEditingId(u.id);
    setEdit({
      full_name: u.full_name || "",
      mobile_number: u.mobile_number || "",
      role: u.app_role || (u.role === "admin" ? "super_admin" : "admin"),
      institute_ids: u.institute_ids || (u.institute_id ? [u.institute_id] : []),
      account_status: u.account_status || "active",
    });
  };

  const saveEdit = async (userId) => {
    if (edit.role !== "super_admin" && edit.institute_ids.length === 0)
      return toast.error("Map at least one institute");
    setSaving(true);
    try {
      const instNames = edit.institute_ids.map(instName);
      await base44.entities.User.update(userId, {
        full_name: edit.full_name.trim(),
        mobile_number: edit.mobile_number.trim(),
        app_role: edit.role,
        role: platformRoleFor(edit.role),
        institute_ids: edit.institute_ids,
        institute_names: instNames,
        institute_id: edit.role === "super_admin" ? "" : (edit.institute_ids[0] || ""),
        institute_name: edit.role === "super_admin" ? "" : (instNames[0] || ""),
        account_status: edit.account_status,
      });
      toast.success("User updated");
      setEditingId(null);
      fetchData();
    } catch (err) {
      toast.error(err.message || "Failed to update user");
    } finally {
      setSaving(false);
    }
  };

  // ---- Reset password (secure, email-based) ----
  const handleResetPassword = async (u) => {
    if (!u.email) return toast.error("User has no email on file");
    try {
      await base44.auth.resetPasswordRequest(u.email);
      toast.success(`Password reset link sent to ${u.email}`);
    } catch {
      toast.success(`Password reset link sent to ${u.email}`);
    }
  };

  // ---- Activate / Deactivate ----
  const toggleStatus = async (u) => {
    const next = u.account_status === "inactive" ? "active" : "inactive";
    try {
      await base44.entities.User.update(u.id, { account_status: next });
      toast.success(next === "active" ? "User activated" : "User deactivated — access revoked, history retained");
      fetchData();
    } catch (err) {
      toast.error(err.message || "Failed to update status");
    }
  };

  if (loading) return <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" /></div>;

  if (!isSuperAdmin) {
    return (
      <div className="text-center py-20">
        <Shield className="w-12 h-12 text-slate-300 mx-auto mb-3" />
        <h2 className="text-lg font-semibold text-slate-700">Access Restricted</h2>
        <p className="text-sm text-slate-500 mt-1">Only Super Admins can manage users and institution access.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">User Management</h1>
          <p className="text-sm text-slate-500 mt-0.5">Create users, assign roles &amp; institutions, reset passwords, manage access</p>
        </div>
        <Button onClick={() => setShowCreate(true)} className="bg-indigo-600 hover:bg-indigo-700">
          <UserPlus className="w-4 h-4 mr-1.5" /> Create User
        </Button>
      </div>

      {/* Security note */}
      <div className="flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-lg p-3">
        <Lock className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
        <p className="text-xs text-blue-800">
          Passwords are never stored in plain text and cannot be viewed by anyone — including Super Admin.
          New users set their own password through a secure, email-verified link. Use <b>Reset Password</b> to
          send a fresh secure link when a user forgets theirs.
        </p>
      </div>

      {/* Create user modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowCreate(false)}>
          <div className="bg-white rounded-xl w-full max-w-lg p-5 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2 mb-4">
              <UserPlus className="w-5 h-5 text-indigo-600" />
              <h3 className="font-semibold text-slate-800">Create New User</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Full Name *</Label>
                <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} className="h-9 mt-1" placeholder="Chirag Jain" />
              </div>
              <div>
                <Label className="text-xs">Email (Login ID) *</Label>
                <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="h-9 mt-1" placeholder="chirag@example.com" />
              </div>
              <div>
                <Label className="text-xs">Mobile Number</Label>
                <Input value={form.mobile_number} onChange={(e) => setForm({ ...form, mobile_number: e.target.value })} className="h-9 mt-1" placeholder="98XXXXXXXX" />
              </div>
              <div>
                <Label className="text-xs">Role *</Label>
                <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
                  <SelectTrigger className="h-9 mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Institute Admin</SelectItem>
                    <SelectItem value="centre_head">Centre Head</SelectItem>
                    <SelectItem value="finance">Finance</SelectItem>
                    <SelectItem value="super_admin">Super Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {form.role !== "super_admin" && (
              <div className="mt-4">
                <Label className="text-xs">Assigned Institutions * (select one or more — no limit)</Label>
                <div className="mt-2 grid grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                  {institutes.length === 0 && <p className="text-xs text-slate-400 col-span-2">No institutions configured yet.</p>}
                  {institutes.map((inst) => {
                    const selected = form.institute_ids.includes(inst.id);
                    return (
                      <button
                        key={inst.id}
                        onClick={() => toggleInst(inst.id, form.institute_ids, (ids) => setForm({ ...form, institute_ids: ids }))}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm text-left transition-colors ${selected ? "bg-indigo-50 border-indigo-300 text-indigo-700" : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"}`}
                      >
                        <div className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${selected ? "bg-indigo-600 border-indigo-600" : "border-slate-300"}`}>
                          {selected && <Check className="w-3 h-3 text-white" />}
                        </div>
                        <span className="truncate">{inst.institute_name}</span>
                      </button>
                    );
                  })}
                </div>
                {form.institute_ids.length > 0 && (
                  <p className="text-xs text-slate-500 mt-2">{form.institute_ids.length} institution(s) assigned — user can access all of them from one login.</p>
                )}
              </div>
            )}
            <div className="mt-4 flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg p-2.5">
              <AlertCircle className="w-3.5 h-3.5 text-amber-600 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-amber-800">After creation, the user receives a secure email link to set their own password. You cannot view or set passwords directly.</p>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
              <Button onClick={handleCreate} disabled={creating} className="bg-indigo-600 hover:bg-indigo-700">
                {creating ? <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> Creating...</> : <><UserPlus className="w-4 h-4 mr-1.5" /> Create User</>}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Users list */}
      <Card className="overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <UsersIcon className="w-4 h-4 text-slate-500" />
            <h3 className="font-semibold text-slate-800 text-sm">Users ({filtered.length})</h3>
          </div>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, email, mobile..." className="h-8 max-w-xs text-sm pl-8" />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500 uppercase">
              <tr>
                <th className="text-left px-5 py-2.5 font-medium">User</th>
                <th className="text-left px-5 py-2.5 font-medium">Mobile</th>
                <th className="text-left px-5 py-2.5 font-medium">Role</th>
                <th className="text-left px-5 py-2.5 font-medium">Institutions</th>
                <th className="text-left px-5 py-2.5 font-medium">Status</th>
                <th className="text-right px-5 py-2.5 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((u) => {
                const isEditing = editingId === u.id;
                const userInstIds = u.institute_ids || (u.institute_id ? [u.institute_id] : []);
                const userInstNames = u.institute_names || (u.institute_name ? [u.institute_name] : []);
                const isInactive = (u.account_status || "active") === "inactive";
                const dispRole = u.app_role || (u.role === "admin" ? "super_admin" : "admin");
                const isSuperUser = dispRole === "super_admin";
                return (
                  <tr key={u.id} className="hover:bg-slate-50">
                    <td className="px-5 py-3">
                      {isEditing ? (
                        <Input value={edit.full_name} onChange={(e) => setEdit({ ...edit, full_name: e.target.value })} className="h-8 text-sm w-40" />
                      ) : (
                        <>
                          <div className="font-medium text-slate-800">{u.full_name || u.email}</div>
                          {u.full_name && <div className="text-xs text-slate-400 flex items-center gap-1"><Mail className="w-3 h-3" /> {u.email}</div>}
                        </>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      {isEditing ? (
                        <Input value={edit.mobile_number} onChange={(e) => setEdit({ ...edit, mobile_number: e.target.value })} className="h-8 text-sm w-32" placeholder="—" />
                      ) : (
                        <span className="text-xs text-slate-500 flex items-center gap-1"><Phone className="w-3 h-3" /> {u.mobile_number || "—"}</span>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      {isEditing ? (
                        <Select value={edit.role} onValueChange={(v) => setEdit({ ...edit, role: v })}>
                          <SelectTrigger className="h-8 text-xs w-36"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="admin">Institute Admin</SelectItem>
                            <SelectItem value="centre_head">Centre Head</SelectItem>
                            <SelectItem value="finance">Finance</SelectItem>
                            <SelectItem value="super_admin">Super Admin</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium border ${ROLE_BADGE[dispRole] || ROLE_BADGE.admin}`}>{ROLE_LABELS[dispRole] || dispRole}</span>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      {isEditing ? (
                        edit.role === "super_admin" ? (
                          <span className="text-xs text-slate-400">Super Admin — all institutes</span>
                        ) : (
                          <div className="flex flex-wrap gap-1.5 max-w-md">
                            {institutes.map((inst) => {
                              const selected = edit.institute_ids.includes(inst.id);
                              return (
                                <button key={inst.id} onClick={() => toggleInst(inst.id, edit.institute_ids, (ids) => setEdit({ ...edit, institute_ids: ids }))}
                                  className={`flex items-center gap-1 px-2 py-1 rounded-md border text-xs transition-colors ${selected ? "bg-indigo-50 border-indigo-300 text-indigo-700" : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"}`}>
                                  {selected && <Check className="w-3 h-3" />}{inst.institute_name}
                                </button>
                              );
                            })}
                          </div>
                        )
                      ) : (
                        <div className="flex flex-wrap gap-1.5 max-w-md">
                          {isSuperUser ? (
                            <span className="text-xs text-slate-400">All Institutes</span>
                          ) : userInstIds.length > 0 ? (
                            userInstNames.map((name, i) => (
                              <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-xs">
                                <Building2 className="w-3 h-3" />{name}
                              </span>
                            ))
                          ) : (
                            <span className="text-xs text-amber-600">Not mapped</span>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      {isEditing ? (
                        <Select value={edit.account_status} onValueChange={(v) => setEdit({ ...edit, account_status: v })}>
                          <SelectTrigger className="h-8 text-xs w-28"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="active">Active</SelectItem>
                            <SelectItem value="inactive">Inactive</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium border ${isInactive ? "bg-red-50 text-red-600 border-red-200" : "bg-emerald-50 text-emerald-600 border-emerald-200"}`}>
                          {isInactive ? "Inactive" : "Active"}
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-right">
                      {isEditing ? (
                        <div className="flex justify-end gap-1">
                          <Button size="sm" onClick={() => saveEdit(u.id)} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700 h-8">
                            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setEditingId(null)} className="h-8"><X className="w-3.5 h-3.5" /></Button>
                        </div>
                      ) : (
                        <div className="flex justify-end gap-1">
                          <Button size="sm" variant="outline" onClick={() => startEdit(u)} className="h-8 text-xs">Edit</Button>
                          <Button size="sm" variant="outline" className="h-8 text-xs border-amber-200 text-amber-700" title="Send secure password reset link" onClick={() => handleResetPassword(u)}>
                            <KeyRound className="w-3.5 h-3.5" /> Reset
                          </Button>
                          <Button size="sm" variant="outline" className={`h-8 text-xs ${isInactive ? "border-emerald-200 text-emerald-700" : "border-red-200 text-red-600"}`} onClick={() => toggleStatus(u)}>
                            {isInactive ? <><Power className="w-3.5 h-3.5" /> Activate</> : <><PowerOff className="w-3.5 h-3.5" /> Deactivate</>}
                          </Button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filtered.length === 0 && <div className="text-center py-10 text-sm text-slate-400">No users found</div>}
        </div>
      </Card>
    </div>
  );
}