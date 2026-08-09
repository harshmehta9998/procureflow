import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useUserRole } from "@/lib/RoleContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UserPlus, Users as UsersIcon, Building2, Mail, Shield, Check, X, Loader2 } from "lucide-react";
import { toast } from "sonner";

const ROLE_LABELS = {
  super_admin: "Super Admin",
  admin: "Institute Admin",
  finance: "Finance",
};

const ROLE_BADGE = {
  super_admin: "bg-purple-100 text-purple-700 border-purple-200",
  admin: "bg-blue-100 text-blue-700 border-blue-200",
  finance: "bg-emerald-100 text-emerald-700 border-emerald-200",
};

export default function UserManagement() {
  const { isSuperAdmin, userName } = useUserRole();
  const [users, setUsers] = useState([]);
  const [institutes, setInstitutes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editInstitutes, setEditInstitutes] = useState([]);
  const [editRole, setEditRole] = useState("admin");
  const [saving, setSaving] = useState(false);

  // Invite form
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("admin");
  const [inviteInstitutes, setInviteInstitutes] = useState([]);
  const [inviting, setInviting] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

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
    (u.full_name || "").toLowerCase().includes(search.toLowerCase())
  );

  const handleInvite = async () => {
    if (!inviteEmail || !inviteEmail.includes("@")) return toast.error("Enter a valid email");
    if (inviteRole !== "super_admin" && inviteInstitutes.length === 0) return toast.error("Map at least one institute for this role");
    setInviting(true);
    try {
      await base44.users.inviteUser(inviteEmail, inviteRole);
      // After invite, update the user's institute mappings
      const instNames = institutes.filter((i) => inviteInstitutes.includes(i.id)).map((i) => i.institute_name);
      // Find the newly invited user
      const allUsers = await base44.entities.User.list();
      const newUser = allUsers.find((u) => u.email === inviteEmail);
      if (newUser) {
        await base44.entities.User.update(newUser.id, {
          institute_ids: inviteInstitutes,
          institute_names: instNames,
          institute_id: inviteInstitutes[0] || "",
          institute_name: instNames[0] || "",
        });
      }
      toast.success(`Invitation sent to ${inviteEmail}`);
      setInviteEmail("");
      setInviteInstitutes([]);
      fetchData();
    } catch (err) {
      toast.error(err.message || "Failed to invite user");
    } finally {
      setInviting(false);
    }
  };

  const startEdit = (user) => {
    setEditingId(user.id);
    setEditInstitutes(user.institute_ids || (user.institute_id ? [user.institute_id] : []));
    setEditRole(user.role || "admin");
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditInstitutes([]);
  };

  const saveEdit = async (userId) => {
    if (editRole !== "super_admin" && editInstitutes.length === 0) return toast.error("Map at least one institute");
    setSaving(true);
    try {
      const instNames = institutes.filter((i) => editInstitutes.includes(i.id)).map((i) => i.institute_name);
      await base44.entities.User.update(userId, {
        role: editRole,
        institute_ids: editInstitutes,
        institute_names: instNames,
        institute_id: editRole === "super_admin" ? "" : (editInstitutes[0] || ""),
        institute_name: editRole === "super_admin" ? "" : (instNames[0] || ""),
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

  const toggleInstitute = (instId, list, setList) => {
    if (list.includes(instId)) {
      setList(list.filter((id) => id !== instId));
    } else {
      setList([...list, instId]);
    }
  };

  if (loading) return <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" /></div>;

  if (!isSuperAdmin) {
    return (
      <div className="text-center py-20">
        <Shield className="w-12 h-12 text-slate-300 mx-auto mb-3" />
        <h2 className="text-lg font-semibold text-slate-700">Access Restricted</h2>
        <p className="text-sm text-slate-500 mt-1">Only Super Admins can manage users and institute mappings.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">User & Institute Management</h1>
        <p className="text-sm text-slate-500 mt-0.5">Invite users, assign roles, and map them to institutes</p>
      </div>

      {/* Invite User Card */}
      <Card className="p-5">
        <div className="flex items-center gap-2 mb-4">
          <UserPlus className="w-5 h-5 text-indigo-500" />
          <h3 className="font-semibold text-slate-800">Invite New User</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label className="text-xs">Email Address *</Label>
            <Input value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="user@example.com" className="h-9 mt-1" type="email" />
          </div>
          <div>
            <Label className="text-xs">Role *</Label>
            <Select value={inviteRole} onValueChange={setInviteRole}>
              <SelectTrigger className="h-9 mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Institute Admin</SelectItem>
                <SelectItem value="finance">Finance</SelectItem>
                <SelectItem value="super_admin">Super Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        {inviteRole !== "super_admin" && (
          <div className="mt-4">
            <Label className="text-xs">Map to Institutes * (select one or more)</Label>
            <div className="mt-2 grid grid-cols-2 md:grid-cols-3 gap-2">
              {institutes.map((inst) => {
                const selected = inviteInstitutes.includes(inst.id);
                return (
                  <button
                    key={inst.id}
                    onClick={() => toggleInstitute(inst.id, inviteInstitutes, setInviteInstitutes)}
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
          </div>
        )}
        <div className="mt-4 flex justify-end">
          <Button onClick={handleInvite} disabled={inviting} className="bg-indigo-600 hover:bg-indigo-700">
            {inviting ? <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> Sending Invite...</> : <><UserPlus className="w-4 h-4 mr-1.5" /> Send Invitation</>}
          </Button>
        </div>
      </Card>

      {/* Users List */}
      <Card className="overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <UsersIcon className="w-4 h-4 text-slate-500" />
            <h3 className="font-semibold text-slate-800 text-sm">Registered Users ({filtered.length})</h3>
          </div>
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search users..." className="h-8 max-w-xs text-sm" />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500 uppercase">
              <tr>
                <th className="text-left px-5 py-2.5 font-medium">User</th>
                <th className="text-left px-5 py-2.5 font-medium">Role</th>
                <th className="text-left px-5 py-2.5 font-medium">Mapped Institutes</th>
                <th className="text-right px-5 py-2.5 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((u) => {
                const isEditing = editingId === u.id;
                const userInstIds = u.institute_ids || (u.institute_id ? [u.institute_id] : []);
                const userInstNames = u.institute_names || (u.institute_name ? [u.institute_name] : []);
                return (
                  <tr key={u.id} className="hover:bg-slate-50">
                    <td className="px-5 py-3">
                      <div className="font-medium text-slate-800">{u.full_name || u.email}</div>
                      {u.full_name && <div className="text-xs text-slate-400 flex items-center gap-1"><Mail className="w-3 h-3" /> {u.email}</div>}
                    </td>
                    <td className="px-5 py-3">
                      {isEditing ? (
                        <Select value={editRole} onValueChange={setEditRole}>
                          <SelectTrigger className="h-8 text-xs w-36"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="admin">Institute Admin</SelectItem>
                            <SelectItem value="finance">Finance</SelectItem>
                            <SelectItem value="super_admin">Super Admin</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium border ${ROLE_BADGE[u.role] || ROLE_BADGE.admin}`}>
                          {ROLE_LABELS[u.role] || u.role}
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      {isEditing ? (
                        editRole === "super_admin" ? (
                          <span className="text-xs text-slate-400">Super Admin — all institutes</span>
                        ) : (
                          <div className="flex flex-wrap gap-1.5 max-w-md">
                            {institutes.map((inst) => {
                              const selected = editInstitutes.includes(inst.id);
                              return (
                                <button
                                  key={inst.id}
                                  onClick={() => toggleInstitute(inst.id, editInstitutes, setEditInstitutes)}
                                  className={`flex items-center gap-1 px-2 py-1 rounded-md border text-xs transition-colors ${selected ? "bg-indigo-50 border-indigo-300 text-indigo-700" : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"}`}
                                >
                                  {selected && <Check className="w-3 h-3" />}
                                  {inst.institute_name}
                                </button>
                              );
                            })}
                          </div>
                        )
                      ) : (
                        <div className="flex flex-wrap gap-1.5 max-w-md">
                          {u.role === "super_admin" ? (
                            <span className="text-xs text-slate-400">All Institutes</span>
                          ) : userInstIds.length > 0 ? (
                            userInstNames.map((name, i) => (
                              <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-xs">
                                <Building2 className="w-3 h-3" />
                                {name}
                              </span>
                            ))
                          ) : (
                            <span className="text-xs text-amber-600">Not mapped</span>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-3 text-right">
                      {isEditing ? (
                        <div className="flex justify-end gap-1">
                          <Button size="sm" onClick={() => saveEdit(u.id)} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700 h-8">
                            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                          </Button>
                          <Button size="sm" variant="ghost" onClick={cancelEdit} className="h-8"><X className="w-3.5 h-3.5" /></Button>
                        </div>
                      ) : (
                        <Button size="sm" variant="outline" onClick={() => startEdit(u)} className="h-8 text-xs">Edit</Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="text-center py-10 text-sm text-slate-400">No users found</div>
          )}
        </div>
      </Card>
    </div>
  );
}