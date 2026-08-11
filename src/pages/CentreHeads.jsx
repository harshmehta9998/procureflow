import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useUserRole } from "@/lib/RoleContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UserCog, Building2, Check, X, Mail, Shield, Loader2 } from "lucide-react";
import { toast } from "sonner";

const ROLE_BADGE = {
  centre_head: "bg-teal-100 text-teal-700 border-teal-200",
  admin: "bg-blue-100 text-blue-700 border-blue-200",
};

export default function CentreHeads() {
  const { isSuperAdmin, userName } = useUserRole();
  const [users, setUsers] = useState([]);
  const [institutes, setInstitutes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [editInst, setEditInst] = useState([]);
  const [saving, setSaving] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteInst, setInviteInst] = useState([]);
  const [inviting, setInviting] = useState(false);

  const fetchData = async () => {
    try {
      const [allUsers, allInsts] = await Promise.all([base44.entities.User.list(), base44.entities.Institute.list()]);
      setUsers(allUsers.filter((u) => u.role === "centre_head" || u.role === "admin"));
      setInstitutes(allInsts);
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, []);

  const saveEdit = async (userId) => {
    if (editInst.length === 0) return toast.error("Assign at least one institute");
    setSaving(true);
    try {
      const instNames = institutes.filter((i) => editInst.includes(i.id)).map((i) => i.institute_name);
      const u = users.find((x) => x.id === userId);
      await base44.entities.User.update(userId, {
        role: "centre_head",
        institute_ids: editInst,
        institute_names: instNames,
        institute_id: editInst[0],
        institute_name: instNames[0],
      });
      // Update each institute's centre_head mapping
      for (const instId of editInst) {
        await base44.entities.Institute.update(instId, { centre_head_id: userId, centre_head_name: u?.full_name || u?.email || "" });
      }
      toast.success("Centre Head updated & institutes assigned");
      setEditingId(null);
      fetchData();
    } catch (err) { toast.error(err.message || "Failed"); } finally { setSaving(false); }
  };

  const handleInvite = async () => {
    if (!inviteEmail || !inviteEmail.includes("@")) return toast.error("Enter a valid email");
    if (inviteInst.length === 0) return toast.error("Assign at least one institute");
    setInviting(true);
    try {
      await base44.users.inviteUser(inviteEmail, "centre_head");
      const allUsers = await base44.entities.User.list();
      const newUser = allUsers.find((u) => u.email === inviteEmail);
      if (newUser) {
        const instNames = institutes.filter((i) => inviteInst.includes(i.id)).map((i) => i.institute_name);
        await base44.entities.User.update(newUser.id, {
          institute_ids: inviteInst, institute_names: instNames, institute_id: inviteInst[0], institute_name: instNames[0],
        });
        for (const instId of inviteInst) {
          await base44.entities.Institute.update(instId, { centre_head_id: newUser.id, centre_head_name: newUser.full_name || newUser.email || "" });
        }
      }
      toast.success("Centre Head invited");
      setInviteEmail(""); setInviteInst([]);
      fetchData();
    } catch (err) { toast.error(err.message || "Failed"); } finally { setInviting(false); }
  };

  const toggle = (id, list, setList) => setList(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);

  if (loading) return <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" /></div>;

  if (!isSuperAdmin) {
    return (
      <div className="text-center py-20">
        <Shield className="w-12 h-12 text-slate-300 mx-auto mb-3" />
        <h2 className="text-lg font-semibold text-slate-700">Access Restricted</h2>
        <p className="text-sm text-slate-500 mt-1">Only Super Admins can manage Centre Heads.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Centre Heads</h1>
        <p className="text-sm text-slate-500 mt-0.5">Create centre heads and assign multiple institutes to each</p>
      </div>

      <Card className="p-5">
        <div className="flex items-center gap-2 mb-4">
          <UserCog className="w-5 h-5 text-teal-500" />
          <h3 className="font-semibold text-slate-800">Invite New Centre Head</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div><Label className="text-xs">Email Address *</Label><Input value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="centrehead@example.com" className="h-9 mt-1" type="email" /></div>
        </div>
        <div className="mt-4">
          <Label className="text-xs">Assign Institutes *</Label>
          <div className="mt-2 grid grid-cols-2 md:grid-cols-3 gap-2">
            {institutes.map((inst) => {
              const sel = inviteInst.includes(inst.id);
              return (
                <button key={inst.id} onClick={() => toggle(inst.id, inviteInst, setInviteInst)} className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm text-left ${sel ? "bg-teal-50 border-teal-300 text-teal-700" : "bg-slate-50 border-slate-200 text-slate-600"}`}>
                  <div className={`w-4 h-4 rounded border flex items-center justify-center ${sel ? "bg-teal-600 border-teal-600" : "border-slate-300"}`}>{sel && <Check className="w-3 h-3 text-white" />}</div>
                  <span className="truncate">{inst.institute_name}</span>
                </button>
              );
            })}
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <Button onClick={handleInvite} disabled={inviting} className="bg-teal-600 hover:bg-teal-700">
            {inviting ? <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> Sending...</> : <><UserCog className="w-4 h-4 mr-1.5" /> Invite Centre Head</>}
          </Button>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200"><h3 className="font-semibold text-slate-800 text-sm">Centre Heads ({users.filter((u) => u.role === "centre_head").length})</h3></div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500 uppercase"><tr><th className="text-left px-5 py-2.5 font-medium">User</th><th className="text-left px-5 py-2.5 font-medium">Role</th><th className="text-left px-5 py-2.5 font-medium">Assigned Institutes</th><th className="text-right px-5 py-2.5 font-medium">Action</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {users.map((u) => {
                const isEditing = editingId === u.id;
                const instIds = u.institute_ids || (u.institute_id ? [u.institute_id] : []);
                const instNames = u.institute_names || (u.institute_name ? [u.institute_name] : []);
                return (
                  <tr key={u.id} className="hover:bg-slate-50">
                    <td className="px-5 py-3"><div className="font-medium text-slate-800">{u.full_name || u.email}</div>{u.full_name && <div className="text-xs text-slate-400 flex items-center gap-1"><Mail className="w-3 h-3" /> {u.email}</div>}</td>
                    <td className="px-5 py-3"><span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium border ${ROLE_BADGE[u.role] || ROLE_BADGE.admin}`}>{u.role === "centre_head" ? "Centre Head" : "Institute Admin"}</span></td>
                    <td className="px-5 py-3">
                      {isEditing ? (
                        <div className="flex flex-wrap gap-1.5 max-w-md">
                          {institutes.map((inst) => {
                            const sel = editInst.includes(inst.id);
                            return <button key={inst.id} onClick={() => toggle(inst.id, editInst, setEditInst)} className={`flex items-center gap-1 px-2 py-1 rounded-md border text-xs ${sel ? "bg-teal-50 border-teal-300 text-teal-700" : "bg-white border-slate-200 text-slate-500"}`}>{sel && <Check className="w-3 h-3" />}{inst.institute_name}</button>;
                          })}
                        </div>
                      ) : (
                        <div className="flex flex-wrap gap-1.5 max-w-md">
                          {instIds.length > 0 ? instNames.map((n, i) => <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-xs"><Building2 className="w-3 h-3" />{n}</span>) : <span className="text-xs text-amber-600">Not assigned</span>}
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-3 text-right">
                      {isEditing ? (
                        <div className="flex justify-end gap-1">
                          <Button size="sm" onClick={() => saveEdit(u.id)} disabled={saving} className="bg-emerald-600 h-8">{saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}</Button>
                          <Button size="sm" variant="ghost" onClick={() => setEditingId(null)} className="h-8"><X className="w-3.5 h-3.5" /></Button>
                        </div>
                      ) : (
                        <Button size="sm" variant="outline" onClick={() => { setEditingId(u.id); setEditInst(instIds); }} className="h-8 text-xs">Assign Institutes</Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {users.length === 0 && <div className="text-center py-10 text-sm text-slate-400">No centre heads yet</div>}
        </div>
      </Card>
    </div>
  );
}