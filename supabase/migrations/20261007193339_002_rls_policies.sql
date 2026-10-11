/*
# Impact Ledger — Row Level Security Policies

## Purpose
Role-based access control for all tables. The app has a sign-in screen, so all
policies are scoped TO authenticated. Roles are stored in profiles.role.

## Roles
- **admin**: full CRUD on everything
- **project_manager**: CRUD on funders, projects, funding, categories, budget_lines; read on everything else
- **finance_officer**: read on most; insert/update on expenses + evidence (their own); read on decisions
- **reviewer**: read on most; insert on decisions; can update expense status via decisions

## Pattern
- SELECT: all authenticated users can read non-deleted rows from all business tables
- INSERT/UPDATE/DELETE: restricted by role via current_user_role()
- audit_log: SELECT admin only; writes handled by SECURITY DEFINER trigger
- profiles: users can read all profiles (needed for names); can update own only
*/

-- ============================================================
-- profiles: everyone can read (need names/roles), update own only
-- ============================================================
DROP POLICY IF EXISTS "profiles_select_all" ON profiles;
CREATE POLICY "profiles_select_all"
ON profiles FOR SELECT TO authenticated
USING (is_deleted = false);

DROP POLICY IF EXISTS "profiles_insert_admin" ON profiles;
CREATE POLICY "profiles_insert_admin"
ON profiles FOR INSERT TO authenticated
WITH CHECK (current_user_role() = 'admin');

DROP POLICY IF EXISTS "profiles_update_own_or_admin" ON profiles;
CREATE POLICY "profiles_update_own_or_admin"
ON profiles FOR UPDATE TO authenticated
USING (auth.uid() = id OR current_user_role() = 'admin')
WITH CHECK (auth.uid() = id OR current_user_role() = 'admin');

DROP POLICY IF EXISTS "profiles_delete_admin" ON profiles;
CREATE POLICY "profiles_delete_admin"
ON profiles FOR DELETE TO authenticated
USING (current_user_role() = 'admin');

-- ============================================================
-- funders: all read; admin + project_manager write
-- ============================================================
DROP POLICY IF EXISTS "funders_select_all" ON funders;
CREATE POLICY "funders_select_all"
ON funders FOR SELECT TO authenticated
USING (is_deleted = false);

DROP POLICY IF EXISTS "funders_insert_pm_admin" ON funders;
CREATE POLICY "funders_insert_pm_admin"
ON funders FOR INSERT TO authenticated
WITH CHECK (current_user_role() IN ('admin', 'project_manager'));

DROP POLICY IF EXISTS "funders_update_pm_admin" ON funders;
CREATE POLICY "funders_update_pm_admin"
ON funders FOR UPDATE TO authenticated
USING (current_user_role() IN ('admin', 'project_manager'))
WITH CHECK (current_user_role() IN ('admin', 'project_manager'));

DROP POLICY IF EXISTS "funders_delete_admin" ON funders;
CREATE POLICY "funders_delete_admin"
ON funders FOR DELETE TO authenticated
USING (current_user_role() = 'admin');

-- ============================================================
-- projects: all read; admin + project_manager write
-- ============================================================
DROP POLICY IF EXISTS "projects_select_all" ON projects;
CREATE POLICY "projects_select_all"
ON projects FOR SELECT TO authenticated
USING (is_deleted = false);

DROP POLICY IF EXISTS "projects_insert_pm_admin" ON projects;
CREATE POLICY "projects_insert_pm_admin"
ON projects FOR INSERT TO authenticated
WITH CHECK (current_user_role() IN ('admin', 'project_manager'));

DROP POLICY IF EXISTS "projects_update_pm_admin" ON projects;
CREATE POLICY "projects_update_pm_admin"
ON projects FOR UPDATE TO authenticated
USING (current_user_role() IN ('admin', 'project_manager'))
WITH CHECK (current_user_role() IN ('admin', 'project_manager'));

DROP POLICY IF EXISTS "projects_delete_admin" ON projects;
CREATE POLICY "projects_delete_admin"
ON projects FOR DELETE TO authenticated
USING (current_user_role() = 'admin');

