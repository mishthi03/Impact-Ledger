/*
# Impact Ledger — Seed Reference Data

## Purpose
Populate the database with realistic demo data for Asha Community Trust:
- 4 profiles (one per role, linked to auth.users created in auth schema)
- 3 funders
- 4 projects
- 5 categories
- Funding entries linking funders to projects
- Budget lines per project + category (one deliberately underfunded for overspend)
- ~20 expenses with a mix of submitted/approved/rejected, including one overspent line
- Decisions for approved/rejected expenses
- Evidence entries for some expenses

## Important
Uses hardcoded user IDs from the auth.users inserted in the previous step.
Admin:    347b579e-c90e-465f-87c2-47f7559b1a7c
Manager:  6dc57bcf-bd24-4974-8571-5c23ade71df8
Finance:  a0209f52-fc2b-4eeb-8684-05aa95cb195c
Reviewer: 827849b9-63c1-4ff5-86f3-6f767001184d

## Security
No RLS changes. Data inserted with service role (bypasses RLS).
*/

-- ============================================================
-- Profiles (linked to auth.users)
-- ============================================================
INSERT INTO profiles (id, email, full_name, role) VALUES
('347b579e-c90e-465f-87c2-47f7559b1a7c', 'admin@asha.org', 'Priya Sharma', 'admin'),
('6dc57bcf-bd24-4974-8571-5c23ade71df8', 'manager@asha.org', 'Rajesh Kumar', 'project_manager'),
('a0209f52-fc2b-4eeb-8684-05aa95cb195c', 'finance@asha.org', 'Anita Desai', 'finance_officer'),
('827849b9-63c1-4ff5-86f3-6f767001184d', 'reviewer@asha.org', 'Vikram Patel', 'reviewer')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- Funders (3)
-- ============================================================
INSERT INTO funders (name, funder_type, contact_person, contact_email, contact_phone, notes, created_by) VALUES
('USAID India', 'government', 'Sarah Mitchell', 's.mitchell@usaid.gov', '+91-98100-11111', 'Multi-year framework agreement for education programs', '6dc57bcf-bd24-4974-8571-5c23ade71df8'),
('Ford Foundation', 'foundation', 'James OConnor', 'j.oconnor@fordfoundation.org', '+91-98100-22222', 'Focus on women empowerment and livelihoods', '6dc57bcf-bd24-4974-8571-5c23ade71df8'),
('Tata Trusts', 'corporate', 'Meera Iyer', 'meera.iyer@tatatrusts.org', '+91-98100-33333', 'Community health and sanitation programs', '6dc57bcf-bd24-4974-8571-5c23ade71df8');

-- ============================================================
-- Categories (5)
-- ============================================================
INSERT INTO categories (name, description) VALUES
('Personnel', 'Staff salaries and consultant fees'),
('Travel', 'Field travel, conveyance, and per diem'),
('Supplies', 'Office supplies, equipment, and materials'),
('Training', 'Workshops, capacity building, and community events'),
('Administration', 'Overhead, rent, utilities, and admin costs');

-- ============================================================
-- Projects (4)
-- ============================================================
INSERT INTO projects (name, code, description, status, start_date, end_date, manager_id, location, created_by) VALUES
('Rural Education Initiative', 'EDU-2024-01', 'Improving access to quality education in 20 villages across Rajasthan', 'active', '2024-01-15', '2025-12-31', '6dc57bcf-bd24-4974-8571-5c23ade71df8', 'Rajasthan', '6dc57bcf-bd24-4974-8571-5c23ade71df8'),
('Women Livelihood Program', 'LIV-2024-02', 'Economic empowerment of 500 women through micro-enterprise training', 'active', '2024-03-01', '2025-09-30', '6dc57bcf-bd24-4974-8571-5c23ade71df8', 'Madhya Pradesh', '6dc57bcf-bd24-4974-8571-5c23ade71df8'),
('Community Health Drive', 'HLT-2024-03', 'Mobile health camps and sanitation awareness in 15 districts', 'active', '2024-04-01', '2025-06-30', '6dc57bcf-bd24-4974-8571-5c23ade71df8', 'Uttar Pradesh', '6dc57bcf-bd24-4974-8571-5c23ade71df8'),
('Digital Literacy Pilot', 'DIG-2024-04', 'Pilot program introducing digital skills in 5 urban slum communities', 'planning', '2024-10-01', '2025-03-31', '6dc57bcf-bd24-4974-8571-5c23ade71df8', 'Delhi NCR', '6dc57bcf-bd24-4974-8571-5c23ade71df8');

