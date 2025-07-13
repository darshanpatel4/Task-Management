-- setup-notes-feature.sql

-- This script sets up the necessary database schema and functions for the
-- public note sharing and edit request feature.

-- 1. Create the table for note edit requests
CREATE TABLE IF NOT EXISTS public.note_edit_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    note_id UUID NOT NULL REFERENCES public.notes(id) ON DELETE CASCADE,
    requester_name TEXT NOT NULL,
    requester_email TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
    edit_token UUID DEFAULT gen_random_uuid()
);

-- 2. Add new columns to the existing 'notes' table for visibility and categorization.
ALTER TABLE public.notes
ADD COLUMN IF NOT EXISTS visibility TEXT DEFAULT 'private',
ADD COLUMN IF NOT EXISTS category TEXT,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

-- 3. Create an index on the edit_token for faster lookups
CREATE INDEX IF NOT EXISTS idx_note_edit_requests_token ON public.note_edit_requests(edit_token);

-- 4. Disable Row Level Security (RLS) on both tables to allow public access.
-- This is necessary for the current implementation where edits are handled
-- by the public client after token verification.
ALTER TABLE public.notes DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.note_edit_requests DISABLE ROW LEVEL SECURITY;

-- 5. Add a comment to the table to explain its purpose
COMMENT ON TABLE public.note_edit_requests IS 'Stores user requests to edit public notes.';

-- End of script
