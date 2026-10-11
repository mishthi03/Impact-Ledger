import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import type { Funding, Project, Funder } from '@/types';
import { formatCurrency, formatDate } from '@/lib/format';
import { funderTypeConfig, canEdit } from '@/lib/ui';
import { LoadingSpinner, ErrorState, EmptyState } from '@/components/States';
import Modal from '@/components/Modal';
import PageHero from '@/components/PageHero';
import { Field, TextInput, TextArea, Select } from '@/components/FormFields';
import { Plus, Pencil, DollarSign } from 'lucide-react';

interface FundingRow extends Funding {
  project?: Project;
  funder?: Funder;
}

interface FundingForm {
  project_id: string;
  funder_id: string;
  amount: string;
  funding_date: string;
  reference_number: string;
  notes: string;
}

const emptyForm: FundingForm = {
  project_id: '', funder_id: '', amount: '', funding_date: '', reference_number: '', notes: '',
};

export default function FundingPage() {
  const { role, user } = useAuth();
  const editable = canEdit(role);

  const [funding, setFunding] = useState<FundingRow[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [funders, setFunders] = useState<Funder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingFunding, setEditingFunding] = useState<Funding | null>(null);
  const [form, setForm] = useState<FundingForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [fundRes, projRes, funderRes] = await Promise.all([
      supabase.from('funding').select('*, project:projects(*), funder:funders(*)').order('funding_date', { ascending: false }),
      supabase.from('projects').select('*').order('name'),
      supabase.from('funders').select('*').order('name'),
    ]);

    if (fundRes.error || projRes.error || funderRes.error) {
      setError('Unable to load funding data. Please try again.');
      setLoading(false);
      return;
    }

    setFunding(fundRes.data as FundingRow[]);
    setProjects(projRes.data as Project[]);
    setFunders(funderRes.data as Funder[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  function openCreate() {
    setEditingFunding(null);
    setForm({ ...emptyForm, funding_date: new Date().toISOString().split('T')[0] });
    setFormError(null);
    setModalOpen(true);
  }

  function openEdit(f: Funding) {
    setEditingFunding(f);
    setForm({
      project_id: f.project_id,
      funder_id: f.funder_id,
      amount: String(f.amount),
      funding_date: f.funding_date,
      reference_number: f.reference_number ?? '',
      notes: f.notes ?? '',
    });
    setFormError(null);
    setModalOpen(true);
  }

  async function handleSave() {
    if (!form.project_id || !form.funder_id || !form.amount || !form.funding_date) {
      setFormError('Project, funder, amount, and date are required.');
      return;
    }
    const amount = parseFloat(form.amount);
    if (isNaN(amount) || amount <= 0) {
      setFormError('Amount must be a positive number.');
      return;
    }

    setSaving(true);
    setFormError(null);

    const payload = {
      project_id: form.project_id,
      funder_id: form.funder_id,
      amount: amount,
      funding_date: form.funding_date,
      reference_number: form.reference_number.trim() || null,
      notes: form.notes.trim() || null,
      created_by: editingFunding ? undefined : user?.id,
    };

    let result;
    if (editingFunding) {
      result = await supabase.from('funding').update(payload).eq('id', editingFunding.id);
    } else {
      result = await supabase.from('funding').insert(payload);
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

  const totalFunding = funding.reduce((sum, f) => sum + parseFloat(f.amount), 0);

  return (
    <div className="space-y-6">
      <PageHero
        title="Funding"
        description="All funding received from funders for projects."
        imageUrl="https://images.pexels.com/photos/3184360/pexels-photo-3184360.jpeg?auto=compress&cs=tinysrgb&h=300&w=1200"
        action={editable ? (
          <button
            onClick={openCreate}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-white font-medium text-sm btn-coral"
          >
            <Plus size={18} /> New Funding Entry
          </button>
        ) : undefined}
      />

      {/* Total summary card */}
      <div className="rounded-2xl p-6 text-white shadow-sm" style={{ background: 'linear-gradient(135deg, #14919b, #0d4f4f)' }}>
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-white/15 flex items-center justify-center">
            <DollarSign size={24} />
          </div>
          <div>
            <p className="text-teal-100 text-sm">Total Funding Received</p>
            <p className="text-3xl font-bold mt-0.5">{formatCurrency(totalFunding)}</p>
          </div>
        </div>
      </div>

      {loading && <LoadingSpinner label="Loading funding..." />}
      {error && <ErrorState message={error} onRetry={loadData} />}
      {!loading && !error && funding.length === 0 && (
        <EmptyState message="No funding entries yet." icon={DollarSign} />
      )}

      {!loading && !error && funding.length > 0 && (
        <div className="card-no-hover overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm zebra-table">
              <thead>
                <tr className="bg-stone-50 text-stone-500 text-xs uppercase tracking-wide">
                  <th className="text-left px-5 py-3 font-medium">Funder</th>
                  <th className="text-left px-5 py-3 font-medium">Project</th>
                  <th className="text-right px-5 py-3 font-medium">Amount</th>
                  <th className="text-left px-5 py-3 font-medium">Date</th>
                  <th className="text-left px-5 py-3 font-medium">Reference</th>
                  {editable && <th className="text-center px-5 py-3 font-medium">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {funding.map((f) => {
                  const ft = f.funder ? funderTypeConfig[f.funder.funder_type] : null;
                  return (
                    <tr key={f.id} className="hover:bg-stone-50 transition">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2">
                          <div>
                            <p className="font-medium text-stone-800">{f.funder?.name ?? '—'}</p>
                            {ft && (
                              <span className={`text-xs px-1.5 py-0.5 rounded-full ${ft.badge}`}>
                                {ft.label}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <p className="text-stone-700 font-medium">{f.project?.name ?? '—'}</p>
                        <p className="text-xs text-stone-400">{f.project?.code}</p>
                      </td>
                      <td className="px-5 py-3.5 text-right text-stone-800 font-semibold">
                        {formatCurrency(parseFloat(f.amount))}
                      </td>
                      <td className="px-5 py-3.5 text-stone-500">{formatDate(f.funding_date)}</td>
                      <td className="px-5 py-3.5 text-stone-500 font-mono text-xs">
                        {f.reference_number ?? '—'}
                      </td>
                      {editable && (
                        <td className="px-5 py-3.5 text-center">
                          <button
                            onClick={() => openEdit(f)}
                            className="inline-flex items-center gap-1 text-stone-500 hover:text-teal-700 transition"
                          >
                            <Pencil size={15} /> Edit
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingFunding ? 'Edit Funding Entry' : 'New Funding Entry'}
        size="lg"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Project" required>
              <Select
                value={form.project_id}
                onChange={(e) => setForm({ ...form, project_id: e.target.value })}
              >
                <option value="">Select project...</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </Select>
            </Field>
            <Field label="Funder" required>
              <Select
                value={form.funder_id}
                onChange={(e) => setForm({ ...form, funder_id: e.target.value })}
              >
                <option value="">Select funder...</option>
                {funders.map((f) => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </Select>
            </Field>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Amount (INR)" required>
              <TextInput
                type="number"
                step="0.01"
                min="0"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                placeholder="0.00"
              />
            </Field>
            <Field label="Funding Date" required>
              <TextInput
                type="date"
                value={form.funding_date}
                onChange={(e) => setForm({ ...form, funding_date: e.target.value })}
              />
            </Field>
          </div>

          <Field label="Reference Number">
            <TextInput
              value={form.reference_number}
              onChange={(e) => setForm({ ...form, reference_number: e.target.value })}
              placeholder="e.g. USAID-EDU-2024-001"
            />
          </Field>

          <Field label="Notes">
            <TextArea
              rows={2}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Tranche details, conditions, etc."
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
              {saving ? 'Saving...' : editingFunding ? 'Save Changes' : 'Create Entry'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
