/*
# Fix auth.identities for demo users

## Problem
The 4 demo users were inserted directly into auth.users without corresponding
auth.identities rows. Supabase Auth's signInWithPassword looks up identities
and fails with "Database error querying schema" when none exist.

## Fix
1. Set any remaining NULL token columns to '' on all 4 demo users
2. Insert matching auth.identities rows with provider 'email' for each user
   (email column is generated, so we omit it)
*/

-- Step 1: Fix NULL token columns
UPDATE auth.users
SET
  email_change_token_new = COALESCE(email_change_token_new, ''),
  confirmation_token = COALESCE(NULLIF(confirmation_token, NULL), ''),
  recovery_token = COALESCE(NULLIF(recovery_token, NULL), ''),
  email_change = COALESCE(NULLIF(email_change, NULL), ''),
  email_change_token_current = COALESCE(NULLIF(email_change_token_current, NULL), ''),
  reauthentication_token = COALESCE(NULLIF(reauthentication_token, NULL), ''),
  phone_change = COALESCE(NULLIF(phone_change, NULL), ''),
  phone_change_token = COALESCE(NULLIF(phone_change_token, NULL), '')
WHERE email IN ('admin@asha.org', 'manager@asha.org', 'finance@asha.org', 'reviewer@asha.org');

-- Step 2: Insert auth.identities rows (email is a generated column — must not insert into it)
INSERT INTO auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
SELECT
  u.id::text,
  u.id,
  jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
  'email',
  now(),
  now(),
  now()
FROM auth.users u
WHERE u.email IN ('admin@asha.org', 'manager@asha.org', 'finance@asha.org', 'reviewer@asha.org')
  AND NOT EXISTS (
    SELECT 1 FROM auth.identities i WHERE i.user_id = u.id AND i.provider = 'email'
  );

-- Verify
SELECT u.email, u.email_confirmed_at, i.provider
FROM auth.users u
LEFT JOIN auth.identities i ON i.user_id = u.id AND i.provider = 'email'
WHERE u.email IN ('admin@asha.org', 'manager@asha.org', 'finance@asha.org', 'reviewer@asha.org');
