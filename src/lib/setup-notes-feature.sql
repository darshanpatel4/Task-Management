-- This script sets up the entire sharable notes feature for production.
-- It includes table creation, column additions, and necessary functions.

-- Creates a function to check if a user is an admin based on their role in the profiles table.
-- This is a core utility function for RLS policies on other tables.
create or replace function public.is_admin(user_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists(
    select 1
    from public.profiles
    where
      id = user_id and
      role = 'Admin'
  );
$$;

-- Creates a helper function to get a specific claim from the JWT.
-- This is used by RLS policies to check user roles efficiently.
create or replace function public.get_my_claim(claim_name text)
returns jsonb
language sql
stable
as $$
  select coalesce(current_setting('request.jwt.claims', true)::jsonb ->> claim_name, null)::jsonb;
$$;


-- Add necessary columns to the existing 'notes' table if they don't already exist.
ALTER TABLE public.notes
  ADD COLUMN IF NOT EXISTS category TEXT,
  ADD COLUMN IF NOT EXISTS visibility TEXT DEFAULT 'private',
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

-- Create the table for managing note edit requests from public users.
CREATE TABLE IF NOT EXISTS public.note_edit_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  note_id UUID NOT NULL REFERENCES public.notes(id) ON DELETE CASCADE,
  requester_name TEXT NOT NULL,
  requester_email TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, approved, rejected
  edit_token UUID DEFAULT gen_random_uuid()
);

-- Create an index on the note_id and requester_email for faster lookups.
CREATE INDEX IF NOT EXISTS idx_note_edit_requests_note_id_email ON public.note_edit_requests(note_id, requester_email);

-- This function generates a unique token for approved edit requests.
CREATE OR REPLACE FUNCTION public.set_edit_token_on_approval()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'approved' AND OLD.status != 'approved' THEN
    NEW.edit_token := gen_random_uuid();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- This trigger calls the function whenever a request is updated.
CREATE TRIGGER trigger_set_edit_token
BEFORE UPDATE ON public.note_edit_requests
FOR EACH ROW
EXECUTE FUNCTION public.set_edit_token_on_approval();

-- Disable RLS on the 'notes' table to allow public read/write access as requested.
ALTER TABLE public.notes DISABLE ROW LEVEL SECURITY;

-- Disable RLS on the 'note_edit_requests' table to allow public access for making requests.
ALTER TABLE public.note_edit_requests DISABLE ROW LEVEL SECURITY;

-- Grant permissions for public users to interact with these tables.
-- The 'anon' role represents unauthenticated users, 'authenticated' represents any logged-in user.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notes TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.note_edit_requests TO anon, authenticated;