-- ============================================================
-- Funding entries
-- ============================================================
INSERT INTO funding (project_id, funder_id, amount, funding_date, reference_number, notes, created_by) VALUES
-- EDU-2024-01 funded by USAID
((SELECT id FROM projects WHERE code = 'EDU-2024-01'), (SELECT id FROM funders WHERE name = 'USAID India'), 2500000.00, '2024-01-20', 'USAID-EDU-2024-001', 'Q1-Q4 tranche', '6dc57bcf-bd24-4974-8571-5c23ade71df8'),
-- LIV-2024-02 funded by Ford Foundation
((SELECT id FROM projects WHERE code = 'LIV-2024-02'), (SELECT id FROM funders WHERE name = 'Ford Foundation'), 1800000.00, '2024-03-10', 'FF-LIV-2024-001', 'Annual grant', '6dc57bcf-bd24-4974-8571-5c23ade71df8'),
-- HLT-2024-03 funded by Tata Trusts
((SELECT id FROM projects WHERE code = 'HLT-2024-03'), (SELECT id FROM funders WHERE name = 'Tata Trusts'), 1200000.00, '2024-04-05', 'TT-HLT-2024-001', 'Half-yearly disbursement', '6dc57bcf-bd24-4974-8571-5c23ade71df8'),
-- HLT-2024-03 second tranche from Tata Trusts
((SELECT id FROM projects WHERE code = 'HLT-2024-03'), (SELECT id FROM funders WHERE name = 'Tata Trusts'), 800000.00, '2024-08-15', 'TT-HLT-2024-002', 'Second tranche for health camps', '6dc57bcf-bd24-4974-8571-5c23ade71df8'),
-- DIG-2024-04 funded by Ford Foundation
((SELECT id FROM projects WHERE code = 'DIG-2024-04'), (SELECT id FROM funders WHERE name = 'Ford Foundation'), 500000.00, '2024-09-20', 'FF-DIG-2024-001', 'Seed funding for pilot', '6dc57bcf-bd24-4974-8571-5c23ade71df8');

-- ============================================================
-- Budget Lines
-- ============================================================
INSERT INTO budget_lines (project_id, category_id, funding_id, allocated_amount, period_start, period_end, notes, created_by) VALUES
-- EDU-2024-01 budgets
((SELECT id FROM projects WHERE code = 'EDU-2024-01'), (SELECT id FROM categories WHERE name = 'Personnel'),
 (SELECT id FROM funding WHERE reference_number = 'USAID-EDU-2024-001'), 800000.00, '2024-01-15', '2025-12-31', 'Teaching staff and coordinators', '6dc57bcf-bd24-4974-8571-5c23ade71df8'),
((SELECT id FROM projects WHERE code = 'EDU-2024-01'), (SELECT id FROM categories WHERE name = 'Travel'),
 (SELECT id FROM funding WHERE reference_number = 'USAID-EDU-2024-001'), 300000.00, '2024-01-15', '2025-12-31', 'Field visits across 20 villages', '6dc57bcf-bd24-4974-8571-5c23ade71df8'),
((SELECT id FROM projects WHERE code = 'EDU-2024-01'), (SELECT id FROM categories WHERE name = 'Supplies'),
 (SELECT id FROM funding WHERE reference_number = 'USAID-EDU-2024-001'), 500000.00, '2024-01-15', '2025-12-31', 'Books, stationery, classroom materials', '6dc57bcf-bd24-4974-8571-5c23ade71df8'),
((SELECT id FROM projects WHERE code = 'EDU-2024-01'), (SELECT id FROM categories WHERE name = 'Training'),
 (SELECT id FROM funding WHERE reference_number = 'USAID-EDU-2024-001'), 400000.00, '2024-01-15', '2025-12-31', 'Teacher training workshops', '6dc57bcf-bd24-4974-8571-5c23ade71df8'),
