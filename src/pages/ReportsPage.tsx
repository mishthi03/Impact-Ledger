import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { BudgetSummary, Project, Category, Expense, Decision, Funder, Funding, Profile } from '@/types';
import { formatCurrency, formatDate } from '@/lib/format';
import { LoadingSpinner, ErrorState, EmptyState } from '@/components/States';
import PageHero from '@/components/PageHero';
import {
  BarChart3,
  Wallet,
  FolderTree,
  Building2,
  CheckSquare,
  Download,
  XCircle,
} from 'lucide-react';

type ReportTab = 'budget' | 'category' | 'funder' | 'decisions';

interface BudgetRow {
  projectName: string;
  projectCode: string;
  categoryName: string;
  allocated: number;
  approved: number;
  remaining: number;
  pctUsed: number;
  overspent: boolean;
}

interface CategoryRow {
  categoryName: string;
  approvedSpend: number;
  expenseCount: number;
}

interface FunderRow {
  funderName: string;
  funderType: string;
  totalFunding: number;
  entryCount: number;
  projects: string[];
}

interface DecisionSummary {
  approvedCount: number;
  rejectedCount: number;
  rejectedExpenses: { description: string; projectName: string; reason: string; decidedAt: string; reviewerName: string }[];
}

export default function ReportsPage() {
  const [tab, setTab] = useState<ReportTab>('budget');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [budgetRows, setBudgetRows] = useState<BudgetRow[]>([]);
  const [categoryRows, setCategoryRows] = useState<CategoryRow[]>([]);
  const [funderRows, setFunderRows] = useState<FunderRow[]>([]);
  const [decisionSummary, setDecisionSummary] = useState<DecisionSummary>({ approvedCount: 0, rejectedCount: 0, rejectedExpenses: [] });

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);

    const [sumRes, projRes, catRes, expRes, decRes, funderRes, fundingRes, profileRes] = await Promise.all([
      supabase.from('budget_summary').select('*'),
      supabase.from('projects').select('*').order('name'),
      supabase.from('categories').select('*').order('name'),
      supabase.from('expenses').select('*'),
      supabase.from('decisions').select('*').order('decided_at', { ascending: false }),
      supabase.from('funders').select('*').order('name'),
      supabase.from('funding').select('*'),
      supabase.from('profiles').select('*'),
    ]);

    if (sumRes.error || projRes.error || catRes.error || expRes.error || decRes.error || funderRes.error || fundingRes.error || profileRes.error) {
      setError('Unable to load reports data. Please try again.');
      setLoading(false);
      return;
    }

    const projectMap = new Map<string, Project>();
    (projRes.data as Project[]).forEach((p) => projectMap.set(p.id, p));

    const categoryMap = new Map<string, Category>();
    (catRes.data as Category[]).forEach((c) => categoryMap.set(c.id, c));

    const profileMap = new Map<string, Profile>();
    (profileRes.data as Profile[]).forEach((p) => profileMap.set(p.id, p));

    // Budget vs Actual
    const bRows: BudgetRow[] = (sumRes.data as BudgetSummary[]).map((s) => {
      const proj = projectMap.get(s.project_id);
      const cat = categoryMap.get(s.category_id);
      const allocated = parseFloat(s.allocated_amount);
      const approved = parseFloat(s.approved_total);
      const remaining = parseFloat(s.remaining);
      return {
        projectName: proj?.name ?? '—',
        projectCode: proj?.code ?? '',
        categoryName: cat?.name ?? '—',
        allocated,
        approved,
        remaining,
        pctUsed: allocated > 0 ? (approved / allocated) * 100 : 0,
        overspent: s.is_overspent,
      };
    }).sort((a, b) => a.projectName.localeCompare(b.projectName));
    setBudgetRows(bRows);

    // Spend by Category (approved expenses only)
    const approvedExpenses = (expRes.data as Expense[]).filter((e) => e.status === 'approved');
    const catSpendMap = new Map<string, { total: number; count: number }>();
    approvedExpenses.forEach((e) => {
      const s = (sumRes.data as BudgetSummary[]).find((sm) => sm.budget_line_id === e.budget_line_id);
      const catId = s?.category_id;
      if (!catId) return;
      const existing = catSpendMap.get(catId) ?? { total: 0, count: 0 };
      existing.total += parseFloat(e.amount);
      existing.count += 1;
      catSpendMap.set(catId, existing);
    });
    const cRows: CategoryRow[] = Array.from(catSpendMap.entries()).map(([catId, data]) => ({
      categoryName: categoryMap.get(catId)?.name ?? '—',
      approvedSpend: data.total,
      expenseCount: data.count,
    })).sort((a, b) => b.approvedSpend - a.approvedSpend);
    setCategoryRows(cRows);

    // Funding by Funder
    const funderMap = new Map<string, Funder>();
    (funderRes.data as Funder[]).forEach((f) => funderMap.set(f.id, f));
    const funderAggMap = new Map<string, { total: number; count: number; projectIds: Set<string> }>();
    (fundingRes.data as Funding[]).forEach((f) => {
      const existing = funderAggMap.get(f.funder_id) ?? { total: 0, count: 0, projectIds: new Set<string>() };
      existing.total += parseFloat(f.amount);
      existing.count += 1;
      existing.projectIds.add(f.project_id);
      funderAggMap.set(f.funder_id, existing);
    });
    const fRows: FunderRow[] = Array.from(funderAggMap.entries()).map(([funderId, data]) => {
      const funder = funderMap.get(funderId);
      return {
        funderName: funder?.name ?? '—',
        funderType: funder?.funder_type ?? 'other',
        totalFunding: data.total,
        entryCount: data.count,
        projects: Array.from(data.projectIds).map((pid) => projectMap.get(pid)?.name ?? '—'),
      };
    }).sort((a, b) => b.totalFunding - a.totalFunding);
    setFunderRows(fRows);

    // Decisions Summary
    const decisions = decRes.data as Decision[];
    const approved = decisions.filter((d) => d.action === 'approve');
    const rejected = decisions.filter((d) => d.action === 'reject');
    const expenseMap = new Map<string, Expense>();
    (expRes.data as Expense[]).forEach((e) => expenseMap.set(e.id, e));

    const rejectedExpenses = rejected.map((d) => {
      const exp = expenseMap.get(d.expense_id);
      return {
        description: exp?.description ?? '—',
        projectName: exp ? (projectMap.get(exp.project_id)?.name ?? '—') : '—',
        reason: d.reason,
        decidedAt: d.decided_at,
        reviewerName: profileMap.get(d.reviewer_id)?.full_name ?? '—',
      };
    });
    setDecisionSummary({ approvedCount: approved.length, rejectedCount: rejected.length, rejectedExpenses });

    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  function exportCSV(filename: string, headers: string[], rows: (string | number)[][]) {
    const csv = [headers, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  const tabs: { id: ReportTab; label: string; icon: typeof BarChart3 }[] = [
    { id: 'budget', label: 'Budget vs Actual', icon: Wallet },
    { id: 'category', label: 'Spend by Category', icon: FolderTree },
    { id: 'funder', label: 'Funding by Funder', icon: Building2 },
    { id: 'decisions', label: 'Decisions Summary', icon: CheckSquare },
  ];

  return (
    <div className="space-y-6">
      <PageHero
        title="Reports"
        description="Budget utilisation, spending breakdowns, funding sources, and decision summaries."
        imageUrl="https://images.pexels.com/photos/3184465/pexels-photo-3184465.jpeg?auto=compress&cs=tinysrgb&h=300&w=1200"
      />

      {/* Tabs */}
      <div className="flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition ${
              tab === t.id
                ? 'bg-teal-600 text-white shadow-sm'
                : 'bg-white text-stone-600 border border-stone-200 hover:bg-stone-50'
            }`}
          >
            <t.icon size={16} />
            {t.label}
          </button>
        ))}
      </div>

      {loading && <LoadingSpinner label="Loading report..." />}
      {error && <ErrorState message={error} onRetry={loadData} />}

      {/* Budget vs Actual */}
      {!loading && !error && tab === 'budget' && (
        <ReportSection
          title="Budget vs Actual"
          onExport={() => exportCSV('budget-vs-actual.csv',
            ['Project', 'Code', 'Budget Line', 'Allocated', 'Approved Spend', 'Remaining', '% Used', 'Overspent'],
            budgetRows.map((r) => [r.projectName, r.projectCode, r.categoryName, r.allocated, r.approved, r.remaining, `${r.pctUsed.toFixed(1)}%`, r.overspent ? 'Yes' : 'No'])
          )}
        >
          {budgetRows.length === 0 ? (
            <EmptyState message="No budget data available." icon={Wallet} />
          ) : (
            <SimpleTable
              headers={['Project', 'Budget Line', 'Allocated', 'Approved', 'Remaining', '% Used', 'Status']}
              rows={budgetRows.map((r) => [
                `${r.projectName} (${r.projectCode})`,
                r.categoryName,
                formatCurrency(r.allocated),
                formatCurrency(r.approved),
                <span key="rem" className={r.overspent ? 'text-red-600 font-medium' : ''}>{formatCurrency(r.remaining)}</span>,
                `${r.pctUsed.toFixed(0)}%`,
                r.overspent
                  ? <span key="st" className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-red-100 text-red-700">Overspent</span>
                  : <span key="st" className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">On track</span>,
              ])}
            />
          )}
        </ReportSection>
      )}

      {/* Spend by Category */}
      {!loading && !error && tab === 'category' && (
        <ReportSection
          title="Spend by Category"
          onExport={() => exportCSV('spend-by-category.csv',
            ['Category', 'Approved Spend', 'Expense Count'],
            categoryRows.map((r) => [r.categoryName, r.approvedSpend, r.expenseCount])
          )}
        >
          {categoryRows.length === 0 ? (
            <EmptyState message="No approved expenses yet." icon={FolderTree} />
          ) : (
            <SimpleTable
              headers={['Category', 'Approved Spend', 'Expenses']}
              rows={categoryRows.map((r) => [
                r.categoryName,
                <span key="sp" className="font-semibold">{formatCurrency(r.approvedSpend)}</span>,
                r.expenseCount,
              ])}
            />
          )}
        </ReportSection>
      )}

      {/* Funding by Funder */}
      {!loading && !error && tab === 'funder' && (
        <ReportSection
          title="Funding by Funder"
          onExport={() => exportCSV('funding-by-funder.csv',
            ['Funder', 'Type', 'Total Funding', 'Entries', 'Projects'],
            funderRows.map((r) => [r.funderName, r.funderType, r.totalFunding, r.entryCount, r.projects.join('; ')])
          )}
        >
          {funderRows.length === 0 ? (
            <EmptyState message="No funding records yet." icon={Building2} />
          ) : (
            <SimpleTable
              headers={['Funder', 'Type', 'Total Funding', 'Entries', 'Projects']}
              rows={funderRows.map((r) => [
                r.funderName,
                <span key="tp" className="text-xs font-medium px-2 py-0.5 rounded-full bg-stone-100 text-stone-600 capitalize">{r.funderType}</span>,
                <span key="tf" className="font-semibold">{formatCurrency(r.totalFunding)}</span>,
                r.entryCount,
                r.projects.join(', '),
              ])}
            />
          )}
        </ReportSection>
      )}

      {/* Decisions Summary */}
      {!loading && !error && tab === 'decisions' && (
        <ReportSection
          title="Decisions Summary"
          onExport={() => exportCSV('decisions-summary.csv',
            ['Expense', 'Project', 'Outcome', 'Reason', 'Reviewer', 'Date'],
            [
              ...decisionSummary.rejectedExpenses.map((e) => [e.description, e.projectName, 'Rejected', e.reason, e.reviewerName, e.decidedAt]),
            ]
          )}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
            <div className="card-no-hover p-5 text-center">
              <p className="text-sm text-stone-500 mb-1">Approved</p>
              <p className="text-3xl font-bold text-emerald-600">{decisionSummary.approvedCount}</p>
            </div>
            <div className="card-no-hover p-5 text-center">
              <p className="text-sm text-stone-500 mb-1">Rejected</p>
              <p className="text-3xl font-bold text-red-600">{decisionSummary.rejectedCount}</p>
            </div>
          </div>

          {decisionSummary.rejectedExpenses.length === 0 ? (
            <EmptyState message="No rejected expenses." icon={CheckSquare} />
          ) : (
            <SimpleTable
              headers={['Expense', 'Project', 'Reason', 'Reviewer', 'Date']}
              rows={decisionSummary.rejectedExpenses.map((e) => [
                <span key="d" className="font-medium text-stone-700 flex items-center gap-1.5"><XCircle size={14} className="text-red-500" /> {e.description}</span>,
                e.projectName,
                e.reason,
                e.reviewerName,
                formatDate(e.decidedAt),
              ])}
            />
          )}
        </ReportSection>
      )}
    </div>
  );
}

function ReportSection({ title, onExport, children }: { title: string; onExport: () => void; children: React.ReactNode }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-stone-800">{title}</h2>
        <button
          onClick={onExport}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white btn-teal transition"
        >
          <Download size={16} /> Export CSV
        </button>
      </div>
      {children}
    </div>
  );
}

function SimpleTable({ headers, rows }: { headers: string[]; rows: React.ReactNode[][] }) {
  return (
    <div className="card-no-hover overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm zebra-table">
          <thead>
            <tr className="text-stone-500 text-xs uppercase tracking-wide bg-stone-50/80">
              {headers.map((h, i) => (
                <th key={i} className={`${i === 0 ? 'text-left' : 'text-left'} px-5 py-3 font-medium`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i}>
                {row.map((cell, j) => (
                  <td key={j} className="px-5 py-3.5 text-stone-600">{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
