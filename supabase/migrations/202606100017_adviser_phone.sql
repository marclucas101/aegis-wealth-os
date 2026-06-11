-- Adviser contact phone on public.users (advisers are users with role advisor/admin)
-- Clients reach advisers via clients.advisor_user_id -> users.id

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS phone TEXT;

COMMENT ON COLUMN users.phone IS
  'Contact phone for adviser/admin users; used by Call My Adviser for assigned clients.';

-- Allow advisers to maintain their own contact number (safe profile field)
GRANT UPDATE (full_name, avatar_url, organisation, phone) ON TABLE users TO authenticated;