-- ============================================================
-- funding: all read; admin + project_manager write
-- ============================================================
DROP POLICY IF EXISTS "funding_select_all" ON funding;
CREATE POLICY "funding_select_all"
ON funding FOR SELECT TO authenticated
USING (is_deleted = false);

DROP POLICY IF EXISTS "funding_insert_pm_admin" ON funding;
CREATE POLICY "funding_insert_pm_admin"
ON funding FOR INSERT TO authenticated
WITH CHECK (current_user_role() IN ('admin', 'project_manager'));

DROP POLICY IF EXISTS "funding_update_pm_admin" ON funding;
CREATE POLICY "funding_update_pm_admin"
ON funding FOR UPDATE TO authenticated
USING (current_user_role() IN ('admin', 'project_manager'))
WITH CHECK (current_user_role() IN ('admin', 'project_manager'));

DROP POLICY IF EXISTS "funding_delete_admin" ON funding;
CREATE POLICY "funding_delete_admin"
ON funding FOR DELETE TO authenticated
USING (current_user_role() = 'admin');

-- ============================================================
-- categories: all read; admin + project_manager write
-- ============================================================
DROP POLICY IF EXISTS "categories_select_all" ON categories;
CREATE POLICY "categories_select_all"
ON categories FOR SELECT TO authenticated
USING (is_deleted = false);

DROP POLICY IF EXISTS "categories_insert_pm_admin" ON categories;
CREATE POLICY "categories_insert_pm_admin"
ON categories FOR INSERT TO authenticated
WITH CHECK (current_user_role() IN ('admin', 'project_manager'));

DROP POLICY IF EXISTS "categories_update_pm_admin" ON categories;
CREATE POLICY "categories_update_pm_admin"
ON categories FOR UPDATE TO authenticated
USING (current_user_role() IN ('admin', 'project_manager'))
WITH CHECK (current_user_role() IN ('admin', 'project_manager'));

DROP POLICY IF EXISTS "categories_delete_admin" ON categories;
CREATE POLICY "categories_delete_admin"
ON categories FOR DELETE TO authenticated
USING (current_user_role() = 'admin');

-- ============================================================
-- budget_lines: all read; admin + project_manager write
-- ============================================================
DROP POLICY IF EXISTS "budget_lines_select_all" ON budget_lines;
CREATE POLICY "budget_lines_select_all"
ON budget_lines FOR SELECT TO authenticated
USING (is_deleted = false);

DROP POLICY IF EXISTS "budget_lines_insert_pm_admin" ON budget_lines;
CREATE POLICY "budget_lines_insert_pm_admin"
ON budget_lines FOR INSERT TO authenticated
WITH CHECK (current_user_role() IN ('admin', 'project_manager'));

DROP POLICY IF EXISTS "budget_lines_update_pm_admin" ON budget_lines;
CREATE POLICY "budget_lines_update_pm_admin"
ON budget_lines FOR UPDATE TO authenticated
USING (current_user_role() IN ('admin', 'project_manager'))
WITH CHECK (current_user_role() IN ('admin', 'project_manager'));

DROP POLICY IF EXISTS "budget_lines_delete_admin" ON budget_lines;
CREATE POLICY "budget_lines_delete_admin"
ON budget_lines FOR DELETE TO authenticated
USING (current_user_role() = 'admin');

-- ============================================================
-- expenses: all read; finance_officer + admin can insert/update own; admin can delete
-- ============================================================
DROP POLICY IF EXISTS "expenses_select_all" ON expenses;
CREATE POLICY "expenses_select_all"
ON expenses FOR SELECT TO authenticated
USING (is_deleted = false);

DROP POLICY IF EXISTS "expenses_insert_finance_admin" ON expenses;
CREATE POLICY "expenses_insert_finance_admin"
ON expenses FOR INSERT TO authenticated
WITH CHECK (current_user_role() IN ('admin', 'finance_officer') AND submitted_by = auth.uid());

DROP POLICY IF EXISTS "expenses_update_finance_admin" ON expenses;
CREATE POLICY "expenses_update_finance_admin"
ON expenses FOR UPDATE TO authenticated
USING (
  (current_user_role() = 'finance_officer' AND submitted_by = auth.uid() AND status = 'submitted')
  OR current_user_role() = 'admin'
)
WITH CHECK (
  (current_user_role() = 'finance_officer' AND submitted_by = auth.uid())
  OR current_user_role() = 'admin'
);

