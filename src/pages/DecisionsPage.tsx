import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import type { Expense, Project, BudgetLine, Category, Decision, Profile, BudgetSummary, Evidence } from '@/types';
import { formatCurrency, formatDate } from '@/lib/format';
import { expenseStatusConfig } from '@/lib/ui';
import { LoadingSpinner, ErrorState, EmptyState } from '@/components/States';
import Modal from '@/components/Modal';
import PageHero from '@/components/PageHero';
import { Field, TextArea } from '@/components/FormFields';
import {
  CheckCircle2,
  XCircle,
  Clock,
  CheckSquare,
  AlertTriangle,
  Search,
  Receipt,
  Paperclip,
} from 'lucide-react';

type Tab = 'pending' | 'history';
type OutcomeFilter = 'all' | 'approve' | 'reject';

interface PendingExpense extends Expense {
  project?: Project;
  budget_line?: BudgetLine & { category?: Category };
  submitter?: Profile;
  remaining: number | null;
  evidenceCount: number;
}

interface HistoryRow extends Decision {
  expense?: Expense & { project?: Project };
  reviewer?: Profile;
}

export default function DecisionsPage() {
  const { role, user } = useAuth();
  const canDecide = role === 'admin' || role === 'reviewer';

  const [tab, setTab] = useState<Tab>('pending');
  const [pending, setPending] = useState<PendingExpense[]>([]);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [outcomeFilter, setOutcomeFilter] = useState<OutcomeFilter>('all');
  const [search, setSearch] = useState('');
  const [decisionModal, setDecisionModal] = useState<{
    expense: PendingExpense;
    action: 'approve' | 'reject';
  } | null>(null);
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);

    const [expRes, decRes, projRes, profileRes, blRes, sumRes, evRes] = await Promise.all([
      supabase.from('expenses')
        .select(`
          *,
          project:projects!project_id(*),
          budget_line:budget_lines!budget_line_id(*, category:categories!category_id(*))
        `)
        .order('expense_date', { ascending: false }),
      supabase.from('decisions').select('*').order('decided_at', { ascending: false }),
      supabase.from('projects').select('*').order('name'),
      supabase.from('profiles').select('*'),
      supabase.from('budget_lines').select('id, project_id, category:categories!category_id(name)'),
      supabase.from('budget_summary').select('*'),
      supabase.from('evidence').select('expense_id'),
    ]);

    if (expRes.error || decRes.error || projRes.error || profileRes.error || blRes.error || sumRes.error || evRes.error) {
      setError('Unable to load decisions data. Please try again.');
      setLoading(false);
      return;
    }

    const profileMap = new Map<string, Profile>();
    (profileRes.data as Profile[]).forEach((p) => profileMap.set(p.id, p));

    const summaryMap = new Map<string, BudgetSummary>();
    (sumRes.data as BudgetSummary[]).forEach((s) => summaryMap.set(s.budget_line_id, s));

    const projectMap = new Map<string, Project>();
    (projRes.data as Project[]).forEach((p) => projectMap.set(p.id, p));

    const evidenceCountMap = new Map<string, number>();
    (evRes.data as Evidence[]).forEach((ev) => {
      evidenceCountMap.set(ev.expense_id, (evidenceCountMap.get(ev.expense_id) ?? 0) + 1);
    });

    const pendingExpenses: PendingExpense[] = (expRes.data as Expense[])
      .filter((e) => e.status === 'submitted')
      .map((e) => ({
        ...e,
        project: projectMap.get(e.project_id),
        budget_line: blRes.data?.find((bl) => bl.id === e.budget_line_id) as (BudgetLine & { category?: Category }) | undefined,
        submitter: profileMap.get(e.submitted_by),
        remaining: summaryMap.get(e.budget_line_id)
          ? parseFloat(summaryMap.get(e.budget_line_id)!.remaining)
          : null,
        evidenceCount: evidenceCountMap.get(e.id) ?? 0,
      }));

    setPending(pendingExpenses);
    setProjects(projRes.data as Project[]);

    const historyRows: HistoryRow[] = (decRes.data as Decision[]).map((d) => {
      const exp = (expRes.data as Expense[]).find((e) => e.id === d.expense_id);
      return {
        ...d,
        expense: exp ? { ...exp, project: projectMap.get(exp.project_id) } : undefined,
        reviewer: profileMap.get(d.reviewer_id),
      };
    });

    setHistory(historyRows);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filteredHistory = useMemo(() => {
    return history.filter((h) => {
      if (outcomeFilter !== 'all' && h.action !== outcomeFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchDesc = (h.expense?.description ?? '').toLowerCase().includes(q);
        const matchProject = (h.expense?.project?.name ?? '').toLowerCase().includes(q);
        const matchReviewer = (h.reviewer?.full_name ?? '').toLowerCase().includes(q);
        if (!matchDesc && !matchProject && !matchReviewer) return false;
      }
      return true;
    });
  }, [history, outcomeFilter, search]);

  function openDecision(expense: PendingExpense, action: 'approve' | 'reject') {
    setDecisionModal({ expense, action });
    setReason('');
    setFormError(null);
  }

  async function handleDecide() {
    if (!decisionModal) return;
    const { expense, action } = decisionModal;

    if (action === 'reject' && !reason.trim()) {
      setFormError('A reason is required when rejecting an expense.');
      return;
    }
    if (action === 'approve' && !reason.trim()) {
      setFormError('Please add a brief note before approving.');
      return;
    }

    setSaving(true);
    setFormError(null);

    const { error: fnError } = await supabase.rpc('decide_expense', {
      p_expense_id: expense.id,
      p_outcome: action,
      p_reason: reason.trim(),
    });

    if (fnError) {
      setFormError(fnError.message);
      setSaving(false);
      return;
    }

    setSaving(false);
    setDecisionModal(null);
    loadData();
  }

  return (
    <div className="space-y-6">
      <PageHero
        title="Decisions"
        description="Review and approve pending expenses, or browse the full decision history."
        imageUrl="https://images.pexels.com/photos/3184465/pexels-photo-3184465.jpeg?auto=compress&cs=tinysrgb&h=300&w=1200"
      />

      {/* Tabs */}
      <div className="flex gap-2">
        <TabButton active={tab === 'pending'} onClick={() => setTab('pending')} icon={Clock} label="Pending Review" count={pending.length} />
        <TabButton active={tab === 'history'} onClick={() => setTab('history')} icon={CheckSquare} label="History" count={history.length} />
      </div>

      {loading && <LoadingSpinner label="Loading..." />}
      {error && <ErrorState message={error} onRetry={loadData} />}

      {/* Pending Review tab */}
      {!loading && !error && tab === 'pending' && (
        <>
          {pending.length === 0 ? (
            <EmptyState message="No expenses awaiting review." icon={CheckCircle2} />
          ) : (
            <div className="card-no-hover overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm zebra-table">
                  <thead>
                    <tr className="text-stone-500 text-xs uppercase tracking-wide bg-stone-50/80">
                      <th className="text-left px-5 py-3 font-medium">Description</th>
                      <th className="text-left px-5 py-3 font-medium">Project</th>
                      <th className="text-left px-5 py-3 font-medium">Budget Line</th>
                      <th className="text-right px-5 py-3 font-medium">Amount</th>
                      <th className="text-left px-5 py-3 font-medium">Submitter</th>
                      <th className="text-left px-5 py-3 font-medium">Date</th>
                      <th className="text-center px-5 py-3 font-medium">Evidence</th>
                      <th className="text-right px-5 py-3 font-medium">Remaining</th>
                      {canDecide && <th className="text-center px-5 py-3 font-medium">Actions</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {pending.map((e) => {
                      const overBudget = e.remaining !== null && parseFloat(e.amount) > e.remaining;
                      return (
                        <tr key={e.id}>
                          <td className="px-5 py-3.5 max-w-xs">
                            <p className="font-medium text-stone-700 truncate">{e.description}</p>
                            {e.vendor && <p className="text-xs text-stone-400 mt-0.5">{e.vendor}</p>}
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
                            {e.evidenceCount > 0 ? (
                              <span className="inline-flex items-center gap-1 text-xs font-medium text-teal-700">
                                <Paperclip size={12} /> {e.evidenceCount}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-600">
                                <AlertTriangle size={12} /> No evidence
                              </span>
                            )}
                          </td>
                          <td className="px-5 py-3.5 text-right">
                            {e.remaining !== null ? (
                              <span className={`font-medium ${e.remaining < 0 ? 'text-red-600' : overBudget ? 'text-amber-600' : 'text-stone-700'}`}>
                                {formatCurrency(e.remaining)}
                              </span>
                            ) : '—'}
                            {overBudget && (
                              <span className="inline-flex items-center gap-1 text-xs text-amber-600 ml-1.5">
                                <AlertTriangle size={12} />
                              </span>
                            )}
                          </td>
                          {canDecide && (
                            <td className="px-5 py-3.5 text-center">
                              <div className="flex items-center justify-center gap-2">
                                <button
                                  onClick={() => openDecision(e, 'approve')}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 transition"
                                >
                                  <CheckCircle2 size={14} /> Approve
                                </button>
                                <button
                                  onClick={() => openDecision(e, 'reject')}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-red-600 hover:bg-red-700 transition"
                                >
                                  <XCircle size={14} /> Reject
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
            </div>
          )}
        </>
      )}

      {/* History tab */}
      {!loading && !error && tab === 'history' && (
        <>
          <div className="card-no-hover p-4 flex flex-col sm:flex-row gap-3 sm:items-center">
            <div className="relative flex-1">
              <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search expense, project, reviewer..."
                className="w-full pl-11 pr-4 py-2.5 rounded-xl border border-stone-200 bg-stone-50/50 text-stone-800 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-teal-600 focus:bg-white focus:border-transparent transition text-sm"
              />
            </div>
            <div className="flex gap-2.5">
              {(['all', 'approve', 'reject'] as OutcomeFilter[]).map((f) => (
                <button
                  key={f}
                  onClick={() => setOutcomeFilter(f)}
                  className={`px-4 py-2.5 rounded-xl text-sm font-medium transition ${
                    outcomeFilter === f
                      ? 'bg-teal-600 text-white'
                      : 'bg-stone-50 text-stone-600 border border-stone-200 hover:bg-stone-100'
                  }`}
                >
                  {f === 'all' ? 'All' : f === 'approve' ? 'Approved' : 'Rejected'}
                </button>
              ))}
            </div>
          </div>

          {filteredHistory.length === 0 ? (
            <EmptyState message="No decisions match your filters." icon={CheckSquare} />
          ) : (
            <div className="card-no-hover overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm zebra-table">
                  <thead>
                    <tr className="text-stone-500 text-xs uppercase tracking-wide bg-stone-50/80">
                      <th className="text-left px-5 py-3 font-medium">Expense</th>
                      <th className="text-left px-5 py-3 font-medium">Project</th>
                      <th className="text-left px-5 py-3 font-medium">Reviewer</th>
                      <th className="text-center px-5 py-3 font-medium">Outcome</th>
                      <th className="text-left px-5 py-3 font-medium">Reason</th>
                      <th className="text-left px-5 py-3 font-medium">Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredHistory.map((h) => (
                      <tr key={h.id}>
                        <td className="px-5 py-3.5 max-w-xs">
                          <p className="font-medium text-stone-700 truncate">{h.expense?.description ?? '—'}</p>
                          <p className="text-xs text-stone-400 mt-0.5">
                            {h.expense ? formatCurrency(parseFloat(h.expense.amount)) : ''}
                          </p>
                        </td>
                        <td className="px-5 py-3.5 text-stone-600">
                          {h.expense?.project?.name ?? '—'}
                        </td>
                        <td className="px-5 py-3.5 text-stone-600">
                          {h.reviewer?.full_name ?? '—'}
                        </td>
                        <td className="px-5 py-3.5 text-center">
                          <span className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full ${
                            h.action === 'approve'
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-red-100 text-red-700'
                          }`}>
                            {h.action === 'approve' ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                            {h.action === 'approve' ? 'Approved' : 'Rejected'}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 max-w-xs">
                          <p className="text-sm text-stone-600 truncate">{h.reason}</p>
                        </td>
                        <td className="px-5 py-3.5 text-stone-500">{formatDate(h.decided_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* Decision modal */}
      <Modal
        open={!!decisionModal}
        onClose={() => setDecisionModal(null)}
        title={decisionModal?.action === 'approve' ? 'Approve Expense' : 'Reject Expense'}
        size="md"
      >
        {decisionModal && (
          <div className="space-y-4">
            <div className="rounded-xl bg-stone-50 border border-stone-100 px-4 py-3">
              <div className="flex items-start gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                  decisionModal.action === 'approve' ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'
                }`}>
                  {decisionModal.action === 'approve' ? <CheckCircle2 size={20} /> : <XCircle size={20} />}
                </div>
                <div className="min-w-0">
                  <p className="font-medium text-stone-800">{decisionModal.expense.description}</p>
                  <p className="text-sm text-stone-400 mt-0.5">
                    {decisionModal.expense.project?.name} · {formatCurrency(parseFloat(decisionModal.expense.amount))}
                  </p>
                  {decisionModal.expense.remaining !== null && parseFloat(decisionModal.expense.amount) > decisionModal.expense.remaining && (
                    <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                      <AlertTriangle size={12} /> Amount exceeds remaining budget ({formatCurrency(decisionModal.expense.remaining)})
                    </p>
                  )}
                </div>
              </div>
            </div>

            <Field label={decisionModal.action === 'reject' ? 'Reason for rejection' : 'Note (optional)'} required={decisionModal.action === 'reject'}>
              <TextArea
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={decisionModal.action === 'reject'
                  ? 'Explain why this expense is being rejected...'
                  : 'Add a brief approval note...'}
              />
            </Field>

            {formError && (
              <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-2.5 text-sm text-red-700">
                {formError}
              </div>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setDecisionModal(null)}
                className="px-4 py-2.5 rounded-xl text-sm font-medium text-stone-600 hover:bg-stone-100 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleDecide}
                disabled={saving}
                className={`px-5 py-2.5 rounded-xl text-white text-sm font-semibold disabled:opacity-60 transition ${
                  decisionModal.action === 'approve'
                    ? 'bg-emerald-600 hover:bg-emerald-700'
                    : 'bg-red-600 hover:bg-red-700'
                }`}
              >
                {saving ? 'Processing...' : decisionModal.action === 'approve' ? 'Approve' : 'Reject'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon: Icon,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof Clock;
  label: string;
  count: number;
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition ${
        active
          ? 'bg-teal-600 text-white shadow-sm'
          : 'bg-white text-stone-600 border border-stone-200 hover:bg-stone-50'
      }`}
    >
      <Icon size={16} />
      {label}
      <span className={`text-xs px-2 py-0.5 rounded-full ${
        active ? 'bg-white/20 text-white' : 'bg-stone-100 text-stone-500'
      }`}>
        {count}
      </span>
    </button>
  );
}