-- LIV-2024-02 budgets
((SELECT id FROM projects WHERE code = 'LIV-2024-02'), (SELECT id FROM categories WHERE name = 'Personnel'),
 (SELECT id FROM funding WHERE reference_number = 'FF-LIV-2024-001'), 600000.00, '2024-03-01', '2025-09-30', 'Program staff', '6dc57bcf-bd24-4974-8571-5c23ade71df8'),
((SELECT id FROM projects WHERE code = 'LIV-2024-02'), (SELECT id FROM categories WHERE name = 'Training'),
 (SELECT id FROM funding WHERE reference_number = 'FF-LIV-2024-001'), 700000.00, '2024-03-01', '2025-09-30', 'Micro-enterprise training sessions', '6dc57bcf-bd24-4974-8571-5c23ade71df8'),
((SELECT id FROM projects WHERE code = 'LIV-2024-02'), (SELECT id FROM categories WHERE name = 'Travel'),
 (SELECT id FROM funding WHERE reference_number = 'FF-LIV-2024-001'), 200000.00, '2024-03-01', '2025-09-30', 'Travel to MP districts', '6dc57bcf-bd24-4974-8571-5c23ade71df8'),
-- HLT-2024-03 budgets
((SELECT id FROM projects WHERE code = 'HLT-2024-03'), (SELECT id FROM categories WHERE name = 'Supplies'),
 (SELECT id FROM funding WHERE reference_number = 'TT-HLT-2024-001'), 600000.00, '2024-04-01', '2025-06-30', 'Medical supplies and equipment', '6dc57bcf-bd24-4974-8571-5c23ade71df8'),
((SELECT id FROM projects WHERE code = 'HLT-2024-03'), (SELECT id FROM categories WHERE name = 'Personnel'),
 (SELECT id FROM funding WHERE reference_number = 'TT-HLT-2024-001'), 500000.00, '2024-04-01', '2025-06-30', 'Medical staff and coordinators', '6dc57bcf-bd24-4974-8571-5c23ade71df8'),
((SELECT id FROM projects WHERE code = 'HLT-2024-03'), (SELECT id FROM categories WHERE name = 'Administration'),
 (SELECT id FROM funding WHERE reference_number = 'TT-HLT-2024-002'), 400000.00, '2024-04-01', '2025-06-30', 'Admin overhead', '6dc57bcf-bd24-4974-8571-5c23ade71df8'),
-- DIG-2024-04 budgets
((SELECT id FROM projects WHERE code = 'DIG-2024-04'), (SELECT id FROM categories WHERE name = 'Supplies'),
 (SELECT id FROM funding WHERE reference_number = 'FF-DIG-2024-001'), 200000.00, '2024-10-01', '2025-03-31', 'Tablets and accessories', '6dc57bcf-bd24-4974-8571-5c23ade71df8'),
((SELECT id FROM projects WHERE code = 'DIG-2024-04'), (SELECT id FROM categories WHERE name = 'Training'),
 (SELECT id FROM funding WHERE reference_number = 'FF-DIG-2024-001'), 150000.00, '2024-10-01', '2025-03-31', 'Digital literacy curriculum delivery', '6dc57bcf-bd24-4974-8571-5c23ade71df8');

-- ============================================================
-- Expenses (~20)
-- Mix: approved, rejected, submitted (pending)
-- One budget line deliberately overspent: HLT-2024-03 Supplies (allocated 600000, approved total > 600000)
-- ============================================================

-- EDU-2024-01 Personnel (approved: 120000)
INSERT INTO expenses (budget_line_id, project_id, submitted_by, amount, expense_date, vendor, description, status) VALUES
((SELECT bl.id FROM budget_lines bl
  JOIN projects p ON p.id = bl.project_id
  JOIN categories c ON c.id = bl.category_id
  WHERE p.code = 'EDU-2024-01' AND c.name = 'Personnel'),
 (SELECT id FROM projects WHERE code = 'EDU-2024-01'),
 'a0209f52-fc2b-4eeb-8684-05aa95cb195c', 120000.00, '2024-02-28', 'Asha Trust Staff',
 'Salaries for 3 teaching coordinators - Feb 2024', 'approved');

