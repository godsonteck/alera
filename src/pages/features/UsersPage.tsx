import { useState, useEffect, useMemo, useCallback } from 'react';
import { Users, Search, Heart, FlaskConical, ScanLine, Pill, Ambulance, Building2, ShieldCheck, Ban, CheckCircle, Inbox, Plus, Loader, Mail, Calendar, Activity, Trash2, X } from 'lucide-react';
import type { UserRole } from '@/contexts/AuthContext';
import { useAuth } from '@/contexts/useAuth';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/components/ui/use-toast';
import { api, type AdminUserRow, type ApiUser } from '@/lib/apiService';
import { handleApiError } from '@/lib/errorHandler';
import { normalizeUserRole } from '@/lib/roleUtils';
import { getProfessionalVerificationStatus, getVerificationStatusLabel, type ProfessionalVerificationStatus } from '@/lib/verificationStatus';

interface DisplayUser { id: string; name: string; email: string; role: UserRole; status: ProfessionalVerificationStatus; joinDate: string; lastLogin?: string; phone?: string; }

const roleIcons: Record<string, React.ReactNode> = {
  patient: <Users className="w-3 h-3" />, doctor: <Heart className="w-3 h-3" />, hospital: <Building2 className="w-3 h-3" />, laboratory: <FlaskConical className="w-3 h-3" />,
  imaging: <ScanLine className="w-3 h-3" />, pharmacy: <Pill className="w-3 h-3" />, ambulance: <Ambulance className="w-3 h-3" />, physiotherapist: <Activity className="w-3 h-3" />,
  admin: <ShieldCheck className="w-3 h-3" />, super_admin: <ShieldCheck className="w-3 h-3 text-red-500" />,
};

const roleLabels: Record<string, string> = { patient: 'PATIENT', doctor: 'DOCTOR', hospital: 'HOSPITAL', laboratory: 'LABORATORY', imaging: 'IMAGING', pharmacy: 'PHARMACY', ambulance: 'AMBULANCE', physiotherapist: 'PHYSIOTHERAPIST', admin: 'ADMIN', super_admin: 'SUPER_ADMIN' };
const statusStyles: Record<ProfessionalVerificationStatus, string> = { verified: 'bg-emerald-950/40 border-emerald-600/60 text-emerald-400', pending: 'bg-amber-950/40 border-amber-600/60 text-amber-400', suspended: 'bg-red-950/40 border-red-600/60 text-red-400' };

const nonElevatedRoles: UserRole[] = ['patient', 'doctor', 'hospital', 'laboratory', 'imaging', 'pharmacy', 'ambulance', 'physiotherapist'];
const elevatedRoles: UserRole[] = ['admin', 'super_admin'];
const allUserRoles: UserRole[] = [...nonElevatedRoles, ...elevatedRoles];
const backendRoleMap: Record<UserRole, ApiUser['role']> = { patient: 'patient', doctor: 'provider', hospital: 'hospital', laboratory: 'laboratory', imaging: 'imaging', pharmacy: 'pharmacist', ambulance: 'ambulance', physiotherapist: 'physiotherapist', admin: 'admin', super_admin: 'super_admin' };
const isProfessionalRole = (role: UserRole) => role !== 'patient' && !elevatedRoles.includes(role);

const mapRowToDisplay = (u: AdminUserRow): DisplayUser => {
  const uiRole = normalizeUserRole(u.role) ?? 'patient';
  const name = [u.first_name, u.last_name].filter(Boolean).join(' ').trim() || u.email;
  const status = getProfessionalVerificationStatus(u.is_verified, u.is_active);
  return { id: String(u.id), name, email: u.email, role: uiRole, status, joinDate: u.created_at ? new Date(u.created_at).toISOString().split('T')[0] : '—', lastLogin: u.last_login ? new Date(u.last_login).toISOString().split('T')[0] : undefined, phone: u.phone ?? undefined };
};

