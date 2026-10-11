ALTER TABLE expenses ADD COLUMN IF NOT EXISTS resubmission_of uuid REFERENCES expenses(id) ON DELETE SET NULL;
