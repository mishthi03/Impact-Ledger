import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import type { BudgetLine, BudgetSummary, Category, Project, Funding } from '@/types';
import { formatCurrency, formatDate } from '@/lib/format';
import { canEdit } from '@/lib/ui';
import { LoadingSpinner, ErrorState, EmptyState } from '@/components/States';
import ProgressBar from '@/components/ProgressBar';
import Modal from '@/components/Modal';
import PageHero from '@/components/PageHero';
import { Field, TextInput, TextArea, Select } from '@/components/FormFields';
import {
  Plus,
  Pencil,
  Wallet,
  Trash2,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';

interface BudgetRow extends BudgetSummary {
  project?: Project;
  category?: Category;
  budget_line: BudgetLine;
}

interface BudgetForm {
  project_id: string;
  category_id: string;
  funding_id: string;
  allocated_amount: string;
  period_start: string;
  period_end: string;
  notes: string;
}

const emptyForm: BudgetForm = {
  project_id: '',
  category_id: '',
  funding_id: '',
  allocated_amount: '',
  period_start: '',
  period_end: '',
  notes: '',
};

export default function BudgetsPage() {
  const { role, user } = useAuth();
  const editable = canEdit(role);

  const [rows, setRows] = useState<BudgetRow[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [fundingOptions, setFundingOptions] = useState<(Funding & { funder?: { name: string } })[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingLine, setEditingLine] = useState<BudgetLine | null>(null);
  const [form, setForm] = useState<BudgetForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [collapsedProjects, setCollapsedProjects] = useState<Set<string>>(new Set());

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);

    const [summaryRes, budgetRes, projRes, catRes, fundingRes] = await Promise.all([
      supabase.from('budget_summary').select('*'),
      supabase.from('budget_lines').select('*').order('created_at', { ascending: false }),
      supabase.from('projects').select('*').order('name'),
      supabase.from('categories').select('*').order('name'),
      supabase.from('funding').select('*, funder:funders(name)'),
    ]);

    if (summaryRes.error || budgetRes.error || projRes.error || catRes.error || fundingRes.error) {
      setError('Unable to load budget data. Please try again.');
      setLoading(false);
      return;
    }

    const summaries = summaryRes.data as BudgetSummary[];
    const budgetLines = budgetRes.data as BudgetLine[];
    const projectList = projRes.data as Project[];
    const catList = catRes.data as Category[];

    setProjects(projectList);
    setCategories(catList);
    setFundingOptions(fundingRes.data as (Funding & { funder?: { name: string } })[]);

    const summaryByLineId = new Map(summaries.map((s) => [s.budget_line_id, s]));

    const enriched: BudgetRow[] = budgetLines.map((bl) => {
      const s = summaryByLineId.get(bl.id) ?? {
        budget_line_id: bl.id,
        project_id: bl.project_id,
        category_id: bl.category_id,
        allocated_amount: bl.allocated_amount,
        submitted_total: '0',
        approved_total: '0',
        remaining: bl.allocated_amount,
        overspend: '0',
        is_overspent: false,
      };
      return {
        ...s,
        project: projectList.find((p) => p.id === bl.project_id),
        category: catList.find((c) => c.id === bl.category_id),
        budget_line: bl,
      };
    });

    setRows(enriched);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const groupedByProject = useMemo(() => {
    const map = new Map<string, { project: Project; rows: BudgetRow[] }>();
    rows.forEach((r) => {
      if (!r.project) return;
      const existing = map.get(r.project.id);
      if (existing) {
        existing.rows.push(r);
      } else {
        map.set(r.project.id, { project: r.project, rows: [r] });
      }
    });
    return Array.from(map.values());
  }, [rows]);

  function toggleProject(projectId: string) {
    setCollapsedProjects((prev) => {
      const next = new Set(prev);
      if (next.has(projectId)) next.delete(projectId);
      else next.add(projectId);
      return next;
    });
  }

  function openCreate() {
    setEditingLine(null);
    setForm(emptyForm);
    setFormError(null);
    setModalOpen(true);
  }

  function openEdit(line: BudgetLine) {
    setEditingLine(line);
    setForm({
      project_id: line.project_id,
      category_id: line.category_id,
      funding_id: line.funding_id ?? '',
      allocated_amount: String(line.allocated_amount),
      period_start: line.period_start ?? '',
      period_end: line.period_end ?? '',
      notes: line.notes ?? '',
    });
    setFormError(null);
    setModalOpen(true);
  }

  async function handleSave() {
    if (!form.project_id || !form.category_id || !form.allocated_amount) {
      setFormError('Project, category, and allocated amount are required.');
      return;
    }
    const amount = parseFloat(form.allocated_amount);
    if (isNaN(amount) || amount <= 0) {
      setFormError('Allocated amount must be a positive number.');
      return;
    }

    setSaving(true);
    setFormError(null);

    const payload = {
      project_id: form.project_id,
      category_id: form.category_id,
      funding_id: form.funding_id || null,
      allocated_amount: amount,
      period_start: form.period_start || null,
      period_end: form.period_end || null,
      notes: form.notes.trim() || null,
      created_by: editingLine ? undefined : user?.id,
    };

    let result;
    if (editingLine) {
      result = await supabase.from('budget_lines').update(payload).eq('id', editingLine.id);
    } else {
      result = await supabase.from('budget_lines').insert(payload);
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

  async function handleDeactivate(line: BudgetLine) {
    if (!confirm('Deactivate this budget line? It will be hidden from active lists.')) return;
    const { error: updateError } = await supabase
      .from('budget_lines')
      .update({ is_deleted: true, updated_at: new Date().toISOString() })
      .eq('id', line.id);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    loadData();
  }

  const availableFunding = fundingOptions.filter((f) => f.project_id === form.project_id);

  return (
    <div className="space-y-6">
      <PageHero
        title="Budget Lines"
        description="Allocated budgets by project and category, with spend tracking."
        imageUrl="https://images.pexels.com/photos/3184465/pexels-photo-3184465.jpeg?auto=compress&cs=tinysrgb&h=300&w=1200"
        action={editable ? (
          <button
            onClick={openCreate}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-white font-medium text-sm btn-coral"
          >
            <Plus size={18} /> New Budget Line
          </button>
        ) : undefined}
      />

      {loading && <LoadingSpinner label="Loading budget lines..." />}
      {error && <ErrorState message={error} onRetry={loadData} />}
      {!loading && !error && rows.length === 0 && (
        <EmptyState message="No budget lines yet." icon={Wallet} />
      )}

      {!loading && !error && groupedByProject.length > 0 && (
        <div className="space-y-4">
          {groupedByProject.map(({ project, rows: projectRows }) => {
            const collapsed = collapsedProjects.has(project.id);
            const totalAllocated = projectRows.reduce((s, r) => s + parseFloat(r.allocated_amount), 0);
            const totalApproved = projectRows.reduce((s, r) => s + parseFloat(r.approved_total), 0);
            const totalRemaining = projectRows.reduce((s, r) => s + parseFloat(r.remaining), 0);
            const hasOverspend = projectRows.some((r) => r.is_overspent);

            return (
              <div key={project.id} className="card-no-hover overflow-hidden">
                {/* Project group header */}
                <button
                  onClick={() => toggleProject(project.id)}
                  className="w-full flex items-center justify-between px-5 py-4 hover:bg-stone-50/60 transition"
                >
                  <div className="flex items-center gap-3">
                    {collapsed ? (
                      <ChevronRight size={18} className="text-stone-400" />
                    ) : (
                      <ChevronDown size={18} className="text-stone-400" />
                    )}
                    <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-teal-400 to-teal-500 flex items-center justify-center text-white shadow-sm">
                      <Wallet size={18} />
                    </div>
                    <div className="text-left">
                      <p className="font-semibold text-stone-800">{project.name}</p>
                      <p className="text-xs text-stone-400">{project.code} · {projectRows.length} {projectRows.length === 1 ? 'line' : 'lines'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-5 text-sm">
                    <div className="text-right">
                      <p className="text-xs text-stone-400">Allocated</p>
                      <p className="font-semibold text-stone-700">{formatCurrency(totalAllocated)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-stone-400">Approved</p>
                      <p className="font-semibold text-stone-700">{formatCurrency(totalApproved)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-stone-400">Remaining</p>
                      <p className={`font-semibold ${totalRemaining < 0 ? 'text-red-600' : 'text-stone-700'}`}>
                        {formatCurrency(totalRemaining)}
                      </p>
                    </div>
                    {hasOverspend && (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-red-700 bg-red-100 px-2.5 py-1 rounded-full">
                        <AlertTriangle size={12} /> Overspent
                      </span>
                    )}
                  </div>
                </button>

                {/* Lines table */}
                {!collapsed && (
                  <div className="border-t border-stone-100 overflow-x-auto">
                    <table className="w-full text-sm zebra-table">
                      <thead>
                        <tr className="text-stone-500 text-xs uppercase tracking-wide bg-stone-50/80">
                          <th className="text-left px-5 py-2.5 font-medium">Category</th>
                          <th className="text-right px-5 py-2.5 font-medium">Allocated</th>
                          <th className="text-right px-5 py-2.5 font-medium">Approved</th>
                          <th className="text-right px-5 py-2.5 font-medium">Remaining</th>
                          <th className="text-left px-5 py-2.5 font-medium w-40">Progress</th>
                          <th className="text-center px-5 py-2.5 font-medium">Status</th>
                          {editable && <th className="text-center px-5 py-2.5 font-medium">Actions</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {projectRows.map((r) => {
                          const remaining = parseFloat(r.remaining);
                          const approved = parseFloat(r.approved_total);
                          const allocated = parseFloat(r.allocated_amount);
                          const pct = allocated > 0 ? Math.min((approved / allocated) * 100, 100) : 0;
                          return (
                            <tr key={r.budget_line_id} className="transition">
                              <td className="px-5 py-3">
                                <span className="text-stone-700 font-medium">{r.category?.name ?? '—'}</span>
                                {r.budget_line.notes && (
                                  <p className="text-xs text-stone-400 mt-0.5 truncate max-w-xs">{r.budget_line.notes}</p>
                                )}
                              </td>
                              <td className="px-5 py-3 text-right text-stone-700 font-medium">{formatCurrency(allocated)}</td>
                              <td className="px-5 py-3 text-right text-stone-600">{formatCurrency(approved)}</td>
                              <td className={`px-5 py-3 text-right font-medium ${remaining < 0 ? 'text-red-600' : 'text-stone-700'}`}>
                                {formatCurrency(remaining)}
                              </td>
                              <td className="px-5 py-3">
                                <ProgressBar value={approved} max={allocated} />
                                <span className="text-xs text-stone-400 mt-1 block">{pct.toFixed(0)}% used</span>
                              </td>
                              <td className="px-5 py-3 text-center">
                                {r.is_overspent ? (
                                  <span className="inline-flex items-center gap-1 text-xs font-medium text-red-700 bg-red-100 px-2.5 py-1 rounded-full">
                                    <AlertTriangle size={12} /> Overspent
                                  </span>
                                ) : approved > 0 ? (
                                  <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-100 px-2.5 py-1 rounded-full">
                                    On Track
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-xs font-medium text-stone-500 bg-stone-100 px-2.5 py-1 rounded-full">
                                    Not Started
                                  </span>
                                )}
                              </td>
                              {editable && (
                                <td className="px-5 py-3 text-center">
                                  <div className="flex items-center justify-center gap-3">
                                    <button
                                      onClick={() => openEdit(r.budget_line)}
                                      className="text-stone-500 hover:text-teal-700 transition"
                                      title="Edit"
                                    >
                                      <Pencil size={15} />
                                    </button>
                                    <button
                                      onClick={() => handleDeactivate(r.budget_line)}
                                      className="text-stone-500 hover:text-red-600 transition"
                                      title="Deactivate"
                                    >
                                      <Trash2 size={15} />
                                    </button>
                                  </div>
                                </td>
                              )}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
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
        title={editingLine ? 'Edit Budget Line' : 'New Budget Line'}
        size="lg"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Project" required>
              <Select
                value={form.project_id}
                onChange={(e) => setForm({ ...form, project_id: e.target.value, funding_id: '' })}
              >
                <option value="">Select project...</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </Select>
            </Field>
            <Field label="Category" required>
              <Select
                value={form.category_id}
                onChange={(e) => setForm({ ...form, category_id: e.target.value })}
              >
                <option value="">Select category...</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </Select>
            </Field>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Allocated Amount (INR)" required>
              <TextInput
                type="number"
                step="0.01"
                min="0"
                value={form.allocated_amount}
                onChange={(e) => setForm({ ...form, allocated_amount: e.target.value })}
                placeholder="0.00"
              />
            </Field>
            <Field label="Funding Source (optional)">
              <Select
                value={form.funding_id}
                onChange={(e) => setForm({ ...form, funding_id: e.target.value })}
                disabled={!form.project_id}
              >
                <option value="">None</option>
                {availableFunding.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.funder?.name ?? 'Unknown'} — {formatCurrency(parseFloat(f.amount))} ({formatDate(f.funding_date)})
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Period Start">
              <TextInput
                type="date"
                value={form.period_start}
                onChange={(e) => setForm({ ...form, period_start: e.target.value })}
              />
            </Field>
            <Field label="Period End">
              <TextInput
                type="date"
                value={form.period_end}
                onChange={(e) => setForm({ ...form, period_end: e.target.value })}
              />
            </Field>
          </div>

          <Field label="Notes">
            <TextArea
              rows={2}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Budget line details, restrictions, etc."
            />
          </Field>

          {formError && (
            <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-2.5 text-sm text-red-700">
              {formError}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button
              onClick={() => setModalOpen(false)}
              className="px-4 py-2.5 rounded-xl text-sm font-medium text-stone-600 hover:bg-stone-100 transition"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-5 py-2.5 rounded-xl text-white text-sm font-semibold btn-teal disabled:opacity-60"
            >
              {saving ? 'Saving...' : editingLine ? 'Save Changes' : 'Create Budget Line'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
