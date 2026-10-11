import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import type { BudgetSummary, Project, Category, Expense, Funder, Funding, Decision } from '@/types';
import { formatCurrency, formatCurrencyCompact, formatDate } from '@/lib/format';
import { LoadingSpinner, ErrorState } from '@/components/States';
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  AlertTriangle,
  FolderKanban,
  Building2,
  Receipt,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowRight,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';

interface DashboardData {
  totalFunding: number;
  totalBudget: number;
  totalApproved: number;
  projectCount: number;
  funderCount: number;
  expenseCount: number;
  approvedCount: number;
  rejectedCount: number;
  pendingCount: number;
  overspentCount: number;
  remainingBudget: number;
  spendingByProject: { name: string; approved: number; budget: number }[];
  expenseStatusData: { name: string; value: number; color: string }[];
  fundingByFunder: { name: string; amount: number }[];
  pendingExpenses: (Expense & { project?: Project })[];
  recentActivity: ActivityItem[];
  budgetSummaries: (BudgetSummary & { project?: Project; category?: Category })[];
}

interface ActivityItem {
  id: string;
  type: 'expense' | 'decision' | 'funding';
  description: string;
  amount?: string;
  date: string;
  projectName?: string;
}

const CHART_COLORS = {
  approved: '#10b981',
  pending: '#f59e0b',
  rejected: '#ef4444',
  teal: '#14919b',
  coral: '#ff7a59',
  blue: '#3b82f6',
  amber: '#f59e0b',
  indigo: '#6366f1',
};

