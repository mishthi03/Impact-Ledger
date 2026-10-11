import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import type { Funder } from '@/types';
import { formatCurrency } from '@/lib/format';
import { funderTypeConfig, canEdit } from '@/lib/ui';
import { LoadingSpinner, ErrorState, EmptyState } from '@/components/States';
import Modal from '@/components/Modal';
import PageHero from '@/components/PageHero';
import { Field, TextInput, TextArea, Select } from '@/components/FormFields';
import {
  Plus,
  Pencil,
  Building2,
  Mail,
  Phone,
  Trash2,
  DollarSign,
} from 'lucide-react';

interface FunderWithTotal extends Funder {
  totalFunded: number;
}

interface FunderForm {
  name: string;
  funder_type: 'government' | 'foundation' | 'corporate' | 'individual' | 'other';
  contact_person: string;
  contact_email: string;
  contact_phone: string;
  notes: string;
}

const emptyForm: FunderForm = {
  name: '', funder_type: 'foundation', contact_person: '', contact_email: '', contact_phone: '', notes: '',
};

export default function FundersPage() {
  const { role, user } = useAuth();
  const editable = canEdit(role);

  const [funders, setFunders] = useState<FunderWithTotal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingFunder, setEditingFunder] = useState<Funder | null>(null);
  const [form, setForm] = useState<FunderForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [fundRes, fundingRes] = await Promise.all([
      supabase.from('funders').select('*').order('name'),
      supabase.from('funding').select('funder_id, amount'),
    ]);

    if (fundRes.error || fundingRes.error) {
      setError('Unable to load funders. Please try again.');
      setLoading(false);
      return;
    }

    const totalMap = new Map<string, number>();
    (fundingRes.data ?? []).forEach((f) => {
      const cur = totalMap.get(f.funder_id) ?? 0;
      totalMap.set(f.funder_id, cur + parseFloat(String(f.amount)));
    });

    const enriched: FunderWithTotal[] = (fundRes.data as Funder[]).map((f) => ({
      ...f,
      totalFunded: totalMap.get(f.id) ?? 0,
    }));

    setFunders(enriched);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  function openCreate() {
    setEditingFunder(null);
    setForm(emptyForm);
    setFormError(null);
    setModalOpen(true);
  }

  function openEdit(funder: Funder) {
    setEditingFunder(funder);
    setForm({
      name: funder.name,
      funder_type: funder.funder_type,
      contact_person: funder.contact_person ?? '',
      contact_email: funder.contact_email ?? '',
      contact_phone: funder.contact_phone ?? '',
      notes: funder.notes ?? '',
    });
    setFormError(null);
    setModalOpen(true);
  }

  async function handleSave() {
    if (!form.name.trim()) {
      setFormError('Funder name is required.');
      return;
    }
    setSaving(true);
    setFormError(null);

    const payload = {
      name: form.name.trim(),
      funder_type: form.funder_type,
      contact_person: form.contact_person.trim() || null,
      contact_email: form.contact_email.trim() || null,
      contact_phone: form.contact_phone.trim() || null,
      notes: form.notes.trim() || null,
      created_by: editingFunder ? undefined : user?.id,
    };

    let result;
    if (editingFunder) {
      result = await supabase.from('funders').update(payload).eq('id', editingFunder.id);
    } else {
      result = await supabase.from('funders').insert(payload);
    }

    if (result.error) {
      setFormError(result.error.message);
      setSaving(false);
      return;
    }

    setSaving(false);
    setModalOpen(false);
    loadData();
  }

  async function handleDeactivate(funder: Funder) {
    if (!confirm(`Deactivate funder "${funder.name}"? It will be hidden from active lists.`)) return;
    const { error: updateError } = await supabase
      .from('funders')
      .update({ is_deleted: true, updated_at: new Date().toISOString() })
      .eq('id', funder.id);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    loadData();
  }

  return (
    <div className="space-y-6">
      <PageHero
        title="Funders"
        description="Organizations that provide funding to your projects."
        imageUrl="https://images.pexels.com/photos/3184465/pexels-photo-3184465.jpeg?auto=compress&cs=tinysrgb&h=300&w=1200"
        action={editable ? (
          <button
            onClick={openCreate}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-white font-medium text-sm btn-coral"
          >
            <Plus size={18} /> New Funder
          </button>
        ) : undefined}
      />

      {loading && <LoadingSpinner label="Loading funders..." />}
      {error && <ErrorState message={error} onRetry={loadData} />}
      {!loading && !error && funders.length === 0 && (
        <EmptyState message="No funders yet." icon={Building2} />
      )}

      {!loading && !error && funders.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {funders.map((funder) => {
            const ft = funderTypeConfig[funder.funder_type];
            return (
              <div
                key={funder.id}
                className="card-base p-5"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-teal-400 to-teal-500 flex items-center justify-center text-white shadow-sm">
                      <Building2 size={22} />
                    </div>
                    <div>
                      <h3 className="font-semibold text-stone-800 leading-tight">{funder.name}</h3>
                      <span className={`inline-block text-xs px-2 py-0.5 rounded-full mt-1 ${ft.badge}`}>
                        {ft.label}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 space-y-2">
                  {funder.contact_person && (
                    <p className="text-sm text-stone-600">{funder.contact_person}</p>
                  )}
                  {funder.contact_email && (
                    <p className="text-sm text-stone-500 flex items-center gap-2">
                      <Mail size={14} className="text-stone-400" /> {funder.contact_email}
                    </p>
                  )}
                  {funder.contact_phone && (
                    <p className="text-sm text-stone-500 flex items-center gap-2">
                      <Phone size={14} className="text-stone-400" /> {funder.contact_phone}
                    </p>
                  )}
                </div>

                <div className="mt-4 pt-4 border-t border-stone-100">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-stone-500 flex items-center gap-1.5">
                      <DollarSign size={14} className="text-teal-600" /> Total Funded
                    </span>
                    <span className="font-semibold text-stone-800">{formatCurrency(funder.totalFunded)}</span>
                  </div>
                </div>

                {editable && (
                  <div className="mt-4 flex items-center gap-2 pt-3 border-t border-stone-100">
                    <button
                      onClick={() => openEdit(funder)}
                      className="inline-flex items-center gap-1.5 text-sm text-stone-600 hover:text-teal-700 transition"
                    >
                      <Pencil size={14} /> Edit
                    </button>
                    <button
                      onClick={() => handleDeactivate(funder)}
                      className="inline-flex items-center gap-1.5 text-sm text-stone-600 hover:text-red-600 transition ml-auto"
                    >
                      <Trash2 size={14} /> Deactivate
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingFunder ? 'Edit Funder' : 'New Funder'}
        size="lg"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Funder Name" required>
              <TextInput
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. USAID India"
              />
            </Field>
            <Field label="Funder Type">
              <Select
                value={form.funder_type}
                onChange={(e) => setForm({ ...form, funder_type: e.target.value as FunderForm['funder_type'] })}
              >
                <option value="government">Government</option>
                <option value="foundation">Foundation</option>
                <option value="corporate">Corporate</option>
                <option value="individual">Individual</option>
                <option value="other">Other</option>
              </Select>
            </Field>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Field label="Contact Person">
              <TextInput
                value={form.contact_person}
                onChange={(e) => setForm({ ...form, contact_person: e.target.value })}
                placeholder="Name"
              />
            </Field>
            <Field label="Contact Email">
              <TextInput
                type="email"
                value={form.contact_email}
                onChange={(e) => setForm({ ...form, contact_email: e.target.value })}
                placeholder="email@example.org"
              />
            </Field>
            <Field label="Contact Phone">
              <TextInput
                value={form.contact_phone}
                onChange={(e) => setForm({ ...form, contact_phone: e.target.value })}
                placeholder="+91-..."
              />
            </Field>
          </div>

          <Field label="Notes">
            <TextArea
              rows={3}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Agreement details, funding focus, etc."
            />
          </Field>

          {formError && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-2.5 text-sm text-red-700">
              {formError}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button
              onClick={() => setModalOpen(false)}
              className="px-4 py-2.5 rounded-lg text-sm font-medium text-stone-600 hover:bg-stone-100 transition"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-5 py-2.5 rounded-xl text-white text-sm font-semibold btn-teal disabled:opacity-60"
            >
              {saving ? 'Saving...' : editingFunder ? 'Save Changes' : 'Create Funder'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
