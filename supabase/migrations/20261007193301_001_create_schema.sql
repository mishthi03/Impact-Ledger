/*
# Impact Ledger — Core Schema for Asha Community Trust

## Purpose
Internal web app to track the full journey of money:
Project → Funding → Budget → Expense → Review → Decision → Evidence → Reports.
Replaces Excel tracking for an NGO.

## Tables Created
1. **profiles** — links auth.users to a role (admin, project_manager, finance_officer, reviewer) and display name
2. **funders** — organizations that provide funding (e.g., USAID, Ford Foundation)
3. **projects** — NGO projects with status and lifecycle dates
4. **funding** — money received from a funder for a project
5. **categories** — expense categories (e.g., Travel, Supplies, Personnel)
6. **budget_lines** — budget allocated per project + category (+ optional funding source)
7. **expenses** — individual expense submissions against a budget line
8. **decisions** — approve/reject decisions stored separately from expenses (one-to-many: an expense can be submitted, rejected, resubmitted, approved)
9. **evidence** — supporting files/metadata for expenses
10. **audit_log** — trigger-based audit trail of all changes

## Constraints
- All monetary amounts CHECK > 0
- Expense status limited to 'submitted', 'approved', 'rejected'
- Decision action limited to 'approve', 'reject'
- Project status limited to 'planning', 'active', 'closed', 'on_hold'
- Funder type limited to 'government', 'foundation', 'corporate', 'individual', 'other'
- Nothing hard-deleted: all tables have is_deleted boolean default false

## Views
- **budget_summary** — per budget line: allocated, total submitted, total approved, remaining
- **overspent_lines** — budget lines where approved spend exceeds allocation

## Audit
- Trigger function `fn_audit_log()` logs INSERT/UPDATE/DELETE on monitored tables
- Triggers on: funders, projects, funding, categories, budget_lines, expenses, decisions, evidence

## Security
- RLS enabled on all tables
- Policies in a separate migration (002)
*/

-- ============================================================
-- profiles
-- ============================================================
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  full_name text NOT NULL,
  role text NOT NULL CHECK (role IN ('admin', 'project_manager', 'finance_officer', 'reviewer')),
  is_active boolean NOT NULL DEFAULT true,
  is_deleted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- funders
-- ============================================================
CREATE TABLE IF NOT EXISTS funders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  funder_type text NOT NULL CHECK (funder_type IN ('government', 'foundation', 'corporate', 'individual', 'other')),
  contact_person text,
  contact_email text,
  contact_phone text,
  notes text,
  is_deleted boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE funders ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- projects
-- ============================================================
CREATE TABLE IF NOT EXISTS projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text NOT NULL UNIQUE,
  description text,
  status text NOT NULL CHECK (status IN ('planning', 'active', 'closed', 'on_hold')),
  start_date date,
  end_date date,
  manager_id uuid REFERENCES auth.users(id),
  location text,
  is_deleted boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- funding