-- EDU-2024-01 Travel (approved: 45000)
INSERT INTO expenses (budget_line_id, project_id, submitted_by, amount, expense_date, vendor, description, status) VALUES
((SELECT bl.id FROM budget_lines bl
  JOIN projects p ON p.id = bl.project_id
  JOIN categories c ON c.id = bl.category_id
  WHERE p.code = 'EDU-2024-01' AND c.name = 'Travel'),
 (SELECT id FROM projects WHERE code = 'EDU-2024-01'),
 'a0209f52-fc2b-4eeb-8684-05aa95cb195c', 45000.00, '2024-03-15', 'Rajasthan Travels',
 'Field visit to 8 villages in Jaipur district', 'approved');

-- EDU-2024-01 Travel (submitted: 38000)
INSERT INTO expenses (budget_line_id, project_id, submitted_by, amount, expense_date, vendor, description, status) VALUES
((SELECT bl.id FROM budget_lines bl
  JOIN projects p ON p.id = bl.project_id
  JOIN categories c ON c.id = bl.category_id
  WHERE p.code = 'EDU-2024-01' AND c.name = 'Travel'),
 (SELECT id FROM projects WHERE code = 'EDU-2024-01'),
 'a0209f52-fc2b-4eeb-8684-05aa95cb195c', 38000.00, '2024-09-10', 'Ajmer Taxi Services',
 'Field visit to 5 villages in Ajmer district', 'submitted');

-- EDU-2024-01 Supplies (approved: 85000)
INSERT INTO expenses (budget_line_id, project_id, submitted_by, amount, expense_date, vendor, description, status) VALUES
((SELECT bl.id FROM budget_lines bl
  JOIN projects p ON p.id = bl.project_id
  JOIN categories c ON c.id = bl.category_id
  WHERE p.code = 'EDU-2024-01' AND c.name = 'Supplies'),
 (SELECT id FROM projects WHERE code = 'EDU-2024-01'),
 'a0209f52-fc2b-4eeb-8684-05aa95cb195c', 85000.00, '2024-04-20', 'Navneet Publications',
 'Textbooks and workbooks for 400 students', 'approved');

-- EDU-2024-01 Supplies (rejected: 65000)
INSERT INTO expenses (budget_line_id, project_id, submitted_by, amount, expense_date, vendor, description, status) VALUES
((SELECT bl.id FROM budget_lines bl
  JOIN projects p ON p.id = bl.project_id
  JOIN categories c ON c.id = bl.category_id
  WHERE p.code = 'EDU-2024-01' AND c.name = 'Supplies'),
 (SELECT id FROM projects WHERE code = 'EDU-2024-01'),
 'a0209f52-fc2b-4eeb-8684-05aa95cb195c', 65000.00, '2024-05-12', 'TechMart India',
 '5 laptops for digital learning lab', 'rejected');

-- EDU-2024-01 Training (approved: 95000)
INSERT INTO expenses (budget_line_id, project_id, submitted_by, amount, expense_date, vendor, description, status) VALUES
((SELECT bl.id FROM budget_lines bl
  JOIN projects p ON p.id = bl.project_id
  JOIN categories c ON c.id = bl.category_id
  WHERE p.code = 'EDU-2024-01' AND c.name = 'Training'),
 (SELECT id FROM projects WHERE code = 'EDU-2024-01'),
 'a0209f52-fc2b-4eeb-8684-05aa95cb195c', 95000.00, '2024-06-18', 'LearnWell Training Pvt Ltd',
 '3-day teacher capacity building workshop', 'approved');

-- EDU-2024-01 Training (submitted: 55000)
INSERT INTO expenses (budget_line_id, project_id, submitted_by, amount, expense_date, vendor, description, status) VALUES
((SELECT bl.id FROM budget_lines bl
  JOIN projects p ON p.id = bl.project_id
  JOIN categories c ON c.id = bl.category_id
  WHERE p.code = 'EDU-2024-01' AND c.name = 'Training'),
 (SELECT id FROM projects WHERE code = 'EDU-2024-01'),
 'a0209f52-fc2b-4eeb-8684-05aa95cb195c', 55000.00, '2024-09-25', 'EduResource India',
 'Quarterly refresher training for 20 teachers', 'submitted');

