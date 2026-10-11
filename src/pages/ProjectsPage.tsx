import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import type { Project, Funder, Funding, BudgetLine, Category, Expense, BudgetSummary } from '@/types';
import { formatCurrency, formatCurrencyCompact, formatDate } from '@/lib/format';
import { projectStatusConfig, funderTypeConfig, expenseStatusConfig, canEdit } from '@/lib/ui';
import { LoadingSpinner, ErrorState, EmptyState } from '@/components/States';
import ProgressBar from '@/components/ProgressBar';
import Modal from '@/components/Modal';
import PageHero from '@/components/PageHero';
import { Field, TextInput, TextArea, Select } from '@/components/FormFields';
import {
  Plus,
  Pencil,
  ArrowLeft,
  MapPin,
  Calendar,
  Building2,
  Wallet,
  Receipt,
  TrendingUp,
  FolderKanban,
  Trash2,
} from 'lucide-react';

const projectImages: Record<string, string> = {
  'EDU-2024-01': 'https://images.pexels.com/photos/18012456/pexels-photo-18012456.jpeg?auto=compress&cs=tinysrgb&h=400&w=800',
  'LIV-2024-02': 'https://images.pexels.com/photos/33714914/pexels-photo-33714914.jpeg?auto=compress&cs=tinysrgb&h=400&w=800',
  'HLT-2024-03': 'https://images.pexels.com/photos/37285163/pexels-photo-37285163.jpeg?auto=compress&cs=tinysrgb&h=400&w=800',
  'DIG-2024-04': 'https://images.pexels.com/photos/5530483/pexels-photo-5530483.jpeg?auto=compress&cs=tinysrgb&h=400&w=800',
};

function getProjectImage(code: string): string {
  return projectImages[code] ?? 'https://images.pexels.com/photos/3184292/pexels-photo-3184292.jpeg?auto=compress&cs=tinysrgb&h=400&w=800';
}

interface ProjectWithStats extends Project {
  totalFunding: number;
  totalBudget: number;
  totalApproved: number;
}

interface ProjectForm {
  name: string;
  code: string;
  description: string;
  status: 'planning' | 'active' | 'closed' | 'on_hold';
  start_date: string;
  end_date: string;
  location: string;
}

const emptyForm: ProjectForm = {
  name: '', code: '', description: '', status: 'planning',
  start_date: '', end_date: '', location: '',
};

