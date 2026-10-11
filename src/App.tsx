import { useState } from 'react';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import LoginPage from '@/pages/LoginPage';
import Dashboard from '@/pages/Dashboard';
import ProjectsPage from '@/pages/ProjectsPage';
import FundersPage from '@/pages/FundersPage';
import FundingPage from '@/pages/FundingPage';
import BudgetsPage from '@/pages/BudgetsPage';
import ExpensesPage from '@/pages/ExpensesPage';
import DecisionsPage from '@/pages/DecisionsPage';
import UsersPage from '@/pages/UsersPage';
import EvidencePage from '@/pages/EvidencePage';
import ReportsPage from '@/pages/ReportsPage';
import AppShell, { type PageId } from '@/components/AppShell';
import type { Role } from '@/types';
import { Lock, LayoutDashboard } from 'lucide-react';

const pageRoles: Record<PageId, Role[]> = {
  dashboard: ['admin', 'project_manager', 'finance_officer', 'reviewer'],
  projects: ['admin', 'project_manager'],
  funders: ['admin', 'project_manager'],
  funding: ['admin', 'project_manager'],
  budgets: ['admin', 'project_manager'],
  expenses: ['admin', 'finance_officer'],
  decisions: ['admin', 'reviewer'],
  evidence: ['admin', 'finance_officer', 'reviewer'],
  reports: ['admin', 'project_manager'],
  users: ['admin'],
};

const pageLabels: Record<PageId, string> = {
  dashboard: 'Dashboard',
  projects: 'Projects',
  funders: 'Funders',
  funding: 'Funding',
  budgets: 'Budget Lines',
  expenses: 'Expenses',
  decisions: 'Decisions',
  evidence: 'Evidence',
  reports: 'Reports',
  users: 'Users',
};

function AccessRestricted({ page, onNavigate }: { page: PageId; onNavigate: (p: PageId) => void }) {
  const allowed = pageRoles[page];
  const roleLabels: Record<Role, string> = {
    admin: 'Administrator',
    project_manager: 'Project Manager',
    finance_officer: 'Finance Officer',
    reviewer: 'Reviewer',
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
      <div className="w-16 h-16 rounded-2xl bg-stone-100 flex items-center justify-center mb-5">
        <Lock size={28} className="text-stone-400" />
      </div>
      <h2 className="text-2xl font-bold text-stone-700 mb-2">Access restricted</h2>
      <p className="text-stone-500 max-w-md mb-1">
        You don't have permission to view the <span className="font-medium text-stone-700">{pageLabels[page]}</span> page.
      </p>
      <p className="text-sm text-stone-400 mb-6">
        Only the following roles can access this page: {allowed.map((r) => roleLabels[r]).join(', ')}
      </p>
      <button
        onClick={() => onNavigate('dashboard')}
        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-white font-medium text-sm btn-teal"
      >
        <LayoutDashboard size={18} /> Back to Dashboard
      </button>
    </div>
  );
}

function AppContent() {
  const { user, profile, loading, role } = useAuth();
  const [page, setPage] = useState<PageId>('dashboard');

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-teal-700" />
      </div>
    );
  }

  if (!user || !profile) {
    return <LoginPage />;
  }

  const notYetBuilt: PageId[] = [];
  const allowed = role ? pageRoles[page].includes(role) : false;

  let content: React.ReactNode;

  if (!allowed) {
    content = <AccessRestricted page={page} onNavigate={setPage} />;
  } else if (notYetBuilt.includes(page)) {
    content = <ComingSoon title={page} />;
  } else if (page === 'dashboard') {
    content = <Dashboard />;
  } else if (page === 'projects') {
    content = <ProjectsPage />;
  } else if (page === 'funders') {
    content = <FundersPage />;
  } else if (page === 'funding') {
    content = <FundingPage />;
  } else if (page === 'budgets') {
    content = <BudgetsPage />;
  } else if (page === 'expenses') {
    content = <ExpensesPage />;
  } else if (page === 'decisions') {
    content = <DecisionsPage />;
  } else if (page === 'users') {
    content = <UsersPage />;
  } else if (page === 'evidence') {
    content = <EvidencePage />;
  } else if (page === 'reports') {
    content = <ReportsPage />;
  }

  return (
    <AppShell currentPage={page} onNavigate={setPage}>
      {content}
    </AppShell>
  );
}

function ComingSoon({ title }: { title: PageId }) {
  const labels: Record<string, string> = {
    evidence: 'Evidence',
    reports: 'Reports',
  };
  return (
    <div className="flex flex-col items-center justify-center h-64 text-center">
      <p className="text-2xl font-bold text-stone-300">{labels[title] ?? pageLabels[title]}</p>
      <p className="text-stone-400 mt-2">This section will be built in the next step.</p>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