-- LIV-2024-02 Personnel (approved: 100000)
INSERT INTO expenses (budget_line_id, project_id, submitted_by, amount, expense_date, vendor, description, status) VALUES
((SELECT bl.id FROM budget_lines bl
  JOIN projects p ON p.id = bl.project_id
  JOIN categories c ON c.id = bl.category_id
  WHERE p.code = 'LIV-2024-02' AND c.name = 'Personnel'),
 (SELECT id FROM projects WHERE code = 'LIV-2024-02'),
 'a0209f52-fc2b-4eeb-8684-05aa95cb195c', 100000.00, '2024-04-30', 'Asha Trust Staff',
 'Program coordinator salaries - April 2024', 'approved');

-- LIV-2024-02 Training (approved: 150000)
INSERT INTO expenses (budget_line_id, project_id, submitted_by, amount, expense_date, vendor, description, status) VALUES
((SELECT bl.id FROM budget_lines bl
  JOIN projects p ON p.id = bl.project_id
  JOIN categories c ON c.id = bl.category_id
  WHERE p.code = 'LIV-2024-02' AND c.name = 'Training'),
 (SELECT id FROM projects WHERE code = 'LIV-2024-02'),
 'a0209f52-fc2b-4eeb-8684-05aa95cb195c', 150000.00, '2024-05-20', 'SkillBridge Academy',
 'Micro-enterprise training - Batch 1 (100 women)', 'approved');

-- LIV-2024-02 Training (submitted: 120000)
INSERT INTO expenses (budget_line_id, project_id, submitted_by, amount, expense_date, vendor, description, status) VALUES
((SELECT bl.id FROM budget_lines bl
  JOIN projects p ON p.id = bl.project_id
  JOIN categories c ON c.id = bl.category_id
  WHERE p.code = 'LIV-2024-02' AND c.name = 'Training'),
 (SELECT id FROM projects WHERE code = 'LIV-2024-02'),
 'a0209f52-fc2b-4eeb-8684-05aa95cb195c', 120000.00, '2024-08-15', 'SkillBridge Academy',
 'Micro-enterprise training - Batch 2 (80 women)', 'submitted');

-- LIV-2024-02 Training (rejected: 250000)
INSERT INTO expenses (budget_line_id, project_id, submitted_by, amount, expense_date, vendor, description, status) VALUES
((SELECT bl.id FROM budget_lines bl
  JOIN projects p ON p.id = bl.project_id
  JOIN categories c ON c.id = bl.category_id
  WHERE p.code = 'LIV-2024-02' AND c.name = 'Training'),
 (SELECT id FROM projects WHERE code = 'LIV-2024-02'),
 'a0209f52-fc2b-4eeb-8684-05aa95cb195c', 250000.00, '2024-07-01', 'Premier Events Ltd',
 'Annual livelihood conference - venue and catering', 'rejected');

-- LIV-2024-02 Travel (approved: 35000)
INSERT INTO expenses (budget_line_id, project_id, submitted_by, amount, expense_date, vendor, description, status) VALUES
((SELECT bl.id FROM budget_lines bl
  JOIN projects p ON p.id = bl.project_id
  JOIN categories c ON c.id = bl.category_id
  WHERE p.code = 'LIV-2024-02' AND c.name = 'Travel'),
 (SELECT id FROM projects WHERE code = 'LIV-2024-02'),
 'a0209f52-fc2b-4eeb-8684-05aa95cb195c', 35000.00, '2024-06-10', 'MP Transport Co',
 'Travel to 6 MP districts for baseline survey', 'approved');

-- HLT-2024-03 Supplies (approved: 320000) -- will contribute to overspend
INSERT INTO expenses (budget_line_id, project_id, submitted_by, amount, expense_date, vendor, description, status) VALUES
((SELECT bl.id FROM budget_lines bl
  JOIN projects p ON p.id = bl.project_id
  JOIN categories c ON c.id = bl.category_id
  WHERE p.code = 'HLT-2024-03' AND c.name = 'Supplies'),
 (SELECT id FROM projects WHERE code = 'HLT-2024-03'),
 'a0209f52-fc2b-4eeb-8684-05aa95cb195c', 320000.00, '2024-05-08', 'MedSupply India',
 'Medical supplies for 10 health camps - Batch 1', 'approved');