export default function ProjectsPage() {
  const { role, user } = useAuth();
  const editable = canEdit(role);

  const [projects, setProjects] = useState<ProjectWithStats[]>([]);
  const [funders, setFunders] = useState<Funder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedProject, setSelectedProject] = useState<ProjectWithStats | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [form, setForm] = useState<ProjectForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [projRes, fundRes, fundingRes, budgetRes, summaryRes] = await Promise.all([
      supabase.from('projects').select('*').order('created_at', { ascending: false }),
      supabase.from('funders').select('*'),
      supabase.from('funding').select('project_id, amount'),
      supabase.from('budget_lines').select('project_id, allocated_amount'),
      supabase.from('budget_summary').select('project_id, approved_total'),
    ]);

    if (projRes.error || fundRes.error || fundingRes.error || budgetRes.error || summaryRes.error) {
      setError('Unable to load projects. Please try again.');
      setLoading(false);
      return;
    }

    const allProjects = projRes.data as Project[];
    const fundingMap = new Map<string, number>();
    (fundingRes.data ?? []).forEach((f) => {
      const cur = fundingMap.get(f.project_id) ?? 0;
      fundingMap.set(f.project_id, cur + parseFloat(String(f.amount)));
    });
    const budgetMap = new Map<string, number>();
    (budgetRes.data ?? []).forEach((b) => {
      const cur = budgetMap.get(b.project_id) ?? 0;
      budgetMap.set(b.project_id, cur + parseFloat(String(b.allocated_amount)));
    });
    const approvedMap = new Map<string, number>();
    (summaryRes.data ?? []).forEach((s) => {
      const cur = approvedMap.get(s.project_id) ?? 0;
      approvedMap.set(s.project_id, cur + parseFloat(String(s.approved_total)));
    });

    const enriched: ProjectWithStats[] = allProjects.map((p) => ({
      ...p,
      totalFunding: fundingMap.get(p.id) ?? 0,
      totalBudget: budgetMap.get(p.id) ?? 0,
      totalApproved: approvedMap.get(p.id) ?? 0,
    }));

    setProjects(enriched);
    setFunders(fundRes.data as Funder[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  function openCreate() {
    setEditingProject(null);
    setForm(emptyForm);
    setFormError(null);
    setModalOpen(true);
  }

  function openEdit(project: Project) {
    setEditingProject(project);
    setForm({
      name: project.name,
      code: project.code,
      description: project.description ?? '',
      status: project.status,
      start_date: project.start_date ?? '',
      end_date: project.end_date ?? '',
      location: project.location ?? '',
    });
    setFormError(null);
    setModalOpen(true);
  }

  async function handleSave() {
    if (!form.name.trim() || !form.code.trim()) {
      setFormError('Project name and code are required.');
      return;
    }
    setSaving(true);
    setFormError(null);

    const payload = {
      name: form.name.trim(),
      code: form.code.trim().toUpperCase(),
      description: form.description.trim() || null,
      status: form.status,
      start_date: form.start_date || null,
      end_date: form.end_date || null,
      location: form.location.trim() || null,
      created_by: editingProject ? undefined : user?.id,
    };

    let result;
    if (editingProject) {
      result = await supabase.from('projects').update(payload).eq('id', editingProject.id);
    } else {
      result = await supabase.from('projects').insert(payload);
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

  async function handleDeactivate(project: Project) {
    if (!confirm(`Deactivate project "${project.name}"? It will be hidden from active lists.`)) return;
    const { error: updateError } = await supabase
      .from('projects')
      .update({ is_deleted: true, updated_at: new Date().toISOString() })
      .eq('id', project.id);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    loadData();
  }

  if (selectedProject) {
    return (
      <ProjectDetail
        project={selectedProject}
        funders={funders}
        onBack={() => setSelectedProject(null)}
        editable={editable}
        onEdit={() => {
          openEdit(selectedProject);
        }}
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHero
        title="Projects"
        description="All projects with funding, budget, and spend at a glance."
        imageUrl="https://images.pexels.com/photos/3184339/pexels-photo-3184339.jpeg?auto=compress&cs=tinysrgb&h=300&w=1200"
        action={editable ? (
          <button
            onClick={openCreate}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-white font-medium text-sm btn-coral"
          >
            <Plus size={18} /> New Project
          </button>
        ) : undefined}
      />

      {loading && <LoadingSpinner label="Loading projects..." />}
      {error && <ErrorState message={error} onRetry={loadData} />}
      {!loading && !error && projects.length === 0 && (
        <EmptyState message="No projects yet." icon={FolderKanban} />
      )}

      {!loading && !error && projects.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {projects.map((project) => {
            const status = projectStatusConfig[project.status];
            return (
              <div
                key={project.id}
                className="card-base overflow-hidden cursor-pointer group"
                onClick={() => setSelectedProject(project)}
              >
                <div className="relative h-40 overflow-hidden">
                  <img
                    src={getProjectImage(project.code)}
                    alt={project.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                  <span className={`absolute top-3 right-3 text-xs font-medium px-2.5 py-1 rounded-full ${status.badge}`}>
                    {status.label}
                  </span>
                  {project.location && (
                    <span className="absolute bottom-3 left-3 text-xs text-white/90 flex items-center gap-1">
                      <MapPin size={12} /> {project.location}
                    </span>
                  )}
                </div>

                <div className="p-5">
                  <h3 className="font-semibold text-stone-800 text-lg leading-snug">{project.name}</h3>
                  <p className="text-xs text-stone-400 mt-0.5">{project.code}</p>

                  <div className="mt-4 space-y-2.5">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-stone-500 flex items-center gap-1.5">
                        <TrendingUp size={14} className="text-teal-600" /> Funding
                      </span>
                      <span className="font-medium text-stone-700">{formatCurrency(project.totalFunding)}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-stone-500 flex items-center gap-1.5">
                        <Wallet size={14} className="text-blue-600" /> Budget
                      </span>
                      <span className="font-medium text-stone-700">{formatCurrency(project.totalBudget)}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-stone-500 flex items-center gap-1.5">
                        <Receipt size={14} className="text-emerald-600" /> Spent
                      </span>
                      <span className="font-medium text-stone-700">{formatCurrency(project.totalApproved)}</span>
                    </div>
                  </div>

                  <div className="mt-4">
                    <ProgressBar value={project.totalApproved} max={project.totalBudget} showLabel />
                  </div>

                  {editable && (
                    <div className="mt-4 flex items-center gap-2 pt-4 border-t border-stone-100">
                      <button
                        onClick={(e) => { e.stopPropagation(); openEdit(project); }}
                        className="inline-flex items-center gap-1.5 text-sm text-stone-600 hover:text-teal-700 transition"
                      >
                        <Pencil size={14} /> Edit
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDeactivate(project); }}
                        className="inline-flex items-center gap-1.5 text-sm text-stone-600 hover:text-red-600 transition ml-auto"
                      >
                        <Trash2 size={14} /> Deactivate
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingProject ? 'Edit Project' : 'New Project'}
        size="lg"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Project Name" required>
              <TextInput
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Rural School Support"
              />
            </Field>
            <Field label="Project Code" required>
              <TextInput
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
                placeholder="e.g. EDU-2025-01"
              />
            </Field>
          </div>

          <Field label="Description">
            <TextArea
              rows={3}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Brief description of the project..."
            />
          </Field>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Field label="Status">
              <Select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value as ProjectForm['status'] })}
              >
                <option value="planning">Planning</option>
                <option value="active">Active</option>
                <option value="on_hold">On Hold</option>
                <option value="closed">Closed</option>
              </Select>
            </Field>
            <Field label="Start Date">
              <TextInput
                type="date"
                value={form.start_date}
                onChange={(e) => setForm({ ...form, start_date: e.target.value })}
              />
            </Field>
            <Field label="End Date">
              <TextInput
                type="date"
                value={form.end_date}
                onChange={(e) => setForm({ ...form, end_date: e.target.value })}
              />
            </Field>
          </div>

          <Field label="Location">
            <TextInput
              value={form.location}
              onChange={(e) => setForm({ ...form, location: e.target.value })}
              placeholder="e.g. Rajasthan"
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
              {saving ? 'Saving...' : editingProject ? 'Save Changes' : 'Create Project'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ============================================================
// Project Detail View
// ============================================================
type DetailTab = 'overview' | 'funding' | 'budget' | 'expenses';

function ProjectDetail({
  project,
  funders,
  onBack,
  editable,
  onEdit,
}: {
  project: ProjectWithStats;
  funders: Funder[];
  onBack: () => void;
  editable: boolean;
  onEdit: () => void;
}) {
  const [tab, setTab] = useState<DetailTab>('overview');
  const [fundingList, setFundingList] = useState<(Funding & { funder?: Funder })[]>([]);
  const [budgetList, setBudgetList] = useState<(BudgetLine & { category?: Category })[]>([]);
  const [budgetSummaries, setBudgetSummaries] = useState<BudgetSummary[]>([]);
  const [expenseList, setExpenseList] = useState<(Expense & { category?: Category })[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDetail();
  }, [project.id]);

  async function loadDetail() {
    setLoading(true);
    const [fundRes, budgetRes, summaryRes, expRes, catRes] = await Promise.all([
      supabase.from('funding').select('*, funder:funders(*)').eq('project_id', project.id).order('funding_date'),
      supabase.from('budget_lines').select('*, category:categories(*)').eq('project_id', project.id),
      supabase.from('budget_summary').select('*').eq('project_id', project.id),
      supabase.from('expenses').select('*, budget_line:budget_lines(category_id:category_id)').eq('project_id', project.id).order('expense_date', { ascending: false }),
      supabase.from('categories').select('*'),
    ]);

    if (!fundRes.error) setFundingList(fundRes.data as (Funding & { funder?: Funder })[]);
    if (!budgetRes.error) setBudgetList(budgetRes.data as (BudgetLine & { category?: Category })[]);
    if (!summaryRes.error) setBudgetSummaries(summaryRes.data as BudgetSummary[]);
    if (!expRes.error) {
      const cats = catRes.data as Category[];
      setCategories(cats);
      const enriched = (expRes.data as any[]).map((e) => {
        const bl = e.budget_line;
        const catId = bl?.category_id;
        return { ...e, category: cats.find((c) => c.id === catId) };
      });
      setExpenseList(enriched as (Expense & { category?: Category })[]);
    }
    setLoading(false);
  }

  const status = projectStatusConfig[project.status];
  const tabs: { id: DetailTab; label: string; icon: typeof FolderKanban }[] = [
    { id: 'overview', label: 'Overview', icon: FolderKanban },
    { id: 'funding', label: 'Funding', icon: TrendingUp },
    { id: 'budget', label: 'Budget', icon: Wallet },
    { id: 'expenses', label: 'Expenses', icon: Receipt },
  ];

  return (
    <div className="space-y-6">
      <button
        onClick={onBack}
        className="inline-flex items-center gap-2 text-sm text-stone-500 hover:text-stone-700 transition"
      >
        <ArrowLeft size={16} /> Back to Projects
      </button>

      {/* Project header */}
      <div className="card-no-hover overflow-hidden">
        <div className="relative h-48 overflow-hidden">
          <img src={getProjectImage(project.code)} alt={project.name} className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 p-6">
            <div className="flex items-end justify-between">
              <div>
                <h1 className="text-2xl font-bold text-white">{project.name}</h1>
                <p className="text-white/70 text-sm mt-1">{project.code}</p>
              </div>
              <span className={`text-xs font-medium px-3 py-1 rounded-full ${status.badge}`}>
                {status.label}
              </span>
            </div>
          </div>
        </div>

        <div className="px-6 py-4 flex flex-wrap gap-6 text-sm">
          {project.location && (
            <span className="flex items-center gap-1.5 text-stone-500">
              <MapPin size={15} /> {project.location}
            </span>
          )}
          {project.start_date && (
            <span className="flex items-center gap-1.5 text-stone-500">
              <Calendar size={15} /> {formatDate(project.start_date)} — {formatDate(project.end_date)}
            </span>
          )}
          {editable && (
            <button
              onClick={onEdit}
              className="ml-auto inline-flex items-center gap-1.5 text-sm text-teal-700 hover:text-teal-800 transition font-medium"
            >
              <Pencil size={15} /> Edit Project
            </button>
          )}
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-stone-200 p-5">
          <div className="flex items-center gap-2 text-stone-500 text-sm">
            <TrendingUp size={16} className="text-teal-600" /> Total Funding
          </div>
          <p className="text-2xl font-bold text-stone-800 mt-1">{formatCurrency(project.totalFunding)}</p>
        </div>
        <div className="bg-white rounded-xl border border-stone-200 p-5">
          <div className="flex items-center gap-2 text-stone-500 text-sm">
            <Wallet size={16} className="text-blue-600" /> Total Budget
          </div>
          <p className="text-2xl font-bold text-stone-800 mt-1">{formatCurrency(project.totalBudget)}</p>
        </div>
        <div className="bg-white rounded-xl border border-stone-200 p-5">
          <div className="flex items-center gap-2 text-stone-500 text-sm">
            <Receipt size={16} className="text-emerald-600" /> Approved Spend
          </div>
          <p className="text-2xl font-bold text-stone-800 mt-1">{formatCurrency(project.totalApproved)}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="card-no-hover overflow-hidden">
        <div className="flex border-b border-stone-100 overflow-x-auto">
          {tabs.map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-2 px-5 py-3.5 text-sm font-medium transition border-b-2 whitespace-nowrap ${
                  tab === t.id
                    ? 'border-teal-600 text-teal-700'
                    : 'border-transparent text-stone-500 hover:text-stone-700 hover:bg-stone-50'
                }`}
              >
                <Icon size={16} /> {t.label}
              </button>
            );
          })}
        </div>

        <div className="p-6">
          {loading ? (
            <LoadingSpinner label="Loading details..." />
          ) : tab === 'overview' ? (
            <div className="space-y-5">
              {project.description && (
                <div>
                  <h3 className="text-sm font-semibold text-stone-500 uppercase tracking-wide mb-2">Description</h3>
                  <p className="text-stone-700 leading-relaxed">{project.description}</p>
                </div>
              )}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <StatBox label="Funding Entries" value={String(fundingList.length)} />
                <StatBox label="Budget Lines" value={String(budgetList.length)} />
                <StatBox label="Total Expenses" value={String(expenseList.length)} />
                <StatBox
                  label="Overspent Lines"
                  value={String(budgetSummaries.filter((b) => b.is_overspent).length)}
                />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-stone-500 uppercase tracking-wide mb-3">Budget Utilization</h3>
                <div className="space-y-3">
                  {budgetSummaries.map((bs) => {
                    const cat = budgetList.find((bl) => bl.id === bs.budget_line_id)?.category;
                    const allocated = parseFloat(bs.allocated_amount);
                    const approved = parseFloat(bs.approved_total);
                    return (
                      <div key={bs.budget_line_id} className="flex items-center gap-4">
                        <span className="text-sm text-stone-600 w-28 flex-shrink-0">{cat?.name ?? '—'}</span>
                        <div className="flex-1">
                          <ProgressBar value={approved} max={allocated} />
                        </div>
                        <span className="text-sm text-stone-500 w-32 text-right flex-shrink-0">
                          {formatCurrencyCompact(approved)} / {formatCurrencyCompact(allocated)}
                        </span>
                      </div>
                    );
                  })}
                  {budgetSummaries.length === 0 && (
                    <p className="text-sm text-stone-400">No budget lines yet.</p>
                  )}
                </div>
              </div>
            </div>
          ) : tab === 'funding' ? (
            <FundingTab fundingList={fundingList} />
          ) : tab === 'budget' ? (
            <BudgetTab budgetList={budgetList} budgetSummaries={budgetSummaries} />
          ) : (
            <ExpensesTab expenseList={expenseList} />
          )}
        </div>
      </div>
    </div>
  );
}

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-stone-50 rounded-xl p-4">
      <p className="text-2xl font-bold text-stone-800">{value}</p>
      <p className="text-xs text-stone-400 mt-1">{label}</p>
    </div>
  );
}

function FundingTab({ fundingList }: { fundingList: (Funding & { funder?: Funder })[] }) {
  if (fundingList.length === 0) return <EmptyState message="No funding entries for this project." />;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm zebra-table">
        <thead>
          <tr className="text-stone-400 text-xs uppercase tracking-wide border-b border-stone-100">
            <th className="text-left pb-3 font-medium">Funder</th>
            <th className="text-left pb-3 font-medium">Type</th>
            <th className="text-right pb-3 font-medium">Amount</th>
            <th className="text-left pb-3 font-medium">Date</th>
            <th className="text-left pb-3 font-medium">Reference</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-stone-50">
          {fundingList.map((f) => {
            const ftype = f.funder ? funderTypeConfig[f.funder.funder_type] : null;
            return (
              <tr key={f.id} className="hover:bg-stone-50 transition">
                <td className="py-3 text-stone-700 font-medium">
                  <div className="flex items-center gap-2">
                    <Building2 size={15} className="text-stone-400" />
                    {f.funder?.name ?? '—'}
                  </div>
                </td>
                <td className="py-3">
                  {ftype && <span className={`text-xs px-2 py-0.5 rounded-full ${ftype.badge}`}>{ftype.label}</span>}
                </td>
                <td className="py-3 text-right text-stone-700 font-medium">{formatCurrency(parseFloat(f.amount))}</td>
                <td className="py-3 text-stone-500">{formatDate(f.funding_date)}</td>
                <td className="py-3 text-stone-500 font-mono text-xs">{f.reference_number ?? '—'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function BudgetTab({
  budgetList,
  budgetSummaries,
}: {
  budgetList: (BudgetLine & { category?: Category })[];
  budgetSummaries: BudgetSummary[];
}) {
  if (budgetList.length === 0) return <EmptyState message="No budget lines for this project." />;
  return (
    <div className="space-y-3">
      {budgetList.map((bl) => {
        const summary = budgetSummaries.find((s) => s.budget_line_id === bl.id);
        const allocated = parseFloat(bl.allocated_amount);
        const approved = summary ? parseFloat(summary.approved_total) : 0;
        const remaining = summary ? parseFloat(summary.remaining) : allocated;
        const overspent = summary?.is_overspent ?? false;
        return (
          <div key={bl.id} className="border border-stone-100 rounded-xl p-4 hover:bg-stone-50/50 transition">
            <div className="flex items-center justify-between mb-2">
              <div>
                <span className="font-medium text-stone-800">{bl.category?.name ?? '—'}</span>
                {bl.notes && <p className="text-xs text-stone-400 mt-0.5">{bl.notes}</p>}
              </div>
              {overspent && (
                <span className="text-xs font-medium text-red-700 bg-red-100 px-2 py-0.5 rounded-full">
                  Overspent
                </span>
              )}
            </div>
            <div className="grid grid-cols-3 gap-4 text-sm mb-3">
              <div>
                <p className="text-xs text-stone-400">Allocated</p>
                <p className="font-medium text-stone-700">{formatCurrency(allocated)}</p>
              </div>
              <div>
                <p className="text-xs text-stone-400">Approved</p>
                <p className="font-medium text-stone-700">{formatCurrency(approved)}</p>
              </div>
              <div>
                <p className="text-xs text-stone-400">Remaining</p>
                <p className={`font-medium ${remaining < 0 ? 'text-red-600' : 'text-stone-700'}`}>
                  {formatCurrency(remaining)}
                </p>
              </div>
            </div>
            <ProgressBar value={approved} max={allocated} />
          </div>
        );
      })}
    </div>
  );
}

function ExpensesTab({ expenseList }: { expenseList: (Expense & { category?: Category })[] }) {
  if (expenseList.length === 0) return <EmptyState message="No expenses for this project." />;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm zebra-table">
        <thead>
          <tr className="text-stone-400 text-xs uppercase tracking-wide border-b border-stone-100">
            <th className="text-left pb-3 font-medium">Description</th>
            <th className="text-left pb-3 font-medium">Category</th>
            <th className="text-right pb-3 font-medium">Amount</th>
            <th className="text-left pb-3 font-medium">Date</th>
            <th className="text-center pb-3 font-medium">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-stone-50">
          {expenseList.map((e) => {
            const sc = expenseStatusConfig[e.status];
            return (
              <tr key={e.id} className="hover:bg-stone-50 transition">
                <td className="py-3 text-stone-700 max-w-xs">
                  <p className="font-medium truncate">{e.description}</p>
                  {e.vendor && <p className="text-xs text-stone-400">{e.vendor}</p>}
                </td>
                <td className="py-3 text-stone-500">{e.category?.name ?? '—'}</td>
                <td className="py-3 text-right text-stone-700 font-medium">{formatCurrency(parseFloat(e.amount))}</td>
                <td className="py-3 text-stone-500">{formatDate(e.expense_date)}</td>
                <td className="py-3 text-center">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${sc.badge}`}>
                    {sc.label}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
