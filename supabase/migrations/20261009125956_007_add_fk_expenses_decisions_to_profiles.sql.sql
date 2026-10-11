DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'expenses_submitted_by_fkey' AND table_name = 'expenses'
  ) THEN
    ALTER TABLE expenses
      ADD CONSTRAINT expenses_submitted_by_fkey
      FOREIGN KEY (submitted_by) REFERENCES profiles(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'decisions_reviewer_id_fkey' AND table_name = 'decisions'
  ) THEN
    ALTER TABLE decisions
      ADD CONSTRAINT decisions_reviewer_id_fkey
      FOREIGN KEY (reviewer_id) REFERENCES profiles(id) ON DELETE SET NULL;
  END IF;
END $$;
