import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import type { Expense, Project, BudgetLine, Category, Decision, Evidence, Profile, BudgetSummary } from '@/types';
import { formatCurrency, formatDate } from '@/lib/format';
import { expenseStatusConfig } from '@/lib/ui';
import { LoadingSpinner, ErrorState, EmptyState } from '@/components/States';
import Modal from '@/components/Modal';
import PageHero from '@/components/PageHero';
import { Field, TextInput, TextArea, Select } from '@/components/FormFields';
import {
  Plus,
  Search,
  Receipt,
  ArrowLeft,
  AlertTriangle,
  RotateCcw,
  CheckCircle2,
  XCircle,
  Clock,
  FileText,
  User,
  Paperclip,
  Filter,
  ExternalLink,
  Trash2,
} from 'lucide-react';

type StatusFilter = 'all' | 'submitted' | 'approved' | 'rejected';

interface ExpenseRow extends Expense {
  project?: Project;
  budget_line?: BudgetLine & { category?: Category };
  submitter?: Profile;
}

interface ExpenseForm {
  project_id: string;
  budget_line_id: string;
  amount: string;
  expense_date: string;
  vendor: string;
  description: string;
  resubmission_of: string | null;
}

interface EvidenceDraft {
  file_name: string;
  file_url: string;
  file_type: string;
}

const emptyForm: ExpenseForm = {
  project_id: '',
  budget_line_id: '',
  amount: '',
  expense_date: '',
  vendor: '',
  description: '',
  resubmission_of: null,
};

