import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import type { Profile, Role } from '@/types';
import { roleLabels, roleBadgeColors } from '@/lib/ui';
import { LoadingSpinner, ErrorState, EmptyState } from '@/components/States';
import Modal from '@/components/Modal';
import PageHero from '@/components/PageHero';
import { Field, TextInput, Select } from '@/components/FormFields';
import {
  UserPlus,
  Users,
  Search,
  Pencil,
  Ban,
  CheckCircle2,
  Shield,
  AlertTriangle,
} from 'lucide-react';

const allRoles: Role[] = ['admin', 'project_manager', 'finance_officer', 'reviewer'];

interface AddForm {
  full_name: string;
  email: string;
  password: string;
  role: Role;
}

const emptyAddForm: AddForm = {
  full_name: '',
  email: '',
  password: '',
  role: 'finance_officer',
};

interface EditForm {
  id: string;
  full_name: string;
  role: Role;
}

export default function UsersPage() {
  const { user } = useAuth();
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState<AddForm>(emptyAddForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [editTarget, setEditTarget] = useState<EditForm | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<{
    profile: Profile;
    action: 'deactivate' | 'reactivate';
  } | null>(null);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error } = await supabase.from('profiles').select('*').order('full_name');
    if (error) {
      setError('Unable to load users. Please try again.');
      setLoading(false);
      return;
    }
    setUsers(data as Profile[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const filtered = useMemo(() => {
    if (!search.trim()) return users;
    const q = search.toLowerCase();
    return users.filter(
      (u) =>
        u.full_name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q)
    );
  }, [users, search]);

  async function handleAddUser() {
    if (!addForm.full_name.trim() || !addForm.email.trim() || !addForm.password.trim()) {
      setFormError('All fields are required.');
      return;
    }
    if (addForm.password.length < 6) {
      setFormError('Password must be at least 6 characters.');
      return;
    }

    setSaving(true);
    setFormError(null);

    try {
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/manage-users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
        },
        body: JSON.stringify({
          action: 'create',
          email: addForm.email.trim(),
          password: addForm.password,
          full_name: addForm.full_name.trim(),
          role: addForm.role,
        }),
      });

      const result = await res.json();

      if (!res.ok) {
        setFormError(result.error || 'Failed to create user.');
        setSaving(false);
        return;
      }

      setSaving(false);
      setAddOpen(false);
      setAddForm(emptyAddForm);
      loadUsers();
    } catch {
      setFormError('Network error. Please try again.');
      setSaving(false);
    }
  }

  async function handleEditUser() {
    if (!editTarget) return;
    if (!editTarget.full_name.trim()) {
      setEditError('Name is required.');
      return;
    }

    setEditSaving(true);
    setEditError(null);

    try {
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/manage-users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
        },
        body: JSON.stringify({
          action: 'update',
          id: editTarget.id,
          full_name: editTarget.full_name.trim(),
          role: editTarget.role,
        }),
      });

      const result = await res.json();

      if (!res.ok) {
        setEditError(result.error || 'Failed to update user.');
        setEditSaving(false);
        return;
      }

      setEditSaving(false);
      setEditTarget(null);
      loadUsers();
    } catch {
      setEditError('Network error. Please try again.');
      setEditSaving(false);
    }
  }

  async function handleToggleActive() {
    if (!confirmAction) return;
    const { profile: target, action } = confirmAction;

    try {
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/manage-users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
        },
        body: JSON.stringify({
          action: 'update',
          id: target.id,
          is_active: action === 'reactivate',
        }),
      });

      const result = await res.json();

      if (!res.ok) {
        setError(result.error || 'Failed to update user status.');
        setConfirmAction(null);
        return;
      }

      setConfirmAction(null);
      loadUsers();
    } catch {
      setError('Network error. Please try again.');
      setConfirmAction(null);
    }
  }

  function openEdit(p: Profile) {
    setEditTarget({ id: p.id, full_name: p.full_name, role: p.role });
    setEditError(null);
  }

  return (
    <div className="space-y-6">
      <PageHero
        title="Users"
        description="Manage user accounts, roles, and access."
        imageUrl="https://images.pexels.com/photos/3184360/pexels-photo-3184360.jpeg?auto=compress&cs=tinysrgb&h=300&w=1200"
        action={
          <button
            onClick={() => { setAddForm(emptyAddForm); setFormError(null); setAddOpen(true); }}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-white font-medium text-sm btn-coral"
          >
            <UserPlus size={18} /> Add User
          </button>
        }
      />

      {/* Search */}
      <div className="card-no-hover p-4 flex flex-col sm:flex-row gap-3 sm:items-center">
        <div className="relative flex-1">
          <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name or email..."
            className="w-full pl-11 pr-4 py-2.5 rounded-xl border border-stone-200 bg-stone-50/50 text-stone-800 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-teal-600 focus:bg-white focus:border-transparent transition text-sm"
          />
        </div>
      </div>

      {loading && <LoadingSpinner label="Loading users..." />}
      {error && <ErrorState message={error} onRetry={loadUsers} />}
      {!loading && !error && filtered.length === 0 && (
        <EmptyState message="No users found." icon={Users} />
      )}

      {!loading && !error && filtered.length > 0 && (
        <div className="card-no-hover overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm zebra-table">
              <thead>
                <tr className="text-stone-500 text-xs uppercase tracking-wide bg-stone-50/80">
                  <th className="text-left px-5 py-3 font-medium">Name</th>
                  <th className="text-left px-5 py-3 font-medium">Email</th>
                  <th className="text-left px-5 py-3 font-medium">Role</th>
                  <th className="text-center px-5 py-3 font-medium">Status</th>
                  <th className="text-center px-5 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((u) => {
                  const isSelf = u.id === user?.id;
                  return (
                    <tr key={u.id}>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-teal-400 to-teal-600 flex items-center justify-center text-white font-semibold text-sm flex-shrink-0">
                            {u.full_name?.charAt(0) ?? '?'}
                          </div>
                          <div>
                            <p className="font-medium text-stone-700">{u.full_name}</p>
                            {isSelf && <p className="text-xs text-teal-600">You</p>}
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-stone-600">{u.email}</td>
                      <td className="px-5 py-3.5">
                        <span className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full ${roleBadgeColors[u.role]}`}>
                          <Shield size={11} />
                          {roleLabels[u.role]}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-center">
                        {u.is_active ? (
                          <span className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700">
                            <CheckCircle2 size={11} /> Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full bg-stone-200 text-stone-600">
                            <Ban size={11} /> Deactivated
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => openEdit(u)}
                            className="inline-flex items-center gap-1 text-xs font-medium text-teal-700 hover:text-teal-800 transition"
                          >
                            <Pencil size={13} /> Edit
                          </button>
                          {!isSelf && (
                            u.is_active ? (
                              <button
                                onClick={() => setConfirmAction({ profile: u, action: 'deactivate' })}
                                className="inline-flex items-center gap-1 text-xs font-medium text-red-600 hover:text-red-700 transition"
                              >
                                <Ban size={13} /> Deactivate
                              </button>
                            ) : (
                              <button
                                onClick={() => setConfirmAction({ profile: u, action: 'reactivate' })}
                                className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 hover:text-emerald-700 transition"
                              >
                                <CheckCircle2 size={13} /> Reactivate
                              </button>
                            )
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add User Modal */}
      <Modal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="Add User"
        size="md"
      >
        <div className="space-y-4">
          <Field label="Full Name" required>
            <TextInput
              value={addForm.full_name}
              onChange={(e) => setAddForm({ ...addForm, full_name: e.target.value })}
              placeholder="Jane Doe"
            />
          </Field>
          <Field label="Email" required>
            <TextInput
              type="email"
              value={addForm.email}
              onChange={(e) => setAddForm({ ...addForm, email: e.target.value })}
              placeholder="jane@asha.org"
            />
          </Field>
          <Field label="Password" required>
            <TextInput
              type="password"
              value={addForm.password}
              onChange={(e) => setAddForm({ ...addForm, password: e.target.value })}
              placeholder="Minimum 6 characters"
            />
          </Field>
          <Field label="Role" required>
            <Select
              value={addForm.role}
              onChange={(e) => setAddForm({ ...addForm, role: e.target.value as Role })}
            >
              {allRoles.map((r) => (
                <option key={r} value={r}>{roleLabels[r]}</option>
              ))}
            </Select>
          </Field>

          {formError && (
            <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-2.5 text-sm text-red-700">
              {formError}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button
              onClick={() => setAddOpen(false)}
              className="px-4 py-2.5 rounded-xl text-sm font-medium text-stone-600 hover:bg-stone-100 transition"
            >
              Cancel
            </button>
            <button
              onClick={handleAddUser}
              disabled={saving}
              className="px-5 py-2.5 rounded-xl text-white text-sm font-semibold btn-teal disabled:opacity-60"
            >
              {saving ? 'Creating...' : 'Create User'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Edit User Modal */}
      <Modal
        open={!!editTarget}
        onClose={() => setEditTarget(null)}
        title="Edit User"
        size="md"
      >
        {editTarget && (
          <div className="space-y-4">
            <Field label="Full Name" required>
              <TextInput
                value={editTarget.full_name}
                onChange={(e) => setEditTarget({ ...editTarget, full_name: e.target.value })}
              />
            </Field>
            <Field label="Role" required>
              <Select
                value={editTarget.role}
                onChange={(e) => setEditTarget({ ...editTarget, role: e.target.value as Role })}
                disabled={editTarget.id === user?.id}
              >
                {allRoles.map((r) => (
                  <option key={r} value={r}>{roleLabels[r]}</option>
                ))}
              </Select>
              {editTarget.id === user?.id && (
                <p className="text-xs text-stone-400 mt-1">You cannot change your own role.</p>
              )}
            </Field>

            {editError && (
              <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-2.5 text-sm text-red-700">
                {editError}
              </div>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setEditTarget(null)}
                className="px-4 py-2.5 rounded-xl text-sm font-medium text-stone-600 hover:bg-stone-100 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleEditUser}
                disabled={editSaving}
                className="px-5 py-2.5 rounded-xl text-white text-sm font-semibold btn-teal disabled:opacity-60"
              >
                {editSaving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Confirm Deactivate/Reactivate */}
      <Modal
        open={!!confirmAction}
        onClose={() => setConfirmAction(null)}
        title={confirmAction?.action === 'deactivate' ? 'Deactivate User' : 'Reactivate User'}
        size="sm"
      >
        {confirmAction && (
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                confirmAction.action === 'deactivate' ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-600'
              }`}>
                {confirmAction.action === 'deactivate' ? <Ban size={20} /> : <CheckCircle2 size={20} />}
              </div>
              <div>
                <p className="text-sm text-stone-700">
                  {confirmAction.action === 'deactivate'
                    ? `Are you sure you want to deactivate ${confirmAction.profile.full_name}? They will no longer be able to sign in.`
                    : `Reactivate ${confirmAction.profile.full_name}? They will be able to sign in again.`}
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setConfirmAction(null)}
                className="px-4 py-2.5 rounded-xl text-sm font-medium text-stone-600 hover:bg-stone-100 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleToggleActive}
                className={`px-5 py-2.5 rounded-xl text-white text-sm font-semibold transition ${
                  confirmAction.action === 'deactivate'
                    ? 'bg-red-600 hover:bg-red-700'
                    : 'bg-emerald-600 hover:bg-emerald-700'
                }`}
              >
                {confirmAction.action === 'deactivate' ? 'Deactivate' : 'Reactivate'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