-- HLT-2024-03 Supplies (approved: 350000) -- pushes total to 670000 > 600000 allocation = OVERSPENT
INSERT INTO expenses (budget_line_id, project_id, submitted_by, amount, expense_date, vendor, description, status) VALUES
((SELECT bl.id FROM budget_lines bl
  JOIN projects p ON p.id = bl.project_id
  JOIN categories c ON c.id = bl.category_id
  WHERE p.code = 'HLT-2024-03' AND c.name = 'Supplies'),
 (SELECT id FROM projects WHERE code = 'HLT-2024-03'),
 'a0209f52-fc2b-4eeb-8684-05aa95cb195c', 350000.00, '2024-08-20', 'MedSupply India',
 'Medical supplies for 10 health camps - Batch 2', 'approved');

-- HLT-2024-03 Personnel (approved: 80000)
INSERT INTO expenses (budget_line_id, project_id, submitted_by, amount, expense_date, vendor, description, status) VALUES
((SELECT bl.id FROM budget_lines bl
  JOIN projects p ON p.id = bl.project_id
  JOIN categories c ON c.id = bl.category_id
  WHERE p.code = 'HLT-2024-03' AND c.name = 'Personnel'),
 (SELECT id FROM projects WHERE code = 'HLT-2024-03'),
 'a0209f52-fc2b-4eeb-8684-05aa95cb195c', 80000.00, '2024-05-30', 'Asha Trust Staff',
 'Medical coordinator salaries - May 2024', 'approved');

-- HLT-2024-03 Personnel (submitted: 75000)
INSERT INTO expenses (budget_line_id, project_id, submitted_by, amount, expense_date, vendor, description, status) VALUES
((SELECT bl.id FROM budget_lines bl
  JOIN projects p ON p.id = bl.project_id
  JOIN categories c ON c.id = bl.category_id
  WHERE p.code = 'HLT-2024-03' AND c.name = 'Personnel'),
 (SELECT id FROM projects WHERE code = 'HLT-2024-03'),
 'a0209f52-fc2b-4eeb-8684-05aa95cb195c', 75000.00, '2024-09-15', 'Asha Trust Staff',
 'Medical coordinator salaries - September 2024', 'submitted');

-- HLT-2024-03 Administration (approved: 60000)
INSERT INTO expenses (budget_line_id, project_id, submitted_by, amount, expense_date, vendor, description, status) VALUES
((SELECT bl.id FROM budget_lines bl
  JOIN projects p ON p.id = bl.project_id
  JOIN categories c ON c.id = bl.category_id
  WHERE p.code = 'HLT-2024-03' AND c.name = 'Administration'),
 (SELECT id FROM projects WHERE code = 'HLT-2024-03'),
 'a0209f52-fc2b-4eeb-8684-05aa95cb195c', 60000.00, '2024-07-10', 'Asha Trust Office',
 'Office rent and utilities - Q2 2024', 'approved');

-- HLT-2024-03 Administration (rejected: 45000)
INSERT INTO expenses (budget_line_id, project_id, submitted_by, amount, expense_date, vendor, description, status) VALUES
((SELECT bl.id FROM budget_lines bl
  JOIN projects p ON p.id = bl.project_id
  JOIN categories c ON c.id = bl.category_id
  WHERE p.code = 'HLT-2024-03' AND c.name = 'Administration'),
 (SELECT id FROM projects WHERE code = 'HLT-2024-03'),
 'a0209f52-fc2b-4eeb-8684-05aa95cb195c', 45000.00, '2024-08-05', 'Tech Solutions Pvt Ltd',
 'New accounting software license', 'rejected');