export default function ExpensesPage() {
  const { role, user } = useAuth();
  const canCreate = role === 'admin' || role === 'finance_officer';
  const isFinanceOnly = role === 'finance_officer';

  const [expenses, setExpenses] = useState<ExpenseRow[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [budgetLines, setBudgetLines] = useState<(BudgetLine & { category?: Category })[]>([]);
  const [summaries, setSummaries] = useState<BudgetSummary[]>([]);
  const [profiles, setProfiles] = useState<Map<string, Profile>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedExpense, setSelectedExpense] = useState<ExpenseRow | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<ExpenseForm>(emptyForm);
  const [evidenceDrafts, setEvidenceDrafts] = useState<EvidenceDraft[]>([]);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [projectFilter, setProjectFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [showAll, setShowAll] = useState(!isFinanceOnly);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);

    let expenseQuery = supabase
      .from('expenses')
      .select(`
        *,
        project:projects!project_id(*),
        budget_line:budget_lines!budget_line_id(
          *,
          category:categories!category_id(*)
        )
      `)
      .order('expense_date', { ascending: false });

    if (isFinanceOnly && !showAll) {
      expenseQuery = expenseQuery.eq('submitted_by', user?.id ?? '');
    }

    const [expRes, projRes, blRes, sumRes, profileRes] = await Promise.all([
      expenseQuery,
      supabase.from('projects').select('*').order('name'),
      supabase.from('budget_lines').select('*, category:categories!category_id(*)').order('created_at'),
      supabase.from('budget_summary').select('*'),
      supabase.from('profiles').select('*'),
    ]);

    if (expRes.error || projRes.error || blRes.error || sumRes.error || profileRes.error) {
      setError('Unable to load expenses. Please try again.');
      setLoading(false);
      return;
    }

    const profileMap = new Map<string, Profile>();
    (profileRes.data as Profile[]).forEach((p) => profileMap.set(p.id, p));
    setProfiles(profileMap);

    const enriched: ExpenseRow[] = (expRes.data as ExpenseRow[]).map((e) => ({
      ...e,
      submitter: profileMap.get(e.submitted_by),
    }));

    setExpenses(enriched);
    setProjects(projRes.data as Project[]);
    setBudgetLines(blRes.data as (BudgetLine & { category?: Category })[]);
    setSummaries(sumRes.data as BudgetSummary[]);
    setLoading(false);
  }, [isFinanceOnly, showAll, user?.id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filtered = useMemo(() => {
    return expenses.filter((e) => {
      if (statusFilter !== 'all' && e.status !== statusFilter) return false;
      if (projectFilter !== 'all' && e.project_id !== projectFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchDesc = e.description.toLowerCase().includes(q);
        const matchVendor = (e.vendor ?? '').toLowerCase().includes(q);
        const matchProject = (e.project?.name ?? '').toLowerCase().includes(q);
        if (!matchDesc && !matchVendor && !matchProject) return false;
      }
      return true;
    });
  }, [expenses, statusFilter, projectFilter, search]);

  const availableBudgetLines = budgetLines.filter((bl) => bl.project_id === form.project_id);

  const selectedLineSummary = summaries.find((s) => s.budget_line_id === form.budget_line_id);
  const remainingBudget = selectedLineSummary ? parseFloat(selectedLineSummary.remaining) : null;
  const enteredAmount = form.amount ? parseFloat(form.amount) : 0;
  const exceedsBudget = remainingBudget !== null && enteredAmount > remainingBudget;

  function openCreate() {
    setForm({ ...emptyForm, expense_date: new Date().toISOString().split('T')[0] });
    setEvidenceDrafts([]);
    setFormError(null);
    setModalOpen(true);
  }

  function openResubmit(expense: ExpenseRow) {
    setForm({
      project_id: expense.project_id,
      budget_line_id: expense.budget_line_id,
      amount: String(expense.amount),
      expense_date: new Date().toISOString().split('T')[0],
      vendor: expense.vendor ?? '',
      description: expense.description,
      resubmission_of: expense.id,
    });
    setEvidenceDrafts([]);
    setFormError(null);
    setModalOpen(true);
  }

  function addEvidenceDraft() {
    setEvidenceDrafts([...evidenceDrafts, { file_name: '', file_url: '', file_type: 'receipt' }]);
  }

  function updateEvidenceDraft(idx: number, field: keyof EvidenceDraft, value: string) {
    setEvidenceDrafts(evidenceDrafts.map((d, i) => (i === idx ? { ...d, [field]: value } : d)));
  }

  function removeEvidenceDraft(idx: number) {
    setEvidenceDrafts(evidenceDrafts.filter((_, i) => i !== idx));
  }

  async function handleSave() {
    if (!form.project_id || !form.budget_line_id || !form.amount || !form.expense_date || !form.description.trim()) {
      setFormError('Project, budget line, amount, date, and purpose are required.');
      return;
    }
    const amount = parseFloat(form.amount);
    if (isNaN(amount) || amount <= 0) {
      setFormError('Amount must be a positive number.');
      return;
    }

    const validDrafts = evidenceDrafts.filter((d) => d.file_name.trim() && d.file_url.trim());

    setSaving(true);
    setFormError(null);

    const payload = {
      budget_line_id: form.budget_line_id,
      project_id: form.project_id,
      submitted_by: user?.id,
      amount,
      expense_date: form.expense_date,
      vendor: form.vendor.trim() || null,
      description: form.description.trim(),
      status: 'submitted',
      resubmission_of: form.resubmission_of,
    };

    const { data: inserted, error: insertError } = await supabase.from('expenses').insert(payload).select('id').single();

    if (insertError) {
      setFormError(insertError.message);
      setSaving(false);
      return;
    }

    if (validDrafts.length > 0 && inserted?.id) {
      const evidenceRows = validDrafts.map((d) => ({
        expense_id: inserted.id,
        file_name: d.file_name.trim(),
        file_url: d.file_url.trim(),
        file_type: d.file_type,
        uploaded_by: user?.id,
      }));
      const { error: evError } = await supabase.from('evidence').insert(evidenceRows);
      if (evError) {
        setFormError(`Expense created, but evidence upload failed: ${evError.message}`);
        setSaving(false);
        setModalOpen(false);
        loadData();
        return;
      }
    }

    setSaving(false);
    setModalOpen(false);
    loadData();
  }

  if (selectedExpense) {
    return (
      <ExpenseDetail
        expense={selectedExpense}
        profiles={profiles}
        onBack={() => setSelectedExpense(null)}
        canResubmit={canCreate}
        onResubmit={() => {
          openResubmit(selectedExpense);
          setSelectedExpense(null);
        }}
        canManageEvidence={canCreate}
        currentUserId={user?.id ?? ''}
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHero
        title="Expenses"
        description="Track every expense, from submission to approval."
        imageUrl="https://images.pexels.com/photos/3184292/pexels-photo-3184292.jpeg?auto=compress&cs=tinysrgb&h=300&w=1200"
        action={canCreate ? (
          <button
            onClick={openCreate}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-white font-medium text-sm btn-coral"
          >
            <Plus size={18} /> New Expense
          </button>
        ) : undefined}
      />

      {/* Filters bar */}
      <div className="card-no-hover p-4 flex flex-col sm:flex-row gap-3 sm:items-center">
        <div className="relative flex-1">
          <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search description, vendor, project..."
            className="w-full pl-11 pr-4 py-2.5 rounded-xl border border-stone-200 bg-stone-50/50 text-stone-800 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-teal-600 focus:bg-white focus:border-transparent transition text-sm"
          />
        </div>
        <div className="flex gap-2.5">
          <Select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            className="!w-auto"
          >
            <option value="all">All Statuses</option>
            <option value="submitted">Awaiting Approval</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </Select>
          <Select
            value={projectFilter}
            onChange={(e) => setProjectFilter(e.target.value)}
            className="!w-auto"
          >
            <option value="all">All Projects</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </Select>
          {isFinanceOnly && (
            <button
              onClick={() => setShowAll(!showAll)}
              className={`px-4 py-2.5 rounded-xl text-sm font-medium transition flex items-center gap-2 ${
                showAll
                  ? 'bg-teal-50 text-teal-700 border border-teal-200'
                  : 'bg-stone-50 text-stone-600 border border-stone-200'
              }`}
              title={showAll ? 'Showing all expenses' : 'Showing only your expenses'}
            >
              <Filter size={15} />
              {showAll ? 'All' : 'Mine'}
            </button>
          )}
        </div>
      </div>

      {loading && <LoadingSpinner label="Loading expenses..." />}
      {error && <ErrorState message={error} onRetry={loadData} />}
      {!loading && !error && filtered.length === 0 && (
        <EmptyState message="No expenses match your filters." icon={Receipt} />
      )}

      {!loading && !error && filtered.length > 0 && (
        <div className="card-no-hover overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm zebra-table">
              <thead>
                <tr className="text-stone-500 text-xs uppercase tracking-wide bg-stone-50/80">
                  <th className="text-left px-5 py-3 font-medium">Description</th>
                  <th className="text-left px-5 py-3 font-medium">Project</th>
                  <th className="text-left px-5 py-3 font-medium">Budget Line</th>
                  <th className="text-right px-5 py-3 font-medium">Amount</th>
                  <th className="text-left px-5 py-3 font-medium">Submitted By</th>
                  <th className="text-left px-5 py-3 font-medium">Date</th>
                  <th className="text-center px-5 py-3 font-medium">Status</th>
                  <th className="text-center px-5 py-3 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((e) => {
                  const sc = expenseStatusConfig[e.status];
                  return (
                    <tr
                      key={e.id}
                      className="cursor-pointer transition"
                      onClick={() => setSelectedExpense(e)}
                    >
                      <td className="px-5 py-3.5 max-w-xs">
                        <p className="font-medium text-stone-700 truncate">{e.description}</p>
                        {e.vendor && <p className="text-xs text-stone-400 mt-0.5">{e.vendor}</p>}
                        {e.resubmission_of && (
                          <span className="inline-flex items-center gap-1 text-xs text-teal-600 mt-0.5">
                            <RotateCcw size={11} /> Resubmitted
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3.5">
                        <p className="text-stone-700 font-medium">{e.project?.name ?? '—'}</p>
                        <p className="text-xs text-stone-400">{e.project?.code}</p>
                      </td>
                      <td className="px-5 py-3.5 text-stone-600">
                        {e.budget_line?.category?.name ?? '—'}
                      </td>
                      <td className="px-5 py-3.5 text-right text-stone-800 font-semibold">
                        {formatCurrency(parseFloat(e.amount))}
                      </td>
                      <td className="px-5 py-3.5 text-stone-600">
                        {e.submitter?.full_name ?? '—'}
                      </td>
                      <td className="px-5 py-3.5 text-stone-500">{formatDate(e.expense_date)}</td>
                      <td className="px-5 py-3.5 text-center">
                        <span className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full ${sc.badge}`}>
                          {e.status === 'approved' && <CheckCircle2 size={12} />}
                          {e.status === 'rejected' && <XCircle size={12} />}
                          {e.status === 'submitted' && <Clock size={12} />}
                          {sc.label}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-center">
                        {e.status === 'rejected' && canCreate && (
                          <button
                            onClick={(ev) => { ev.stopPropagation(); openResubmit(e); }}
                            className="inline-flex items-center gap-1 text-xs font-medium text-teal-700 hover:text-teal-800 transition"
                          >
                            <RotateCcw size={13} /> Resubmit
                          </button>
                        )}
                      </td>
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
        title={form.resubmission_of ? 'Resubmit Expense' : 'New Expense'}
        size="lg"
      >
        <div className="space-y-4">
          {form.resubmission_of && (
            <div className="rounded-xl bg-teal-50 border border-teal-200 px-4 py-3 text-sm text-teal-800 flex items-center gap-2">
              <RotateCcw size={16} />
              Creating a new expense linked to the rejected one.
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Project" required>
              <Select
                value={form.project_id}
                onChange={(e) => setForm({ ...form, project_id: e.target.value, budget_line_id: '' })}
              >
                <option value="">Select project...</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </Select>
            </Field>
            <Field label="Budget Line" required>
              <Select
                value={form.budget_line_id}
                onChange={(e) => setForm({ ...form, budget_line_id: e.target.value })}
                disabled={!form.project_id}
              >
                <option value="">Select budget line...</option>
                {availableBudgetLines.map((bl) => (
                  <option key={bl.id} value={bl.id}>{bl.category?.name ?? '—'}</option>
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
            <Field label="Expense Date" required>
              <TextInput
                type="date"
                value={form.expense_date}
                onChange={(e) => setForm({ ...form, expense_date: e.target.value })}
              />
            </Field>
          </div>

          <Field label="Vendor">
            <TextInput
              value={form.vendor}
              onChange={(e) => setForm({ ...form, vendor: e.target.value })}
              placeholder="e.g. ABC Supplies"
            />
          </Field>

          <Field label="Purpose / Description" required>
            <TextArea
              rows={2}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="What was this expense for?"
            />
          </Field>

          {/* Evidence attachment section */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-stone-700 flex items-center gap-1.5">
                <Paperclip size={15} /> Attach Evidence
              </label>
              <button
                type="button"
                onClick={addEvidenceDraft}
                className="text-xs font-medium text-teal-700 hover:text-teal-800 transition"
              >
                + Add file
              </button>
            </div>
            {evidenceDrafts.map((d, i) => (
              <div key={i} className="flex gap-2 items-start">
                <TextInput
                  value={d.file_name}
                  onChange={(e) => updateEvidenceDraft(i, 'file_name', e.target.value)}
                  placeholder="File name"
                  className="flex-1"
                />
                <Select
                  value={d.file_type}
                  onChange={(e) => updateEvidenceDraft(i, 'file_type', e.target.value)}
                  className="!w-auto"
                >
                  <option value="receipt">Receipt</option>
                  <option value="invoice">Invoice</option>
                  <option value="photo">Photo</option>
                  <option value="other">Other</option>
                </Select>
                <TextInput
                  value={d.file_url}
                  onChange={(e) => updateEvidenceDraft(i, 'file_url', e.target.value)}
                  placeholder="https://link-to-file..."
                  className="flex-1"
                />
                <button
                  type="button"
                  onClick={() => removeEvidenceDraft(i)}
                  className="text-stone-400 hover:text-red-500 transition flex-shrink-0 pt-2.5"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>

          {exceedsBudget && (
            <div className="rounded-xl bg-amber-50 border border-amber-300 px-4 py-3 text-sm text-amber-800 flex items-start gap-2">
              <AlertTriangle size={18} className="flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">This amount exceeds the remaining budget for this line.</p>
                <p className="text-amber-700 mt-0.5">
                  Remaining: {formatCurrency(remainingBudget ?? 0)}. You can still submit — it will be flagged for review.
                </p>
              </div>
            </div>
          )}

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
              {saving ? 'Submitting...' : form.resubmission_of ? 'Resubmit Expense' : 'Submit Expense'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ============================================================
// Expense Detail View
// ============================================================

interface DetailData {
  decisions: (Decision & { reviewer?: Profile })[];
  evidence: (Evidence & { uploader?: Profile })[];
  budgetLine?: BudgetLine & { category?: Category };
  summary?: BudgetSummary;
  originalExpense?: Expense;
  loading: boolean;
}

function ExpenseDetail({
  expense,
  profiles,
  onBack,
  canResubmit,
  onResubmit,
  canManageEvidence,
  currentUserId,
}: {
  expense: ExpenseRow;
  profiles: Map<string, Profile>;
  onBack: () => void;
  canResubmit: boolean;
  onResubmit: () => void;
  canManageEvidence: boolean;
  currentUserId: string;
}) {
  const [detail, setDetail] = useState<DetailData>({ decisions: [], evidence: [], loading: true });
  const [evForm, setEvForm] = useState<EvidenceDraft>({ file_name: '', file_url: '', file_type: 'receipt' });
  const [evSaving, setEvSaving] = useState(false);
  const [evError, setEvError] = useState<string | null>(null);
  const [showEvForm, setShowEvForm] = useState(false);

  const canAttachEvidence =
    canManageEvidence &&
    (expense.status === 'submitted' || expense.status === 'rejected') &&
    (expense.submitted_by === currentUserId || profiles.get(currentUserId)?.role === 'admin');

  useEffect(() => {
    loadDetail();
  }, [expense.id]);

  async function loadDetail() {
    setDetail({ decisions: [], evidence: [], loading: true });
    const [decRes, evRes, blRes, sumRes, origRes] = await Promise.all([
      supabase.from('decisions').select('*').eq('expense_id', expense.id).order('decided_at', { ascending: false }),
      supabase.from('evidence').select('*').eq('expense_id', expense.id).order('created_at', { ascending: false }),
      supabase.from('budget_lines').select('*, category:categories!category_id(*)').eq('id', expense.budget_line_id).maybeSingle(),
      supabase.from('budget_summary').select('*').eq('budget_line_id', expense.budget_line_id).maybeSingle(),
      expense.resubmission_of
        ? supabase.from('expenses').select('*').eq('id', expense.resubmission_of).maybeSingle()
        : Promise.resolve({ data: null, error: null }),
    ]);

    const decisionsWithReviewers: (Decision & { reviewer?: Profile })[] =
      (decRes.data ?? []).map((d: Decision) => ({
        ...d,
        reviewer: profiles.get(d.reviewer_id),
      }));

    const evidenceWithUploaders: (Evidence & { uploader?: Profile })[] =
      (evRes.data ?? []).map((ev: Evidence) => ({
        ...ev,
        uploader: profiles.get(ev.uploaded_by),
      }));

    setDetail({
      decisions: decisionsWithReviewers,
      evidence: evidenceWithUploaders,
      budgetLine: blRes.data as (BudgetLine & { category?: Category }) | undefined,
      summary: sumRes.data as BudgetSummary | undefined,
      originalExpense: origRes.data as Expense | undefined,
      loading: false,
    });
  }

  async function handleAddEvidence() {
    if (!evForm.file_name.trim() || !evForm.file_url.trim()) {
      setEvError('File name and link are required.');
      return;
    }
    setEvSaving(true);
    setEvError(null);
    const { error: evErr } = await supabase.from('evidence').insert({
      expense_id: expense.id,
      file_name: evForm.file_name.trim(),
      file_url: evForm.file_url.trim(),
      file_type: evForm.file_type,
      uploaded_by: currentUserId,
    });
    if (evErr) {
      setEvError(evErr.message);
      setEvSaving(false);
      return;
    }
    setEvSaving(false);
    setEvForm({ file_name: '', file_url: '', file_type: 'receipt' });
    setShowEvForm(false);
    loadDetail();
  }

  const sc = expenseStatusConfig[expense.status];
  const remaining = detail.summary ? parseFloat(detail.summary.remaining) : null;

  return (
    <div className="space-y-6">
      <button
        onClick={onBack}
        className="inline-flex items-center gap-2 text-sm text-stone-500 hover:text-stone-700 transition"
      >
        <ArrowLeft size={16} /> Back to Expenses
      </button>

      {/* Header card */}
      <div className="card-no-hover overflow-hidden">
        <div className="relative px-6 py-6" style={{ background: 'linear-gradient(135deg, #14919b, #0d4f4f)' }}>
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center">
                  <Receipt size={20} className="text-white" />
                </div>
                <span className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full ${sc.badge}`}>
                  {expense.status === 'approved' && <CheckCircle2 size={12} />}
                  {expense.status === 'rejected' && <XCircle size={12} />}
                  {expense.status === 'submitted' && <Clock size={12} />}
                  {sc.label}
                </span>
              </div>
              <h1 className="text-2xl font-bold text-white">{expense.description}</h1>
              <p className="text-teal-100 text-sm mt-1">{expense.project?.name} · {expense.project?.code}</p>
            </div>
            <div className="text-right">
              <p className="text-teal-100 text-sm">Amount</p>
              <p className="text-3xl font-bold text-white">{formatCurrency(parseFloat(expense.amount))}</p>
            </div>
          </div>
        </div>

        {expense.status === 'rejected' && canResubmit && (
          <div className="px-6 py-3 bg-red-50/50 border-t border-stone-100 flex items-center justify-between">
            <p className="text-sm text-red-700">This expense was rejected. You can resubmit it with corrections.</p>
            <button
              onClick={onResubmit}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white btn-coral"
            >
              <RotateCcw size={16} /> Resubmit
            </button>
          </div>
        )}
      </div>

      {/* Detail fields */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="card-no-hover p-5 lg:col-span-2">
          <h3 className="font-semibold text-stone-800 mb-4">Expense Details</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
            <DetailField icon={FileText} label="Budget Line" value={detail.budgetLine?.category?.name ?? '—'} />
            <DetailField icon={User} label="Submitted By" value={expense.submitter?.full_name ?? '—'} />
            <DetailField icon={Receipt} label="Vendor" value={expense.vendor ?? '—'} />
            <DetailField icon={Clock} label="Expense Date" value={formatDate(expense.expense_date)} />
            <DetailField
              icon={AlertTriangle}
              label="Budget Remaining"
              value={remaining !== null ? formatCurrency(remaining) : '—'}
              valueClass={remaining !== null && remaining < 0 ? 'text-red-600' : undefined}
            />
            {expense.resubmission_of && (
              <DetailField icon={RotateCcw} label="Resubmission Of" value={detail.originalExpense?.description ?? 'Previous expense'} />
            )}
          </div>
        </div>

        {/* Evidence */}
        <div className="card-no-hover p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Paperclip size={18} className="text-teal-600" />
              <h3 className="font-semibold text-stone-800">Evidence</h3>
            </div>
            {canAttachEvidence && !showEvForm && (
              <button
                onClick={() => setShowEvForm(true)}
                className="text-xs font-medium text-teal-700 hover:text-teal-800 transition"
              >
                + Attach
              </button>
            )}
          </div>

          {showEvForm && (
            <div className="space-y-2 mb-3 pb-3 border-b border-stone-100">
              <TextInput
                value={evForm.file_name}
                onChange={(e) => setEvForm({ ...evForm, file_name: e.target.value })}
                placeholder="File name"
              />
              <Select
                value={evForm.file_type}
                onChange={(e) => setEvForm({ ...evForm, file_type: e.target.value })}
              >
                <option value="receipt">Receipt</option>
                <option value="invoice">Invoice</option>
                <option value="photo">Photo</option>
                <option value="other">Other</option>
              </Select>
              <TextInput
                value={evForm.file_url}
                onChange={(e) => setEvForm({ ...evForm, file_url: e.target.value })}
                placeholder="https://link-to-file..."
              />
              {evError && <p className="text-xs text-red-600">{evError}</p>}
              <div className="flex gap-2">
                <button
                  onClick={handleAddEvidence}
                  disabled={evSaving}
                  className="flex-1 py-2 rounded-lg text-white text-xs font-semibold btn-teal disabled:opacity-60"
                >
                  {evSaving ? 'Saving...' : 'Attach'}
                </button>
                <button
                  onClick={() => { setShowEvForm(false); setEvError(null); }}
                  className="px-3 py-2 rounded-lg text-xs font-medium text-stone-600 hover:bg-stone-100 transition"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {detail.loading ? (
            <LoadingSpinner label="Loading..." />
          ) : detail.evidence.length === 0 ? (
            <p className="text-sm text-stone-400 py-6 text-center">No evidence attached.</p>
          ) : (
            <div className="space-y-3">
              {detail.evidence.map((ev) => (
                <div key={ev.id} className="flex items-center gap-3 p-3 rounded-xl border border-stone-150 hover:border-teal-300 hover:bg-teal-50/40 transition group">
                  <div className="w-9 h-9 rounded-lg bg-teal-50 flex items-center justify-center flex-shrink-0">
                    <FileText size={16} className="text-teal-600" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-stone-700 truncate group-hover:text-teal-800">{ev.file_name}</p>
                    <p className="text-xs text-stone-400">
                      {ev.file_type} · {ev.uploader?.full_name ?? 'Unknown'} · {formatDate(ev.created_at)}
                    </p>
                  </div>
                  <a
                    href={ev.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-teal-600 hover:text-teal-800 transition flex-shrink-0"
                    title="Open"
                  >
                    <ExternalLink size={16} />
                  </a>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Decision timeline */}
      <div className="card-no-hover p-5">
        <h3 className="font-semibold text-stone-800 mb-4">Decision History</h3>
        {detail.loading ? (
          <LoadingSpinner label="Loading..." />
        ) : detail.decisions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Clock size={28} className="text-stone-300 mb-2" />
            <p className="text-sm text-stone-400">
              {expense.status === 'submitted'
                ? 'No decisions yet — this expense is awaiting review.'
                : 'No decision records found.'}
            </p>
          </div>
        ) : (
          <div className="relative">
            {detail.decisions.map((dec, i) => (
              <div key={dec.id} className="flex gap-4 pb-6 last:pb-0 relative">
                {i < detail.decisions.length - 1 && (
                  <div className="absolute left-[19px] top-10 bottom-0 w-0.5 bg-stone-100" />
                )}
                <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 z-10 ${
                  dec.action === 'approve'
                    ? 'bg-emerald-100 text-emerald-600'
                    : 'bg-red-100 text-red-600'
                }`}>
                  {dec.action === 'approve' ? <CheckCircle2 size={20} /> : <XCircle size={20} />}
                </div>
                <div className="flex-1 pt-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-sm font-semibold ${
                      dec.action === 'approve' ? 'text-emerald-700' : 'text-red-700'
                    }`}>
                      {dec.action === 'approve' ? 'Approved' : 'Rejected'}
                    </span>
                    <span className="text-xs text-stone-400">
                      by {dec.reviewer?.full_name ?? 'Unknown'} · {formatDate(dec.decided_at)}
                    </span>
                  </div>
                  <p className="text-sm text-stone-600 bg-stone-50 rounded-lg px-3 py-2 mt-1">{dec.reason}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function DetailField({
  icon: Icon,
  label,
  value,
  valueClass,
}: {
  icon: typeof FileText;
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="w-8 h-8 rounded-lg bg-stone-50 flex items-center justify-center flex-shrink-0">
        <Icon size={16} className="text-stone-400" />
      </div>
      <div>
        <p className="text-xs text-stone-400">{label}</p>
        <p className={`text-sm font-medium text-stone-700 mt-0.5 ${valueClass ?? ''}`}>{value}</p>
      </div>
    </div>
  );
}