const UsersPage = () => {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<DisplayUser[]>([]);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showCreate, setShowCreate] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState('');
  const [actionId, setActionId] = useState<string | null>(null);
  const [pendingDeleteUser, setPendingDeleteUser] = useState<DisplayUser | null>(null);
  const [formData, setFormData] = useState({ name: '', email: '', password: '', role: 'patient' as UserRole, licenseNumber: '', licenseState: '', specialty: '' });
  
  const isAdminOrSuperAdmin = currentUser?.role === 'admin' || currentUser?.role === 'super_admin';
  const isSuperAdmin = currentUser?.role === 'super_admin';

  const fetchUsers = useCallback(async () => {
    setListError(''); setListLoading(true);
    try {
      const rows = await api.admin.listAllUsers(0, 500);
      setUsers(Array.isArray(rows) ? rows.map(mapRowToDisplay) : []);
    } catch (err) { setListError(handleApiError(err)); setUsers([]); } finally { setListLoading(false); }
  }, []);

  useEffect(() => { if (isAdminOrSuperAdmin) void fetchUsers(); }, [isAdminOrSuperAdmin, fetchUsers]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter(u => {
      const matchSearch = !q || u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q) || (u.phone && u.phone.toLowerCase().includes(q));
      const matchRole = roleFilter === 'all' || u.role === roleFilter;
      const matchStatus = statusFilter === 'all' || u.status === statusFilter;
      return matchSearch && matchRole && matchStatus;
    });
  }, [users, search, roleFilter, statusFilter]);

  const usersByRole = useMemo(() => Object.fromEntries(allUserRoles.map(r => [r, users.filter(u => u.role === r).length])), [users]);

  const changeUserRole = async (id: string, newRole: string) => {
    setActionId(id);
    try { await api.admin.changeUserRole(id, backendRoleMap[newRole as UserRole] ?? newRole); await fetchUsers(); toast({ title: 'Role updated', description: 'User matrix synchronized.' }); }
    catch (err) { setListError(handleApiError(err)); } finally { setActionId(null); }
  };

  const deleteUser = async (id: string) => {
    setActionId(id);
    try { await api.admin.deleteUser(id); await fetchUsers(); setPendingDeleteUser(null); toast({ title: 'User purged', description: 'Account removed from global matrix.' }); }
    catch (err) { setListError(handleApiError(err)); } finally { setActionId(null); }
  };

  const handleAddUser = async () => {
    if (!formData.name || !formData.email || !formData.password) { toast({ title: 'Validation fault', description: 'Core parameters required.', variant: 'destructive' }); return; }
    if (formData.password.length < 8) { toast({ title: 'Validation fault', description: 'Security protocol: Password too short.', variant: 'destructive' }); return; }
    setIsLoading(true);
    try {
      const [firstName = '', ...lastNameParts] = formData.name.split(' ');
      const lastName = lastNameParts.join(' ') || 'User';
      const username = formData.email.split('@')[0] || formData.name.toLowerCase().replace(/\s+/g, '.');
      
      if (isProfessionalRole(formData.role) && (!formData.licenseNumber.trim() || !formData.licenseState.trim())) {
        toast({ title: 'Validation fault', description: 'Credential parameters missing for professional.', variant: 'destructive' }); setIsLoading(false); return;
      }
      if (elevatedRoles.includes(formData.role)) {
        await api.admin.createAdmin({ email: formData.email, username, password: formData.password, first_name: firstName, last_name: lastName, phone: undefined, role: formData.role as 'admin' | 'super_admin' });
      } else {
        await api.admin.createUser({ email: formData.email, username, password: formData.password, first_name: firstName, last_name: lastName, phone: undefined, role: backendRoleMap[formData.role] ?? 'patient', license_number: formData.role === 'patient' ? undefined : formData.licenseNumber.trim(), license_state: formData.role === 'patient' ? undefined : formData.licenseState.trim(), specialty: formData.role === 'patient' ? undefined : formData.specialty.trim() || undefined });
      }
      setFormData({ name: '', email: '', password: '', role: 'patient', licenseNumber: '', licenseState: '', specialty: '' });
      setShowCreate(false); await fetchUsers();
      toast({ title: 'User provisioned', description: 'Global matrix updated.' });
    } catch (err) { toast({ title: 'Provisioning fault', description: handleApiError(err), variant: 'destructive' }); } finally { setIsLoading(false); }
  };

  const toggleStatus = async (userId: string) => {
    setActionId(userId);
    try {
      const user = users.find(u => u.id === userId); if (!user) return;
      if (user.status === 'suspended') { await api.admin.reactivateUser(userId); toast({ title: 'Access restored', description: `Clearance granted for ${user.email}.` }); }
      else { await api.admin.deactivateUser(userId); toast({ title: 'Access revoked', description: `Clearance stripped from ${user.email}.` }); }
      await fetchUsers();
    } catch (err) { setListError(handleApiError(err)); } finally { setActionId(null); }
  };

  if (!isAdminOrSuperAdmin) {
    return (
      <div className="p-8 bg-[#090D14] border border-[#252A35] rounded-[4px] text-center font-mono text-xs text-slate-500 flex flex-col items-center gap-2">
        <ShieldCheck className="w-6 h-6 text-red-500" />
        <span>RESTRICTED: ELEVATED CLEARANCE REQUIRED</span>
      </div>
    );
  }

  return (
    <div className="space-y-4 font-mono text-[#ECEEF2]">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-[#090D14] border border-[#252A35] rounded-[4px]">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-[#ECEEF2]">Identity & Access Control</span>
          <p className="text-[11px] text-slate-400 mt-0.5">Manage global user matrix. Active identities: {users.length}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => fetchUsers()} disabled={listLoading} className="flex items-center gap-2 bg-[#151922] hover:bg-slate-800 border border-[#2F3542] text-slate-300 font-bold px-3 py-1.5 rounded-[2px] text-xs transition-colors uppercase tracking-wider disabled:opacity-50">
            {listLoading ? <Loader className="w-4 h-4 animate-spin" /> : <Activity className="w-4 h-4" />} SYNC
          </button>
          <button onClick={() => setShowCreate(!showCreate)} className="flex items-center gap-2 bg-[#151922] hover:bg-slate-800 border border-cyan-500/60 text-cyan-300 font-bold px-3 py-1.5 rounded-[2px] text-xs transition-colors uppercase tracking-wider">
            {showCreate ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            <span>{showCreate ? 'CANCEL' : 'PROVISION USER'}</span>
          </button>
        </div>
      </div>

      {showCreate && (
        <div className="p-4 bg-[#090D14] border border-[#252A35] rounded-[4px] space-y-4">
          <span className="text-xs font-bold uppercase text-slate-400 block border-b border-[#252A35] pb-2">PROVISION NEW IDENTITY</span>
          
          <div className="grid md:grid-cols-2 gap-3 text-xs">
            <div>
              <label className="text-[10px] text-slate-400 uppercase block mb-1">Entity Name *</label>
              <input value={formData.name} onChange={(e) => setFormData(cur => ({...cur, name: e.target.value}))} className="w-full bg-[#0F1218] border border-[#252A35] rounded-[2px] p-2 text-[#ECEEF2]" />
            </div>
            <div>
              <label className="text-[10px] text-slate-400 uppercase block mb-1">Network Identifier (Email) *</label>
              <input type="email" value={formData.email} onChange={(e) => setFormData(cur => ({...cur, email: e.target.value}))} className="w-full bg-[#0F1218] border border-[#252A35] rounded-[2px] p-2 text-[#ECEEF2] font-mono" />
            </div>
            <div>
              <label className="text-[10px] text-slate-400 uppercase block mb-1">Security Key (Password) *</label>
              <input type="password" value={formData.password} onChange={(e) => setFormData(cur => ({...cur, password: e.target.value}))} className="w-full bg-[#0F1218] border border-[#252A35] rounded-[2px] p-2 text-[#ECEEF2] font-mono" />
            </div>
            <div>
              <label className="text-[10px] text-slate-400 uppercase block mb-1">Clearance Level (Role)</label>
              <select value={formData.role} onChange={(e) => setFormData(cur => ({...cur, role: e.target.value as UserRole}))} className="w-full bg-[#0F1218] border border-[#252A35] rounded-[2px] p-2 text-[#ECEEF2] uppercase">
                {nonElevatedRoles.map(r => <option key={r} value={r}>{roleLabels[r]}</option>)}
                {isSuperAdmin && elevatedRoles.map(r => <option key={r} value={r}>{roleLabels[r]}</option>)}
              </select>
            </div>
          </div>
          
          {isProfessionalRole(formData.role) && (
            <div className="grid md:grid-cols-3 gap-3 text-xs mt-3 p-3 bg-cyan-950/10 border border-cyan-900/40 rounded-[2px]">
              <div>
                <label className="text-[10px] text-slate-400 uppercase block mb-1">Credential ID *</label>
                <input value={formData.licenseNumber} onChange={(e) => setFormData(cur => ({...cur, licenseNumber: e.target.value}))} className="w-full bg-[#0F1218] border border-[#252A35] rounded-[2px] p-2 text-[#ECEEF2] font-mono" />
              </div>
              <div>
                <label className="text-[10px] text-slate-400 uppercase block mb-1">Jurisdiction *</label>
                <input value={formData.licenseState} onChange={(e) => setFormData(cur => ({...cur, licenseState: e.target.value}))} className="w-full bg-[#0F1218] border border-[#252A35] rounded-[2px] p-2 text-[#ECEEF2] font-mono" />
              </div>
              <div>
                <label className="text-[10px] text-slate-400 uppercase block mb-1">Vector / Dept</label>
                <input value={formData.specialty} onChange={(e) => setFormData(cur => ({...cur, specialty: e.target.value}))} className="w-full bg-[#0F1218] border border-[#252A35] rounded-[2px] p-2 text-[#ECEEF2]" />
              </div>
            </div>
          )}
          
          <button onClick={handleAddUser} disabled={isLoading} className="w-full bg-[#151922] hover:bg-slate-800 border border-cyan-500/60 text-cyan-300 font-bold py-2 rounded-[2px] transition-colors uppercase tracking-wider text-xs">
            {isLoading ? 'PROCESSING...' : 'COMMIT IDENTITY'}
          </button>
        </div>
      )}

      {listError && (
        <div className="p-3 bg-red-950/40 border border-red-600/60 text-[10px] text-red-400 rounded-[2px] font-bold uppercase">
          SYSTEM ERROR: {listError}
        </div>
      )}

      <AlertDialog open={Boolean(pendingDeleteUser)} onOpenChange={(open) => { if (!open) setPendingDeleteUser(null); }}>
        <AlertDialogContent className="bg-[#090D14] border-[#252A35] rounded-[4px]">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-red-400 font-mono font-bold uppercase">PURGE IDENTITY?</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-400 font-mono text-xs">
              Entity {pendingDeleteUser?.email} will be permanently removed from the global matrix. Irreversible action.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-[#151922] border-[#2F3542] text-slate-300 font-bold rounded-[2px] hover:bg-slate-800 hover:text-white uppercase text-xs">CANCEL</AlertDialogCancel>
            <AlertDialogAction className="bg-red-950/80 border border-red-600/60 text-red-300 font-bold rounded-[2px] hover:bg-red-900 uppercase text-xs" onClick={() => pendingDeleteUser ? void deleteUser(pendingDeleteUser.id) : undefined}>
              PURGE DATA
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Role Tabs */}
      <div className="flex flex-wrap gap-2">
        <button onClick={() => setRoleFilter('all')} className={`px-3 py-1.5 rounded-[2px] text-[10px] font-bold tracking-wider uppercase transition-colors border ${roleFilter === 'all' ? 'bg-cyan-950/40 border-cyan-500/60 text-cyan-400' : 'bg-[#0F1218] border-[#252A35] text-slate-500 hover:text-slate-300 hover:border-slate-600'}`}>
          ALL IDENTITIES [{users.length}]
        </button>
        {allUserRoles.map(role => (
          <button key={role} onClick={() => setRoleFilter(roleFilter === role ? 'all' : role)} className={`px-3 py-1.5 rounded-[2px] text-[10px] font-bold tracking-wider uppercase transition-colors border flex items-center gap-1 ${roleFilter === role ? 'bg-cyan-950/40 border-cyan-500/60 text-cyan-400' : 'bg-[#0F1218] border-[#252A35] text-slate-500 hover:text-slate-300 hover:border-slate-600'}`}>
            {roleIcons[role]} {roleLabels[role]} [{usersByRole[role]}]
          </button>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="QUERY IDENTITIES..."
            className="w-full h-8 pl-8 pr-3 rounded-[2px] border border-[#252A35] bg-[#090D14] text-[#ECEEF2] text-xs placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/50"
          />
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="h-8 px-2 rounded-[2px] border border-[#252A35] bg-[#090D14] text-xs text-[#ECEEF2] uppercase font-bold tracking-wider">
          <option value="all">ALL CLEARANCES</option><option value="verified">VERIFIED</option><option value="pending">PENDING</option><option value="suspended">SUSPENDED</option>
        </select>
      </div>

      <div className="bg-[#090D14] border border-[#252A35] rounded-[4px] overflow-hidden">
        {listLoading ? (
          <div className="p-8 text-center text-xs text-slate-500 font-mono">SYNCING IDENTITY MATRIX...</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500 font-mono">NO IDENTITIES MATCH QUERY PARAMETERS.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-[#252A35] bg-[#0F1218]">
                  <th className="px-3 py-2 font-bold text-slate-400 uppercase tracking-wider">ENTITY ID</th>
                  <th className="px-3 py-2 font-bold text-slate-400 uppercase tracking-wider">CLEARANCE</th>
                  <th className="px-3 py-2 font-bold text-slate-400 uppercase tracking-wider">STATUS</th>
                  <th className="px-3 py-2 font-bold text-slate-400 uppercase tracking-wider">METRICS</th>
                  <th className="px-3 py-2 font-bold text-slate-400 uppercase tracking-wider text-right">OPS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#252A35]">
                {filtered.map((u) => {
                  const isSelf = u.id === String(currentUser?.id);
                  return (
                    <tr key={u.id} className="hover:bg-[#0F1218] transition-colors">
                      <td className="px-3 py-2">
                        <div className="font-bold text-[#ECEEF2]">{u.name}</div>
                        <div className="text-[10px] text-slate-500 font-mono mt-0.5">{u.email}</div>
                        {u.phone && <div className="text-[10px] text-slate-500 font-mono mt-0.5">{u.phone}</div>}
                      </td>
                      <td className="px-3 py-2">
                        <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-[2px] text-[9px] font-bold uppercase border ${elevatedRoles.includes(u.role) ? 'bg-red-950/40 border-red-600/60 text-red-400' : 'bg-[#151922] border-[#2F3542] text-slate-300'}`}>
                          {roleIcons[u.role]} {roleLabels[u.role]}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <span className={`px-1.5 py-0.5 rounded-[2px] text-[9px] font-bold uppercase border ${statusStyles[u.status]}`}>
                          {getVerificationStatusLabel(u.status)}
                        </span>
                      </td>
                      <td className="px-3 py-2 font-mono text-[10px] text-slate-500">
                        <div>INIT: {u.joinDate}</div>
                        {u.lastLogin && <div>AUTH: {u.lastLogin}</div>}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {((isSuperAdmin && !isSelf) || (currentUser?.role === 'admin' && !elevatedRoles.includes(u.role) && !isSelf)) && (
                            <select
                              value={u.role}
                              onChange={(e) => void changeUserRole(u.id, e.target.value)}
                              disabled={actionId === u.id}
                              className="h-6 px-1 rounded-[2px] border border-[#252A35] bg-[#090D14] text-[9px] text-[#ECEEF2] uppercase font-bold tracking-wider"
                            >
                              {(isSuperAdmin ? allUserRoles : nonElevatedRoles).map(r => (
                                <option key={r} value={r}>{roleLabels[r]}</option>
                              ))}
                            </select>
                          )}
                          {(isSuperAdmin || (currentUser?.role === 'admin' && !elevatedRoles.includes(u.role))) && (
                            <button
                              onClick={() => void toggleStatus(u.id)}
                              disabled={actionId === u.id || isSelf}
                              className={`px-1.5 py-0.5 border text-[9px] font-bold rounded-[2px] transition-colors uppercase disabled:opacity-40 flex items-center gap-1 ${u.status === 'suspended' ? 'bg-emerald-950/40 border-emerald-600/60 text-emerald-400 hover:bg-emerald-900/60' : 'bg-red-950/40 border-red-600/60 text-red-400 hover:bg-red-900/60'}`}
                            >
                              {actionId === u.id ? <Loader className="w-2.5 h-2.5 animate-spin" /> : u.status === 'suspended' ? <CheckCircle className="w-2.5 h-2.5" /> : <Ban className="w-2.5 h-2.5" />}
                              {u.status === 'suspended' ? 'GRANT' : 'REVOKE'}
                            </button>
                          )}
                          {isSuperAdmin && u.role !== 'super_admin' && (
                            <button
                              onClick={() => setPendingDeleteUser(u)}
                              disabled={actionId === u.id || isSelf}
                              className="px-1.5 py-0.5 bg-red-950/40 border border-red-600/60 text-red-400 text-[9px] font-bold rounded-[2px] hover:bg-red-900/60 transition-colors uppercase disabled:opacity-40"
                            >
                              {actionId === u.id ? <Loader className="w-2.5 h-2.5 animate-spin" /> : <Trash2 className="w-2.5 h-2.5" />}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default UsersPage;
