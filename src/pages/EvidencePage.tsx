import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import type { Evidence, Expense, Project, Profile } from '@/types';
import { formatDate } from '@/lib/format';
import { LoadingSpinner, ErrorState, EmptyState } from '@/components/States';
import PageHero from '@/components/PageHero';
import {
  Paperclip,
  ExternalLink,
  AlertTriangle,
  FileText,
  Search,
} from 'lucide-react';

interface EvidenceRow extends Evidence {
  expense?: Expense & { project?: Project };
  uploader?: Profile;
}

interface MissingExpense extends Expense {
  project?: Project;
  submitter?: Profile;
}

export default function EvidencePage() {
  const [rows, setRows] = useState<EvidenceRow[]>([]);
  const [missing, setMissing] = useState<MissingExpense[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showMissing, setShowMissing] = useState(false);
  const [search, setSearch] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);

    const [evRes, expRes, projRes, profileRes] = await Promise.all([
      supabase.from('evidence').select('*').order('created_at', { ascending: false }),
      supabase.from('expenses').select('*').order('expense_date', { ascending: false }),
      supabase.from('projects').select('*').order('name'),
      supabase.from('profiles').select('*'),
    ]);

    if (evRes.error || expRes.error || projRes.error || profileRes.error) {
      setError('Unable to load evidence data. Please try again.');
      setLoading(false);
      return;
    }

    const profileMap = new Map<string, Profile>();
    (profileRes.data as Profile[]).forEach((p) => profileMap.set(p.id, p));

    const projectMap = new Map<string, Project>();
    (projRes.data as Project[]).forEach((p) => projectMap.set(p.id, p));

    const expenseMap = new Map<string, Expense>();
    (expRes.data as Expense[]).forEach((e) => expenseMap.set(e.id, e));

    const evidenceRows: EvidenceRow[] = (evRes.data as Evidence[]).map((ev) => {
      const exp = expenseMap.get(ev.expense_id);
      return {
        ...ev,
        expense: exp ? { ...exp, project: projectMap.get(exp.project_id) } : undefined,
        uploader: profileMap.get(ev.uploaded_by),
      };
    });

    setRows(evidenceRows);

    const expenseIdsWithEvidence = new Set((evRes.data as Evidence[]).map((e) => e.expense_id));
    const missingExpenses: MissingExpense[] = (expRes.data as Expense[])
      .filter((e) => (e.status === 'submitted' || e.status === 'approved') && !expenseIdsWithEvidence.has(e.id))
      .map((e) => ({
        ...e,
        project: projectMap.get(e.project_id),
        submitter: profileMap.get(e.submitted_by),
      }));

    setMissing(missingExpenses);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filteredRows = useMemo(() => {
    if (!search.trim()) return rows;
    const q = search.toLowerCase();
    return rows.filter(
      (r) =>
        r.file_name.toLowerCase().includes(q) ||
        (r.expense?.description ?? '').toLowerCase().includes(q) ||
        (r.expense?.project?.name ?? '').toLowerCase().includes(q) ||
        (r.uploader?.full_name ?? '').toLowerCase().includes(q)
    );
  }, [rows, search]);

  return (
    <div className="space-y-6">
      <PageHero
        title="Evidence"
        description="All evidence documents linked to expenses across projects."
        imageUrl="https://images.pexels.com/photos/3184432/pexels-photo-3184432.jpeg?auto=compress&cs=tinysrgb&h=300&w=1200"
      />

      <div className="card-no-hover p-4 flex flex-col sm:flex-row gap-3 sm:items-center">
        <div className="relative flex-1">
          <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search file, expense, project, uploader..."
            className="w-full pl-11 pr-4 py-2.5 rounded-xl border border-stone-200 bg-stone-50/50 text-stone-800 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-teal-600 focus:bg-white focus:border-transparent transition text-sm"
          />
        </div>
        <button
          onClick={() => setShowMissing(!showMissing)}
          className={`px-4 py-2.5 rounded-xl text-sm font-medium transition flex items-center gap-2 whitespace-nowrap ${
            showMissing
              ? 'bg-amber-50 text-amber-700 border border-amber-200'
              : 'bg-stone-50 text-stone-600 border border-stone-200 hover:bg-stone-100'
          }`}
        >
          <AlertTriangle size={15} />
          {showMissing ? 'Showing missing only' : 'Show missing evidence'}
        </button>
      </div>

      {loading && <LoadingSpinner label="Loading..." />}
      {error && <ErrorState message={error} onRetry={loadData} />}

      {/* Missing evidence view */}
      {!loading && !error && showMissing && (
        <>
          {missing.length === 0 ? (
            <EmptyState message="All submitted and approved expenses have evidence attached." icon={Paperclip} />
          ) : (
            <div className="card-no-hover overflow-hidden">
              <div className="px-5 py-3 bg-amber-50/60 border-b border-amber-100 text-sm text-amber-800 flex items-center gap-2">
                <AlertTriangle size={16} />
                {missing.length} expense{missing.length !== 1 ? 's' : ''} with no evidence attached.
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm zebra-table">
                  <thead>
                    <tr className="text-stone-500 text-xs uppercase tracking-wide bg-stone-50/80">
                      <th className="text-left px-5 py-3 font-medium">Expense</th>
                      <th className="text-left px-5 py-3 font-medium">Project</th>
                      <th className="text-left px-5 py-3 font-medium">Submitter</th>
                      <th className="text-left px-5 py-3 font-medium">Date</th>
                      <th className="text-center px-5 py-3 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {missing.map((e) => (
                      <tr key={e.id}>
                        <td className="px-5 py-3.5">
                          <p className="font-medium text-stone-700 truncate max-w-xs">{e.description}</p>
                        </td>
                        <td className="px-5 py-3.5 text-stone-600">{e.project?.name ?? '—'}</td>
                        <td className="px-5 py-3.5 text-stone-600">{e.submitter?.full_name ?? '—'}</td>
                        <td className="px-5 py-3.5 text-stone-500">{formatDate(e.expense_date)}</td>
                        <td className="px-5 py-3.5 text-center">
                          <span className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full ${
                            e.status === 'approved' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                          }`}>
                            {e.status === 'approved' ? 'Approved' : 'Awaiting Approval'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* All evidence view */}
      {!loading && !error && !showMissing && (
        <>
          {filteredRows.length === 0 ? (
            <EmptyState message="No evidence documents found." icon={Paperclip} />
          ) : (
            <div className="card-no-hover overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm zebra-table">
                  <thead>
                    <tr className="text-stone-500 text-xs uppercase tracking-wide bg-stone-50/80">
                      <th className="text-left px-5 py-3 font-medium">File Name</th>
                      <th className="text-left px-5 py-3 font-medium">Type</th>
                      <th className="text-left px-5 py-3 font-medium">Expense</th>
                      <th className="text-left px-5 py-3 font-medium">Project</th>
                      <th className="text-left px-5 py-3 font-medium">Uploader</th>
                      <th className="text-left px-5 py-3 font-medium">Date</th>
                      <th className="text-center px-5 py-3 font-medium"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRows.map((r) => (
                      <tr key={r.id}>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-2">
                            <FileText size={15} className="text-teal-600 flex-shrink-0" />
                            <p className="font-medium text-stone-700 truncate max-w-xs">{r.file_name}</p>
                          </div>
                        </td>
                        <td className="px-5 py-3.5">
                          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-stone-100 text-stone-600 capitalize">
                            {r.file_type ?? 'other'}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-stone-600 truncate max-w-xs">
                          {r.expense?.description ?? '—'}
                        </td>
                        <td className="px-5 py-3.5 text-stone-600">
                          {r.expense?.project?.name ?? '—'}
                        </td>
                        <td className="px-5 py-3.5 text-stone-600">
                          {r.uploader?.full_name ?? '—'}
                        </td>
                        <td className="px-5 py-3.5 text-stone-500">{formatDate(r.created_at)}</td>
                        <td className="px-5 py-3.5 text-center">
                          <a
                            href={r.file_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs font-medium text-teal-700 hover:text-teal-800 transition"
                          >
                            <ExternalLink size={14} /> Open
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