-- DIG-2024-04 Supplies (submitted: 90000)
INSERT INTO expenses (budget_line_id, project_id, submitted_by, amount, expense_date, vendor, description, status) VALUES
((SELECT bl.id FROM budget_lines bl
  JOIN projects p ON p.id = bl.project_id
  JOIN categories c ON c.id = bl.category_id
  WHERE p.code = 'DIG-2024-04' AND c.name = 'Supplies'),
 (SELECT id FROM projects WHERE code = 'DIG-2024-04'),
 'a0209f52-fc2b-4eeb-8684-05aa95cb195c', 90000.00, '2024-10-10', 'Digital Devices India',
 '20 tablets with protective cases for pilot', 'submitted');

-- DIG-2024-04 Training (submitted: 50000)
INSERT INTO expenses (budget_line_id, project_id, submitted_by, amount, expense_date, vendor, description, status) VALUES
((SELECT bl.id FROM budget_lines bl
  JOIN projects p ON p.id = bl.project_id
  JOIN categories c ON c.id = bl.category_id
  WHERE p.code = 'DIG-2024-04' AND c.name = 'Training'),
 (SELECT id FROM projects WHERE code = 'DIG-2024-04'),
 'a0209f52-fc2b-4eeb-8684-05aa95cb195c', 50000.00, '2024-10-15', 'CodeLearn Academy',
 'Digital literacy curriculum - first 3 sessions', 'submitted');

-- ============================================================
-- Decisions (for approved and rejected expenses)
-- ============================================================
INSERT INTO decisions (expense_id, reviewer_id, action, reason, decided_at) VALUES
-- EDU Personnel approved
((SELECT id FROM expenses WHERE description = 'Salaries for 3 teaching coordinators - Feb 2024'),
 '827849b9-63c1-4ff5-86f3-6f767001184d', 'approve', 'Salaries verified against attendance records. Within budget.', '2024-03-05 10:00:00'),
-- EDU Travel approved
((SELECT id FROM expenses WHERE description = 'Field visit to 8 villages in Jaipur district'),
 '827849b9-63c1-4ff5-86f3-6f767001184d', 'approve', 'Travel logs and fuel receipts verified. Approved.', '2024-03-20 14:30:00'),
-- EDU Supplies approved
((SELECT id FROM expenses WHERE description = 'Textbooks and workbooks for 400 students'),
 '827849b9-63c1-4ff5-86f3-6f767001184d', 'approve', 'Delivery receipt and distribution list confirmed.', '2024-04-25 09:15:00'),
-- EDU Supplies rejected (laptops)
((SELECT id FROM expenses WHERE description = '5 laptops for digital learning lab'),
 '827849b9-63c1-4ff5-86f3-6f767001184d', 'reject', 'Laptops fall under equipment category, not supplies. Rebudget under separate line or defer to next fiscal year.', '2024-05-18 11:00:00'),
-- EDU Training approved
((SELECT id FROM expenses WHERE description = '3-day teacher capacity building workshop'),
 '827849b9-63c1-4ff5-86f3-6f767001184d', 'approve', 'Workshop conducted with 25 teachers. Attendance sheets and feedback forms attached.', '2024-06-22 16:00:00'),
-- LIV Personnel approved
((SELECT id FROM expenses WHERE description = 'Program coordinator salaries - April 2024'),
 '827849b9-63c1-4ff5-86f3-6f767001184d', 'approve', 'Salary breakdown verified. Within personnel budget.', '2024-05-05 10:00:00'),
-- LIV Training approved (batch 1)
((SELECT id FROM expenses WHERE description = 'Micro-enterprise training - Batch 1 (100 women)'),
 '827849b9-63c1-4ff5-86f3-6f767001184d', 'approve', 'Training completed with 100 participants. Post-training assessment results attached.', '2024-05-25 15:00:00'),
-- LIV Training rejected (conference)
((SELECT id FROM expenses WHERE description = 'Annual livelihood conference - venue and catering'),
 '827849b9-63c1-4ff5-86f3-6f767001184d', 'reject', 'Conference not part of approved annual plan. Exceeds training budget rationale. Resubmit with revised scope or seek additional approval.', '2024-07-05 12:00:00'),
-- LIV Travel approved
((SELECT id FROM expenses WHERE description = 'Travel to 6 MP districts for baseline survey'),
 '827849b9-63c1-4ff5-86f3-6f767001184d', 'approve', 'Travel itinerary and per diem calculations verified.', '2024-06-15 10:30:00'),