export default function Dashboard() {
  const { profile } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadDashboard();
  }, []);

  async function loadDashboard() {
    setLoading(true);
    setError(null);

    const [funding, budgetLines, budgetSummary, projects, funders, expenses, categories, fundingFunders, decisions, recentExpenses] = await Promise.all([
      supabase.from('funding').select('amount, funder_id, project_id'),
      supabase.from('budget_lines').select('allocated_amount, project_id'),
      supabase.from('budget_summary').select('*'),
      supabase.from('projects').select('*'),
      supabase.from('funders').select('*'),
      supabase.from('expenses').select('*, project:projects(*)'),
      supabase.from('categories').select('*'),
      supabase.from('funding').select('*, funder:funders(*), project:projects(*)'),
      supabase.from('decisions').select('*, expense:expenses(*), reviewer:profiles(*)').order('decided_at', { ascending: false }).limit(5),
      supabase.from('expenses').select('*, project:projects(*)').order('created_at', { ascending: false }).limit(5),
    ]);

    const anyError = funding.error || budgetLines.error || budgetSummary.error || projects.error || funders.error || expenses.error || categories.error;
    if (anyError) {
      setError('Unable to load dashboard data. Please try again.');
      setLoading(false);
      return;
    }

    const allProjects = projects.data as Project[];
    const allFunders = funders.data as Funder[];
    const allCategories = categories.data as Category[];
    const summaries = (budgetSummary.data ?? []) as BudgetSummary[];

    const totalFunding = (funding.data ?? []).reduce((s, f) => s + parseFloat(String((f as any).amount)), 0);
    const totalBudget = (budgetLines.data ?? []).reduce((s, b) => s + parseFloat(String((b as any).allocated_amount)), 0);
    const totalApproved = summaries.reduce((s, b) => s + parseFloat(b.approved_total), 0);
    const overspentCount = summaries.filter((b) => b.is_overspent).length;
    const remainingBudget = totalBudget - totalApproved;

    const expenseList = expenses.data as any[];
    const approvedCount = expenseList.filter((e) => e.status === 'approved').length;
    const rejectedCount = expenseList.filter((e) => e.status === 'rejected').length;
    const pendingCount = expenseList.filter((e) => e.status === 'submitted').length;

    // Spending by project
    const projectSpendMap = new Map<string, { approved: number; budget: number }>();
    summaries.forEach((s) => {
      const cur = projectSpendMap.get(s.project_id) ?? { approved: 0, budget: 0 };
      cur.approved += parseFloat(s.approved_total);
      cur.budget += parseFloat(s.allocated_amount);
      projectSpendMap.set(s.project_id, cur);
    });
    const spendingByProject = allProjects.map((p) => {
      const vals = projectSpendMap.get(p.id) ?? { approved: 0, budget: 0 };
      return { name: p.name.length > 18 ? p.name.slice(0, 18) + '...' : p.name, approved: vals.approved, budget: vals.budget };
    }).filter((p) => p.budget > 0);

    // Expense status donut
    const expenseStatusData = [
      { name: 'Approved', value: approvedCount, color: CHART_COLORS.approved },
      { name: 'Pending', value: pendingCount, color: CHART_COLORS.pending },
      { name: 'Rejected', value: rejectedCount, color: CHART_COLORS.rejected },
    ].filter((d) => d.value > 0);

    // Funding by funder
    const funderMap = new Map<string, number>();
    (fundingFunders.data as any[] ?? []).forEach((f) => {
      const cur = funderMap.get(f.funder_id) ?? 0;
      funderMap.set(f.funder_id, cur + parseFloat(String(f.amount)));
    });
    const fundingByFunder = allFunders.map((f) => ({
      name: f.name.length > 16 ? f.name.slice(0, 16) + '...' : f.name,
      amount: funderMap.get(f.id) ?? 0,
    })).filter((f) => f.amount > 0);

    // Pending expenses (submitted)
    const pendingExpenses = expenseList.filter((e) => e.status === 'submitted').slice(0, 5) as (Expense & { project?: Project })[];

    // Recent activity feed
    const activity: ActivityItem[] = [];
    (recentExpenses.data as any[] ?? []).forEach((e) => {
      activity.push({
        id: `exp-${e.id}`,
        type: 'expense',
        description: e.description,
        amount: String(e.amount),
        date: e.expense_date ?? e.created_at,
        projectName: e.project?.name,
      });
    });
    (decisions.data as any[] ?? []).forEach((d) => {
      activity.push({
        id: `dec-${d.id}`,
        type: 'decision',
        description: `${d.action === 'approve' ? 'Approved' : 'Rejected'}: ${d.expense?.description ?? 'expense'}`,
        date: d.decided_at,
        projectName: d.expense?.project?.name,
      });
    });
    activity.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    const recentActivity = activity.slice(0, 6);

    const enrichedSummaries = summaries.map((bs) => ({
      ...bs,
      project: allProjects.find((p) => p.id === bs.project_id),
      category: allCategories.find((c) => c.id === bs.category_id),
    }));

    setData({
      totalFunding, totalBudget, totalApproved,
      projectCount: allProjects.length,
      funderCount: allFunders.length,
      expenseCount: expenseList.length,
      approvedCount, rejectedCount, pendingCount,
      overspentCount, remainingBudget,
      spendingByProject, expenseStatusData, fundingByFunder,
      pendingExpenses, recentActivity,
      budgetSummaries: enrichedSummaries,
    });
    setLoading(false);
  }

  if (loading) return <LoadingSpinner label="Loading dashboard..." />;
  if (error) return <ErrorState message={error} onRetry={loadDashboard} />;
  if (!data) return null;

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const firstName = profile?.full_name?.split(' ')[0] ?? 'there';

  return (
    <div className="space-y-6">
      {/* Greeting hero */}
      <div className="hero-banner relative">
        <div className="absolute inset-0">
          <img src="https://images.pexels.com/photos/3184292/pexels-photo-3184292.jpeg?auto=compress&cs=tinysrgb&h=300&w=1200" alt="" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#0d4f4f]/95 via-[#115e63]/90 to-[#14919b]/75" />
        </div>
        <div className="relative px-6 py-7 sm:px-8 sm:py-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-white leading-tight">
            {greeting}, {firstName}.
          </h1>
          <p className="text-teal-100 mt-1.5 text-base max-w-xl">
            Here's where every rupee stands.
          </p>
          <div className="flex flex-wrap gap-5 mt-5">
            <div className="flex items-center gap-2">
              <TrendingUp size={18} className="text-teal-300" />
              <span className="text-white text-sm font-medium">{formatCurrency(data.totalFunding)}</span>
              <span className="text-teal-200/70 text-xs">funding</span>
            </div>
            <div className="flex items-center gap-2">
              <Wallet size={18} className="text-teal-300" />
              <span className="text-white text-sm font-medium">{formatCurrency(data.totalBudget)}</span>
              <span className="text-teal-200/70 text-xs">budgeted</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 size={18} className="text-teal-300" />
              <span className="text-white text-sm font-medium">{formatCurrency(data.totalApproved)}</span>
              <span className="text-teal-200/70 text-xs">approved spend</span>
            </div>
          </div>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Funding Received" value={formatCurrency(data.totalFunding)} icon={TrendingUp} gradient="from-teal-500 to-teal-600" />
        <StatCard label="Total Budget Allocated" value={formatCurrency(data.totalBudget)} icon={Wallet} gradient="from-blue-500 to-blue-600" />
        <StatCard label="Approved Spend" value={formatCurrency(data.totalApproved)} icon={CheckCircle2} gradient="from-emerald-500 to-emerald-600" />
        <StatCard label="Budget Remaining" value={formatCurrency(data.remainingBudget)} icon={TrendingDown} gradient={data.remainingBudget < 0 ? 'from-red-500 to-red-600' : 'from-amber-500 to-amber-600'} />
      </div>

      {/* Mini stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <MiniStat label="Projects" value={data.projectCount} icon={FolderKanban} color="text-teal-600" />
        <MiniStat label="Funders" value={data.funderCount} icon={Building2} color="text-blue-600" />
        <MiniStat label="Expenses" value={data.expenseCount} icon={Receipt} color="text-stone-600" />
        <MiniStat label="Approved" value={data.approvedCount} icon={CheckCircle2} color="text-emerald-600" />
        <MiniStat label="Pending" value={data.pendingCount} icon={Clock} color="text-amber-600" />
        <MiniStat label="Rejected" value={data.rejectedCount} icon={XCircle} color="text-red-600" />
      </div>

      {/* Overspend alert */}
      {data.overspentCount > 0 && (
        <div className="rounded-2xl bg-amber-50 border border-amber-200 px-5 py-4 flex items-start gap-3 shadow-sm">
          <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-amber-900">
              {data.overspentCount} budget {data.overspentCount === 1 ? 'line is' : 'lines are'} overspent
            </p>
            <p className="text-sm text-amber-700 mt-0.5">
              Approved expenses exceed the allocated budget. Review the budget lines to take corrective action.
            </p>
          </div>
        </div>
      )}

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Spending by project */}
        <div className="card-no-hover p-5">
          <h3 className="font-semibold text-stone-800 mb-1">Spending by Project</h3>
          <p className="text-sm text-stone-400 mb-4">Approved spend vs. budget allocation</p>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={data.spendingByProject} margin={{ left: -10, right: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#78716c' }} angle={-15} textAnchor="end" height={60} interval={0} />
              <YAxis tickFormatter={(v) => formatCurrencyCompact(v)} tick={{ fontSize: 11, fill: '#78716c' }} />
              <Tooltip formatter={(v) => formatCurrency(Number(v))} contentStyle={{ borderRadius: '0.75rem', border: '1px solid #e7e5e4', fontSize: '13px' }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="budget" fill="#c7d2fe" name="Budget" radius={[4, 4, 0, 0]} />
              <Bar dataKey="approved" fill="#14919b" name="Approved" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Expense status donut */}
        <div className="card-no-hover p-5">
          <h3 className="font-semibold text-stone-800 mb-1">Expense Status</h3>
          <p className="text-sm text-stone-400 mb-4">Distribution of all expense submissions</p>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={data.expenseStatusData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={3}>
                {data.expenseStatusData.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ borderRadius: '0.75rem', border: '1px solid #e7e5e4', fontSize: '13px' }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Funding by funder + Pending reviews */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="card-no-hover p-5 lg:col-span-2">
          <h3 className="font-semibold text-stone-800 mb-1">Funding by Funder</h3>
          <p className="text-sm text-stone-400 mb-4">Total contributions from each funder</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data.fundingByFunder} layout="vertical" margin={{ left: 20, right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
              <XAxis type="number" tickFormatter={(v) => formatCurrencyCompact(v)} tick={{ fontSize: 11, fill: '#78716c' }} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#78716c' }} width={120} />
              <Tooltip formatter={(v) => formatCurrency(Number(v))} contentStyle={{ borderRadius: '0.75rem', border: '1px solid #e7e5e4', fontSize: '13px' }} />
              <Bar dataKey="amount" fill="#ff7a59" name="Funded" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Pending reviews */}
        <div className="card-no-hover p-5">
          <div className="flex items-center gap-2 mb-1">
            <Clock size={18} className="text-amber-600" />
            <h3 className="font-semibold text-stone-800">Pending Reviews</h3>
          </div>
          <p className="text-sm text-stone-400 mb-4">Expenses awaiting approval</p>
          {data.pendingExpenses.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <CheckCircle2 size={28} className="text-emerald-400 mb-2" />
              <p className="text-sm text-stone-400">All caught up — no pending expenses.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {data.pendingExpenses.map((e) => (
                <div key={e.id} className="flex items-start justify-between gap-3 pb-3 border-b border-stone-100 last:border-0 last:pb-0">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-stone-700 truncate">{e.description}</p>
                    <p className="text-xs text-stone-400 mt-0.5">{e.project?.name ?? '—'}</p>
                  </div>
                  <span className="text-sm font-semibold text-amber-700 flex-shrink-0">{formatCurrency(parseFloat(e.amount))}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recent activity feed */}
      <div className="card-no-hover p-5">
        <h3 className="font-semibold text-stone-800 mb-1">Recent Activity</h3>
        <p className="text-sm text-stone-400 mb-4">Latest expenses and decisions across all projects</p>
        <div className="space-y-1">
          {data.recentActivity.map((item) => (
            <div key={item.id} className="flex items-center gap-3 py-2.5 border-b border-stone-50 last:border-0">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                item.type === 'decision' ? 'bg-teal-50 text-teal-600' : 'bg-amber-50 text-amber-600'
              }`}>
                {item.type === 'decision' ? <CheckCircle2 size={16} /> : <Receipt size={16} />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-stone-700 truncate">{item.description}</p>
                <p className="text-xs text-stone-400">
                  {item.projectName ?? '—'} · {formatDate(item.date)}
                </p>
              </div>
              {item.amount && (
                <span className="text-sm font-medium text-stone-600 flex-shrink-0">{formatCurrency(parseFloat(item.amount))}</span>
              )}
            </div>
          ))}
          {data.recentActivity.length === 0 && (
            <p className="text-sm text-stone-400 text-center py-6">No recent activity.</p>
          )}
        </div>
      </div>

      {/* Budget summary table */}
      <div className="card-no-hover overflow-hidden">
        <div className="px-5 py-4 border-b border-stone-100">
          <h2 className="font-semibold text-stone-800">Budget Summary by Line</h2>
          <p className="text-sm text-stone-400 mt-0.5">Allocated vs. approved spend per budget line</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm zebra-table">
            <thead>
              <tr className="text-stone-500 text-xs uppercase tracking-wide bg-stone-50/80">
                <th className="text-left px-5 py-3 font-medium">Project</th>
                <th className="text-left px-5 py-3 font-medium">Category</th>
                <th className="text-right px-5 py-3 font-medium">Allocated</th>
                <th className="text-right px-5 py-3 font-medium">Approved</th>
                <th className="text-right px-5 py-3 font-medium">Remaining</th>
                <th className="text-center px-5 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {data.budgetSummaries.map((bl) => {
                const remaining = parseFloat(bl.remaining);
                return (
                  <tr key={bl.budget_line_id} className="transition">
                    <td className="px-5 py-3">
                      <span className="text-stone-700 font-medium">{bl.project?.name ?? '—'}</span>
                      <span className="text-stone-400 text-xs ml-2">{bl.project?.code}</span>
                    </td>
                    <td className="px-5 py-3 text-stone-600">{bl.category?.name ?? '—'}</td>
                    <td className="px-5 py-3 text-right text-stone-700 font-medium">{formatCurrency(parseFloat(bl.allocated_amount))}</td>
                    <td className="px-5 py-3 text-right text-stone-600">{formatCurrency(parseFloat(bl.approved_total))}</td>
                    <td className={`px-5 py-3 text-right font-medium ${remaining < 0 ? 'text-red-600' : 'text-stone-700'}`}>
                      {formatCurrency(remaining)}
                    </td>
                    <td className="px-5 py-3 text-center">
                      {bl.is_overspent ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-red-700 bg-red-100 px-2.5 py-1 rounded-full">
                          <AlertTriangle size={12} /> Overspent
                        </span>
                      ) : parseFloat(bl.approved_total) > 0 ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-100 px-2.5 py-1 rounded-full">
                          On Track
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-stone-500 bg-stone-100 px-2.5 py-1 rounded-full">
                          Not Started
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label, value, icon: Icon, gradient,
}: {
  label: string; value: string; icon: typeof TrendingUp; gradient: string;
}) {
  return (
    <div className="card-base p-5 flex items-center justify-between">
      <div>
        <p className="text-sm text-stone-500">{label}</p>
        <p className="text-2xl font-bold text-stone-800 mt-1">{value}</p>
      </div>
      <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center shadow-lg`}>
        <Icon size={22} className="text-white" />
      </div>
    </div>
  );
}

function MiniStat({
  label, value, icon: Icon, color = 'text-stone-700',
}: {
  label: string; value: number; icon: typeof FolderKanban; color?: string;
}) {
  return (
    <div className="card-no-hover p-3 flex flex-col items-center text-center">
      <Icon size={18} className={color} />
      <p className={`text-xl font-bold mt-1 ${color}`}>{value}</p>
      <p className="text-xs text-stone-400 mt-0.5">{label}</p>
    </div>
  );
}
