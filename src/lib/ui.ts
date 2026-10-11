import type { Role } from '@/types';

export const projectStatusConfig: Record<string, { label: string; badge: string }> = {
  active: { label: 'Active', badge: 'bg-emerald-100 text-emerald-700' },
  planning: { label: 'Planning', badge: 'bg-sky-100 text-sky-700' },
  closed: { label: 'Closed', badge: 'bg-stone-200 text-stone-600' },
  on_hold: { label: 'On Hold', badge: 'bg-amber-100 text-amber-700' },
};

export const expenseStatusConfig: Record<string, { label: string; badge: string }> = {
  approved: { label: 'Approved', badge: 'bg-emerald-100 text-emerald-700' },
  rejected: { label: 'Rejected', badge: 'bg-red-100 text-red-700' },
  submitted: { label: 'Awaiting Approval', badge: 'bg-amber-100 text-amber-700' },
};

export const funderTypeConfig: Record<string, { label: string; badge: string }> = {
  government: { label: 'Government', badge: 'bg-indigo-100 text-indigo-700' },
  foundation: { label: 'Foundation', badge: 'bg-teal-100 text-teal-700' },
  corporate: { label: 'Corporate', badge: 'bg-blue-100 text-blue-700' },
  individual: { label: 'Individual', badge: 'bg-stone-100 text-stone-600' },
  other: { label: 'Other', badge: 'bg-stone-100 text-stone-600' },
};

export const roleLabels: Record<Role, string> = {
  admin: 'Administrator',
  project_manager: 'Project Manager',
  finance_officer: 'Finance Officer',
  reviewer: 'Reviewer',
};

export const roleBadgeColors: Record<Role, string> = {
  admin: 'bg-amber-100 text-amber-800',
  project_manager: 'bg-blue-100 text-blue-800',
  finance_officer: 'bg-teal-100 text-teal-800',
  reviewer: 'bg-violet-100 text-violet-800',
};

export function canEdit(role: Role | null): boolean {
  return role === 'admin' || role === 'project_manager';
}
