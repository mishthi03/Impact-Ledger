CREATE OR REPLACE FUNCTION decide_expense(
  p_expense_id uuid,
  p_outcome text,
  p_reason text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_role text;
  v_expense_status text;
BEGIN
  -- Validate outcome
  IF p_outcome NOT IN ('approve', 'reject') THEN
    RAISE EXCEPTION 'Invalid outcome: must be approve or reject';
  END IF;

  -- Check caller role
  SELECT current_user_role() INTO v_current_role;
  IF v_current_role NOT IN ('admin', 'reviewer') THEN
    RAISE EXCEPTION 'Only reviewers and admins can make decisions';
  END IF;

  -- Check expense exists and is submitted
  SELECT status INTO v_expense_status FROM expenses WHERE id = p_expense_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Expense not found';
  END IF;
  IF v_expense_status != 'submitted' THEN
    RAISE EXCEPTION 'Expense is not pending review (current status: %)', v_expense_status;
  END IF;

  -- Insert decision row
  INSERT INTO decisions (expense_id, reviewer_id, action, reason, decided_at)
  VALUES (p_expense_id, auth.uid(), p_outcome, p_reason, now());

  -- Update expense status
  UPDATE expenses
  SET status = CASE WHEN p_outcome = 'approve' THEN 'approved' ELSE 'rejected' END,
      updated_at = now()
  WHERE id = p_expense_id;
END;
$$;

GRANT EXECUTE ON FUNCTION decide_expense(uuid, text, text) TO authenticated;