DROP POLICY IF EXISTS "expenses_delete_admin" ON expenses;
CREATE POLICY "expenses_delete_admin"
ON expenses FOR DELETE TO authenticated
USING (current_user_role() = 'admin');

-- ============================================================
-- decisions: all read; reviewer + admin can insert; admin can delete
-- ============================================================
DROP POLICY IF EXISTS "decisions_select_all" ON decisions;
CREATE POLICY "decisions_select_all"
ON decisions FOR SELECT TO authenticated
USING (true);

DROP POLICY IF EXISTS "decisions_insert_reviewer_admin" ON decisions;
CREATE POLICY "decisions_insert_reviewer_admin"
ON decisions FOR INSERT TO authenticated
WITH CHECK (current_user_role() IN ('admin', 'reviewer') AND reviewer_id = auth.uid());

DROP POLICY IF EXISTS "decisions_delete_admin" ON decisions;
CREATE POLICY "decisions_delete_admin"
ON decisions FOR DELETE TO authenticated
USING (current_user_role() = 'admin');

-- ============================================================
-- evidence: all read; finance_officer + admin can insert; uploader or admin can update; admin can delete
-- ============================================================
DROP POLICY IF EXISTS "evidence_select_all" ON evidence;
CREATE POLICY "evidence_select_all"
ON evidence FOR SELECT TO authenticated
USING (is_deleted = false);

DROP POLICY IF EXISTS "evidence_insert_finance_admin" ON evidence;
CREATE POLICY "evidence_insert_finance_admin"
ON evidence FOR INSERT TO authenticated
WITH CHECK (current_user_role() IN ('admin', 'finance_officer') AND uploaded_by = auth.uid());

DROP POLICY IF EXISTS "evidence_update_finance_admin" ON evidence;
CREATE POLICY "evidence_update_finance_admin"
ON evidence FOR UPDATE TO authenticated
USING (
  (current_user_role() = 'finance_officer' AND uploaded_by = auth.uid())
  OR current_user_role() = 'admin'
)
WITH CHECK (
  (current_user_role() = 'finance_officer' AND uploaded_by = auth.uid())
  OR current_user_role() = 'admin'
);

DROP POLICY IF EXISTS "evidence_delete_admin" ON evidence;
CREATE POLICY "evidence_delete_admin"
ON evidence FOR DELETE TO authenticated
USING (current_user_role() = 'admin');

-- ============================================================
-- audit_log: admin read only; trigger writes via SECURITY DEFINER
-- ============================================================
DROP POLICY IF EXISTS "audit_log_select_admin" ON audit_log;
CREATE POLICY "audit_log_select_admin"
ON audit_log FOR SELECT TO authenticated
USING (current_user_role() = 'admin');

-- ============================================================
-- updated_at auto-maintenance trigger
-- ============================================================
CREATE OR REPLACE FUNCTION fn_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_updated_at ON profiles;
CREATE TRIGGER trg_profiles_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

DROP TRIGGER IF EXISTS trg_funders_updated_at ON funders;
CREATE TRIGGER trg_funders_updated_at BEFORE UPDATE ON funders
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

DROP TRIGGER IF EXISTS trg_projects_updated_at ON projects;
CREATE TRIGGER trg_projects_updated_at BEFORE UPDATE ON projects
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

DROP TRIGGER IF EXISTS trg_funding_updated_at ON funding;
CREATE TRIGGER trg_funding_updated_at BEFORE UPDATE ON funding
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

DROP TRIGGER IF EXISTS trg_categories_updated_at ON categories;
CREATE TRIGGER trg_categories_updated_at BEFORE UPDATE ON categories
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

DROP TRIGGER IF EXISTS trg_budget_lines_updated_at ON budget_lines;
CREATE TRIGGER trg_budget_lines_updated_at BEFORE UPDATE ON budget_lines
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

DROP TRIGGER IF EXISTS trg_expenses_updated_at ON expenses;
CREATE TRIGGER trg_expenses_updated_at BEFORE UPDATE ON expenses
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
