export type Role = 'admin' | 'project_manager' | 'finance_officer' | 'reviewer';

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  role: Role;
  is_active: boolean;
}

export interface Funder {
  id: string;
  name: string;
  funder_type: 'government' | 'foundation' | 'corporate' | 'individual' | 'other';
  contact_person: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  notes: string | null;
}

export interface Project {
  id: string;
  name: string;
  code: string;
  description: string | null;
  status: 'planning' | 'active' | 'closed' | 'on_hold';
  start_date: string | null;
  end_date: string | null;
  manager_id: string | null;
  location: string | null;
}

export interface Funding {
  id: string;
  project_id: string;
  funder_id: string;
  amount: string;
  funding_date: string;
  reference_number: string | null;
  notes: string | null;
}

export interface Category {
  id: string;
  name: string;
  description: string | null;
}

export interface BudgetLine {
  id: string;
  project_id: string;
  category_id: string;
  funding_id: string | null;
  allocated_amount: string;
  period_start: string | null;
  period_end: string | null;
  notes: string | null;
}

export interface Expense {
  id: string;
  budget_line_id: string;
  project_id: string;
  submitted_by: string;
  amount: string;
  expense_date: string;
  vendor: string | null;
  description: string;
  status: 'submitted' | 'approved' | 'rejected';
  resubmission_of: string | null;
}

export interface Decision {
  id: string;
  expense_id: string;
  reviewer_id: string;
  action: 'approve' | 'reject';
  reason: string;
  decided_at: string;
}

export interface Evidence {
  id: string;
  expense_id: string;
  file_name: string;
  file_url: string;
  file_type: string | null;
  description: string | null;
  uploaded_by: string;
  created_at: string;
}

export interface BudgetSummary {
  budget_line_id: string;
  project_id: string;
  category_id: string;
  allocated_amount: string;
  submitted_total: string;
  approved_total: string;
  remaining: string;
  overspend: string;
  is_overspent: boolean;
}