-- ============================================================
CREATE TABLE IF NOT EXISTS funding (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE RESTRICT,
  funder_id uuid NOT NULL REFERENCES funders(id) ON DELETE RESTRICT,
  amount numeric(14,2) NOT NULL CHECK (amount > 0),
  funding_date date NOT NULL,
  reference_number text,
  notes text,
  is_deleted boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE funding ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_funding_project ON funding(project_id);
CREATE INDEX IF NOT EXISTS idx_funding_funder ON funding(funder_id);

-- ============================================================
-- categories
-- ============================================================
CREATE TABLE IF NOT EXISTS categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text,
  is_deleted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- budget_lines
-- ============================================================
CREATE TABLE IF NOT EXISTS budget_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE RESTRICT,
  category_id uuid NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
  funding_id uuid REFERENCES funding(id) ON DELETE SET NULL,
  allocated_amount numeric(14,2) NOT NULL CHECK (allocated_amount > 0),
  period_start date,
  period_end date,
  notes text,
  is_deleted boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE budget_lines ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_budget_lines_project ON budget_lines(project_id);
CREATE INDEX IF NOT EXISTS idx_budget_lines_category ON budget_lines(category_id);

-- ============================================================
-- expenses
-- ============================================================
CREATE TABLE IF NOT EXISTS expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_line_id uuid NOT NULL REFERENCES budget_lines(id) ON DELETE RESTRICT,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE RESTRICT,
  submitted_by uuid NOT NULL REFERENCES auth.users(id),
  amount numeric(14,2) NOT NULL CHECK (amount > 0),
  expense_date date NOT NULL,
  vendor text,
  description text NOT NULL,
  status text NOT NULL CHECK (status IN ('submitted', 'approved', 'rejected')),
  is_deleted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_expenses_budget_line ON expenses(budget_line_id);
CREATE INDEX IF NOT EXISTS idx_expenses_project ON expenses(project_id);
CREATE INDEX IF NOT EXISTS idx_expenses_status ON expenses(status);

-- ============================================================
-- decisions
-- ============================================================
CREATE TABLE IF NOT EXISTS decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_id uuid NOT NULL REFERENCES expenses(id) ON DELETE RESTRICT,
  reviewer_id uuid NOT NULL REFERENCES auth.users(id),
  action text NOT NULL CHECK (action IN ('approve', 'reject')),
  reason text NOT NULL,
  decided_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE decisions ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_decisions_expense ON decisions(expense_id);

-- ============================================================
-- evidence
-- ============================================================
CREATE TABLE IF NOT EXISTS evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_id uuid NOT NULL REFERENCES expenses(id) ON DELETE RESTRICT,
  file_name text NOT NULL,
  file_url text NOT NULL,
  file_type text,
  description text,
  uploaded_by uuid NOT NULL REFERENCES auth.users(id),
  is_deleted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE evidence ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_evidence_expense ON evidence(expense_id);

-- ============================================================
-- audit_log
-- ============================================================
CREATE TABLE IF NOT EXISTS audit_log (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  table_name text NOT NULL,
  record_id uuid,
  action text NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
  changed_by uuid REFERENCES auth.users(id),
  old_values jsonb,
  new_values jsonb,
  changed_at timestamptz NOT NULL DEFAULT now()
);

-- audit_log is readable by admins only; written by trigger (SECURITY DEFINER)
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- Helper function: current user role
-- ============================================================
CREATE OR REPLACE FUNCTION current_user_role()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT role FROM profiles WHERE id = auth.uid() AND is_active = true AND is_deleted = false;
$$;

-- ============================================================
-- Audit trigger function
-- ============================================================
CREATE OR REPLACE FUNCTION fn_audit_log()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_record_id uuid;
  v_old jsonb;
  v_new jsonb;
  v_action text;
  v_user uuid;
BEGIN
  v_user := auth.uid();
  v_action := TG_OP;

  IF TG_OP = 'DELETE' THEN
    v_record_id := COALESCE(old.id, NULL);
    v_old := to_jsonb(old);
    v_new := NULL;
  ELSIF TG_OP = 'UPDATE' THEN
    v_record_id := COALESCE(new.id, old.id);
    v_old := to_jsonb(old);
    v_new := to_jsonb(new);
  ELSIF TG_OP = 'INSERT' THEN
    v_record_id := COALESCE(new.id, NULL);
    v_old := NULL;
    v_new := to_jsonb(new);
  END IF;

  INSERT INTO audit_log (table_name, record_id, action, changed_by, old_values, new_values)
  VALUES (TG_TABLE_NAME, v_record_id, v_action, v_user, v_old, v_new);

  RETURN COALESCE(new, old);
END;
$$;

-- Audit triggers (AFTER INSERT/UPDATE/DELETE)
DROP TRIGGER IF EXISTS trg_audit_funders ON funders;
CREATE TRIGGER trg_audit_funders AFTER INSERT OR UPDATE OR DELETE ON funders
  FOR EACH ROW EXECUTE FUNCTION fn_audit_log();

DROP TRIGGER IF EXISTS trg_audit_projects ON projects;
CREATE TRIGGER trg_audit_projects AFTER INSERT OR UPDATE OR DELETE ON projects
  FOR EACH ROW EXECUTE FUNCTION fn_audit_log();

DROP TRIGGER IF EXISTS trg_audit_funding ON funding;
CREATE TRIGGER trg_audit_funding AFTER INSERT OR UPDATE OR DELETE ON funding
  FOR EACH ROW EXECUTE FUNCTION fn_audit_log();

DROP TRIGGER IF EXISTS trg_audit_categories ON categories;
CREATE TRIGGER trg_audit_categories AFTER INSERT OR UPDATE OR DELETE ON categories
  FOR EACH ROW EXECUTE FUNCTION fn_audit_log();

DROP TRIGGER IF EXISTS trg_audit_budget_lines ON budget_lines;
CREATE TRIGGER trg_audit_budget_lines AFTER INSERT OR UPDATE OR DELETE ON budget_lines
  FOR EACH ROW EXECUTE FUNCTION fn_audit_log();

DROP TRIGGER IF EXISTS trg_audit_expenses ON expenses;
CREATE TRIGGER trg_audit_expenses AFTER INSERT OR UPDATE OR DELETE ON expenses
  FOR EACH ROW EXECUTE FUNCTION fn_audit_log();

DROP TRIGGER IF EXISTS trg_audit_decisions ON decisions;
CREATE TRIGGER trg_audit_decisions AFTER INSERT OR UPDATE OR DELETE ON decisions
  FOR EACH ROW EXECUTE FUNCTION fn_audit_log();

DROP TRIGGER IF EXISTS trg_audit_evidence ON evidence;
CREATE TRIGGER trg_audit_evidence AFTER INSERT OR UPDATE OR DELETE ON evidence
  FOR EACH ROW EXECUTE FUNCTION fn_audit_log();

-- ============================================================
-- View: budget_summary
-- Per budget line: allocated, total submitted, total approved, remaining
-- ============================================================
CREATE OR REPLACE VIEW budget_summary AS
SELECT
  bl.id AS budget_line_id,
  bl.project_id,
  bl.category_id,
  bl.allocated_amount,
  COALESCE(sub.submitted_total, 0) AS submitted_total,
  COALESCE(approved.approved_total, 0) AS approved_total,
  bl.allocated_amount - COALESCE(approved.approved_total, 0) AS remaining,
  COALESCE(approved.approved_total, 0) - bl.allocated_amount AS overspend,
  CASE WHEN COALESCE(approved.approved_total, 0) > bl.allocated_amount THEN true ELSE false END AS is_overspent
FROM budget_lines bl
LEFT JOIN (
  SELECT budget_line_id, SUM(amount) AS submitted_total
  FROM expenses
  WHERE is_deleted = false
  GROUP BY budget_line_id
) sub ON sub.budget_line_id = bl.id
LEFT JOIN (
  SELECT budget_line_id, SUM(amount) AS approved_total
  FROM expenses
  WHERE is_deleted = false AND status = 'approved'
  GROUP BY budget_line_id
) approved ON approved.budget_line_id = bl.id
WHERE bl.is_deleted = false;

-- ============================================================
-- View: overspent_lines
-- Budget lines where approved spend exceeds allocation
-- ============================================================
CREATE OR REPLACE VIEW overspent_lines AS
SELECT * FROM budget_summary WHERE is_overspent = true;
