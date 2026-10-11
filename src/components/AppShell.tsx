import { type ReactNode, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import type { Role } from '@/types';
import {
  LayoutDashboard,
  FolderKanban,
  Building2,
  DollarSign,
  Wallet,
  Receipt,
  CheckSquare,
  Paperclip,
  BarChart3,
  LogOut,
  Menu,
  X,
  Lock,
  Users,
} from 'lucide-react';

export type PageId =
  | 'dashboard'
  | 'projects'
  | 'funders'
  | 'funding'
  | 'budgets'
  | 'expenses'
  | 'decisions'
  | 'evidence'
  | 'reports'
  | 'users';

interface NavItem {
  id: PageId;
  label: string;
  icon: typeof LayoutDashboard;
  roles: Role[];
}

const navItems: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['admin', 'project_manager', 'finance_officer', 'reviewer'] },
  { id: 'projects', label: 'Projects', icon: FolderKanban, roles: ['admin', 'project_manager'] },
  { id: 'funders', label: 'Funders', icon: Building2, roles: ['admin', 'project_manager'] },
  { id: 'funding', label: 'Funding', icon: DollarSign, roles: ['admin', 'project_manager'] },
  { id: 'budgets', label: 'Budget Lines', icon: Wallet, roles: ['admin', 'project_manager'] },
  { id: 'expenses', label: 'Expenses', icon: Receipt, roles: ['admin', 'finance_officer'] },
  { id: 'decisions', label: 'Decisions', icon: CheckSquare, roles: ['admin', 'reviewer'] },
  { id: 'evidence', label: 'Evidence', icon: Paperclip, roles: ['admin', 'finance_officer', 'reviewer'] },
  { id: 'reports', label: 'Reports', icon: BarChart3, roles: ['admin', 'project_manager'] },
  { id: 'users', label: 'Users', icon: Users, roles: ['admin'] },
];

const roleLabels: Record<Role, string> = {
  admin: 'Administrator',
  project_manager: 'Project Manager',
  finance_officer: 'Finance Officer',
  reviewer: 'Reviewer',
};

const roleColors: Record<Role, string> = {
  admin: 'bg-amber-100 text-amber-800',
  project_manager: 'bg-sky-100 text-sky-800',
  finance_officer: 'bg-teal-100 text-teal-800',
  reviewer: 'bg-violet-100 text-violet-800',
};

interface AppShellProps {
  children: ReactNode;
  currentPage: PageId;
  onNavigate: (page: PageId) => void;
}

export default function AppShell({ children, currentPage, onNavigate }: AppShellProps) {
  const { profile, signOut, role } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  function handleNav(page: PageId) {
    onNavigate(page);
    setSidebarOpen(false);
  }

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside
        className={`fixed lg:sticky top-0 left-0 z-40 h-screen w-64 flex flex-col transition-transform duration-300 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
        style={{
          background: 'linear-gradient(180deg, #0d4f4f 0%, #115e63 50%, #0a3f3f 100%)',
        }}
      >
        {/* Texture overlay at bottom */}
        <div
          className="absolute bottom-0 left-0 right-0 h-32 opacity-10 pointer-events-none"
          style={{
            backgroundImage: 'url(https://images.pexels.com/photos/3184292/pexels-photo-3184292.jpeg?auto=compress&cs=tinysrgb&h=200&w=400)',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            maskImage: 'linear-gradient(to top, black, transparent)',
            WebkitMaskImage: 'linear-gradient(to top, black, transparent)',
          }}
        />

        {/* Logo */}
        <div className="px-5 py-5 border-b border-white/10 flex items-center justify-between relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-400 to-teal-500 flex items-center justify-center text-white font-bold shadow-lg shadow-teal-900/30">
              I
            </div>
            <div>
              <p className="font-semibold text-white text-sm leading-tight">Impact Ledger</p>
              <p className="text-teal-300/70 text-xs">Funding &amp; Expense Tracking</p>
            </div>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden text-teal-300/70 hover:text-white transition"
          >
            <X size={20} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1 relative z-10">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = currentPage === item.id;
            const allowed = role ? item.roles.includes(role) : false;
            return (
              <button
                key={item.id}
                onClick={() => handleNav(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                  active
                    ? 'bg-white/15 text-white nav-pill-glow'
                    : allowed
                      ? 'text-teal-100/70 hover:bg-white/8 hover:text-white'
                      : 'text-teal-100/40 hover:bg-white/5'
                }`}
              >
                <Icon size={18} className={`flex-shrink-0 ${active ? 'text-teal-300' : ''}`} />
                <span className="flex-1 text-left">{item.label}</span>
                {!allowed && (
                  <Lock size={13} className="flex-shrink-0 text-teal-100/30" />
                )}
              </button>
            );
          })}
        </nav>

        {/* User panel */}
        <div className="border-t border-white/10 p-4 relative z-10">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-teal-400 to-teal-500 flex items-center justify-center text-white font-semibold text-sm shadow-lg">
              {profile?.full_name?.charAt(0) ?? '?'}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-white truncate">{profile?.full_name}</p>
              <p className="text-xs text-teal-300/60 truncate">{profile?.email}</p>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${role ? roleColors[role] : ''}`}>
              {role ? roleLabels[role] : ''}
            </span>
            <button
              onClick={signOut}
              className="text-teal-300/60 hover:text-coral transition"
              title="Sign out"
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main content */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Mobile header */}
        <header
          className="lg:hidden sticky top-0 z-20 px-4 py-3 flex items-center justify-between backdrop-blur-md"
          style={{ background: 'rgba(13,79,79,0.95)' }}
        >
          <button
            onClick={() => setSidebarOpen(true)}
            className="text-white/80 hover:text-white"
          >
            <Menu size={22} />
          </button>
          <span className="font-semibold text-white text-sm">Impact Ledger</span>
          <div className="w-6" />
        </header>

        <main className="flex-1 p-5 lg:p-8 page-transition" key={currentPage}>
          {children}
        </main>
      </div>
    </div>
  );
}