-- HLT Supplies approved (batch 1)
((SELECT id FROM expenses WHERE description = 'Medical supplies for 10 health camps - Batch 1'),
 '827849b9-63c1-4ff5-86f3-6f767001184d', 'approve', 'Supply inventory and camp distribution logs verified.', '2024-05-12 11:00:00'),
-- HLT Supplies approved (batch 2 - causes overspend)
((SELECT id FROM expenses WHERE description = 'Medical supplies for 10 health camps - Batch 2'),
 '827849b9-63c1-4ff5-86f3-6f767001184d', 'approve', 'Second batch required due to increased camp turnout. Supplies verified but note: this exceeds the allocated budget for this line.', '2024-08-25 14:00:00'),
-- HLT Personnel approved
((SELECT id FROM expenses WHERE description = 'Medical coordinator salaries - May 2024'),
 '827849b9-63c1-4ff5-86f3-6f767001184d', 'approve', 'Salary records verified. Within budget.', '2024-06-05 10:00:00'),
-- HLT Administration approved
((SELECT id FROM expenses WHERE description = 'Office rent and utilities - Q2 2024'),
 '827849b9-63c1-4ff5-86f3-6f767001184d', 'approve', 'Rent agreement and utility bills verified.', '2024-07-15 11:00:00'),
-- HLT Administration rejected (software)
((SELECT id FROM expenses WHERE description = 'New accounting software license'),
 '827849b9-63c1-4ff5-86f3-6f767001184d', 'reject', 'Software license not included in approved admin budget. Needs separate IT budget line and management approval.', '2024-08-08 13:00:00');

-- ============================================================
-- Evidence (for several approved expenses)
-- ============================================================
INSERT INTO evidence (expense_id, file_name, file_url, file_type, description, uploaded_by) VALUES
((SELECT id FROM expenses WHERE description = 'Salaries for 3 teaching coordinators - Feb 2024'),
 'salary_feb2024.pdf', '/evidence/edu/salary_feb2024.pdf', 'pdf',
 'Salary slips and bank transfer records', 'a0209f52-fc2b-4eeb-8684-05aa95cb195c'),
((SELECT id FROM expenses WHERE description = 'Field visit to 8 villages in Jaipur district'),
 'travel_log_jaipur.pdf', '/evidence/edu/travel_log_jaipur.pdf', 'pdf',
 'Travel log with dates, routes, and fuel receipts', 'a0209f52-fc2b-4eeb-8684-05aa95cb195c'),
((SELECT id FROM expenses WHERE description = 'Textbooks and workbooks for 400 students'),
 'delivery_receipt_books.pdf', '/evidence/edu/delivery_receipt_books.pdf', 'pdf',
 'Delivery challan and school-wise distribution list', 'a0209f52-fc2b-4eeb-8684-05aa95cb195c'),
((SELECT id FROM expenses WHERE description = '3-day teacher capacity building workshop'),
 'workshop_report.pdf', '/evidence/edu/workshop_report.pdf', 'pdf',
 'Workshop report with attendance sheets and photos', 'a0209f52-fc2b-4eeb-8684-05aa95cb195c'),
((SELECT id FROM expenses WHERE description = 'Micro-enterprise training - Batch 1 (100 women)'),
 'training_batch1_report.pdf', '/evidence/liv/training_batch1_report.pdf', 'pdf',
 'Training completion report with participant list and assessment results', 'a0209f52-fc2b-4eeb-8684-05aa95cb195c'),
((SELECT id FROM expenses WHERE description = 'Medical supplies for 10 health camps - Batch 1'),
 'medical_supplies_batch1.pdf', '/evidence/hlt/medical_supplies_batch1.pdf', 'pdf',
 'Supply invoice and camp-wise distribution log', 'a0209f52-fc2b-4eeb-8684-05aa95cb195c'),
((SELECT id FROM expenses WHERE description = 'Medical supplies for 10 health camps - Batch 2'),
 'medical_supplies_batch2.pdf', '/evidence/hlt/medical_supplies_batch2.pdf', 'pdf',
 'Supply invoice and camp-wise distribution log for batch 2', 'a0209f52-fc2b-4eeb-8684-05aa95cb195c');
