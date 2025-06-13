
-- ============================================================================
-- Script Start
-- ============================================================================
DO $$ BEGIN RAISE NOTICE 'Starting non-destructive schema setup/update script...'; END $$;

-- ============================================================================
-- ENUM Types
-- Create ENUMs if they don't exist, or add missing values.
-- ============================================================================

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
        CREATE TYPE public.user_role AS ENUM ('Admin', 'User');
        RAISE NOTICE 'Created ENUM type user_role.';
    ELSE
        RAISE NOTICE 'ENUM type user_role already exists.';
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'task_status') THEN
        CREATE TYPE public.task_status AS ENUM ('Pending', 'In Progress', 'Completed', 'Approved');
        RAISE NOTICE 'Created ENUM type task_status.';
    ELSE
        RAISE NOTICE 'ENUM type task_status already exists.';
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'task_priority') THEN
        CREATE TYPE public.task_priority AS ENUM ('Low', 'Medium', 'High');
        RAISE NOTICE 'Created ENUM type task_priority.';
    ELSE
        RAISE NOTICE 'ENUM type task_priority already exists.';
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'project_status') THEN
        CREATE TYPE public.project_status AS ENUM ('In Progress', 'Completed', 'On Hold', 'Cancelled');
        RAISE NOTICE 'Created ENUM type project_status.';
    ELSE
        RAISE NOTICE 'ENUM type project_status already exists.';
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'note_category') THEN
        CREATE TYPE public.note_category AS ENUM ('General', 'Important', 'Credentials', 'Improvement', 'Action Required');
        RAISE NOTICE 'Created ENUM type note_category.';
    ELSE
        RAISE NOTICE 'ENUM type note_category already exists.';
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'notification_type') THEN
        CREATE TYPE public.notification_type AS ENUM (
            'new_comment_on_task', 'new_log', 'task_assigned', 'task_approved',
            'task_completed_for_approval', 'task_rejected', 'new_note_received', 'generic',
            'task_due_soon', 'task_overdue'
        );
        RAISE NOTICE 'Created ENUM type notification_type with all values.';
    ELSE
        RAISE NOTICE 'ENUM type notification_type already exists. Checking/adding values:';
        ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'new_comment_on_task';
        ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'new_log';
        ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'task_assigned';
        ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'task_approved';
        ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'task_completed_for_approval';
        ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'task_rejected';
        ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'new_note_received';
        ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'generic';
        ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'task_due_soon';
        ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'task_overdue';
        RAISE NOTICE 'Finished checking/adding values for notification_type.';
    END IF;
END $$;

-- ============================================================================
-- Helper Functions
-- ============================================================================

CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.handle_updated_at() IS 'Automatically sets updated_at to current time on row update.';
DO $$ BEGIN RAISE NOTICE 'Ensured function public.handle_updated_at exists.'; END $$;

-- ============================================================================
-- Tables - Create if not exist, then add columns if they don't exist.
-- ============================================================================

-- Profiles Table
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY,
    updated_at TIMESTAMPTZ DEFAULT now()
);
DO $$ BEGIN RAISE NOTICE 'Ensured public.profiles table core exists.'; END $$;

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_id_fkey' AND conrelid = 'public.profiles'::regclass) THEN ALTER TABLE public.profiles ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE; RAISE NOTICE 'Added FK profiles_id_fkey.'; ELSE RAISE NOTICE 'FK profiles_id_fkey exists.'; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='full_name') THEN ALTER TABLE public.profiles ADD COLUMN full_name TEXT; RAISE NOTICE 'Added profiles.full_name.'; ELSE RAISE NOTICE 'profiles.full_name exists.'; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='avatar_url') THEN ALTER TABLE public.profiles ADD COLUMN avatar_url TEXT; RAISE NOTICE 'Added profiles.avatar_url.'; ELSE RAISE NOTICE 'profiles.avatar_url exists.'; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='role') THEN ALTER TABLE public.profiles ADD COLUMN role public.user_role DEFAULT 'User'::public.user_role; RAISE NOTICE 'Added profiles.role.'; ELSE RAISE NOTICE 'profiles.role exists.'; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='email') THEN ALTER TABLE public.profiles ADD COLUMN email TEXT; RAISE NOTICE 'Added profiles.email.'; ELSE RAISE NOTICE 'profiles.email exists.'; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_email_key' AND conrelid = 'public.profiles'::regclass) THEN ALTER TABLE public.profiles ADD CONSTRAINT profiles_email_key UNIQUE (email); RAISE NOTICE 'Added unique constraint profiles_email_key.'; ELSE RAISE NOTICE 'Unique constraint profiles_email_key exists.'; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='position') THEN ALTER TABLE public.profiles ADD COLUMN position TEXT; RAISE NOTICE 'Added profiles.position.'; ELSE RAISE NOTICE 'profiles.position exists.'; END IF; END $$;

DROP TRIGGER IF EXISTS on_profiles_updated ON public.profiles;
CREATE TRIGGER on_profiles_updated
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
COMMENT ON TABLE public.profiles IS 'User profile information, extending auth.users.';
DO $$ BEGIN RAISE NOTICE 'Ensured structure and trigger for public.profiles.'; END $$;

-- Projects Table
CREATE TABLE IF NOT EXISTS public.projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    name TEXT NOT NULL
);
DO $$ BEGIN RAISE NOTICE 'Ensured public.projects table core exists.'; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='projects' AND column_name='description') THEN ALTER TABLE public.projects ADD COLUMN description TEXT; RAISE NOTICE 'Added projects.description.'; ELSE RAISE NOTICE 'projects.description exists.'; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='projects' AND column_name='user_id') THEN ALTER TABLE public.projects ADD COLUMN user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL; RAISE NOTICE 'Added projects.user_id.'; ELSE RAISE NOTICE 'projects.user_id exists.'; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='projects' AND column_name='status') THEN ALTER TABLE public.projects ADD COLUMN status public.project_status DEFAULT 'In Progress'::public.project_status; RAISE NOTICE 'Added projects.status.'; ELSE RAISE NOTICE 'projects.status exists.'; END IF; END $$;

DROP TRIGGER IF EXISTS on_projects_updated ON public.projects;
CREATE TRIGGER on_projects_updated
    BEFORE UPDATE ON public.projects
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
COMMENT ON TABLE public.projects IS 'Stores project information.';
DO $$ BEGIN RAISE NOTICE 'Ensured structure and trigger for public.projects.'; END $$;

-- Tasks Table
CREATE TABLE IF NOT EXISTS public.tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    title TEXT NOT NULL
);
DO $$ BEGIN RAISE NOTICE 'Ensured public.tasks table core exists.'; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='tasks' AND column_name='description') THEN ALTER TABLE public.tasks ADD COLUMN description TEXT; RAISE NOTICE 'Added tasks.description.'; ELSE RAISE NOTICE 'tasks.description exists.'; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='tasks' AND column_name='status') THEN ALTER TABLE public.tasks ADD COLUMN status public.task_status DEFAULT 'Pending'::public.task_status; RAISE NOTICE 'Added tasks.status.'; ELSE RAISE NOTICE 'tasks.status exists.'; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='tasks' AND column_name='priority') THEN ALTER TABLE public.tasks ADD COLUMN priority public.task_priority DEFAULT 'Medium'::public.task_priority; RAISE NOTICE 'Added tasks.priority.'; ELSE RAISE NOTICE 'tasks.priority exists.'; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='tasks' AND column_name='due_date') THEN ALTER TABLE public.tasks ADD COLUMN due_date TIMESTAMPTZ; RAISE NOTICE 'Added tasks.due_date.'; ELSE RAISE NOTICE 'tasks.due_date exists.'; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='tasks' AND column_name='project_id') THEN ALTER TABLE public.tasks ADD COLUMN project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE; RAISE NOTICE 'Added tasks.project_id.'; ELSE RAISE NOTICE 'tasks.project_id exists.'; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='tasks' AND column_name='user_id') THEN ALTER TABLE public.tasks ADD COLUMN user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL; RAISE NOTICE 'Added tasks.user_id.'; ELSE RAISE NOTICE 'tasks.user_id exists.'; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='tasks' AND column_name='assignee_ids') THEN ALTER TABLE public.tasks ADD COLUMN assignee_ids UUID[]; RAISE NOTICE 'Added tasks.assignee_ids.'; ELSE RAISE NOTICE 'tasks.assignee_ids exists.'; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='tasks' AND column_name='comments') THEN ALTER TABLE public.tasks ADD COLUMN comments JSONB DEFAULT '[]'::jsonb; RAISE NOTICE 'Added tasks.comments.'; ELSE RAISE NOTICE 'tasks.comments exists.'; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='tasks' AND column_name='logs') THEN ALTER TABLE public.tasks ADD COLUMN logs JSONB DEFAULT '[]'::jsonb; RAISE NOTICE 'Added tasks.logs.'; ELSE RAISE NOTICE 'tasks.logs exists.'; END IF; END $$;

DROP TRIGGER IF EXISTS on_tasks_updated ON public.tasks;
CREATE TRIGGER on_tasks_updated
    BEFORE UPDATE ON public.tasks
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
COMMENT ON TABLE public.tasks IS 'Stores task details.';
DO $$ BEGIN RAISE NOTICE 'Ensured structure and trigger for public.tasks.'; END $$;

-- Notes Table
CREATE TABLE IF NOT EXISTS public.notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    admin_id UUID NOT NULL,
    recipient_user_ids UUID[] NOT NULL
);
DO $$ BEGIN RAISE NOTICE 'Ensured public.notes table core exists.'; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'notes_admin_id_fkey' AND conrelid = 'public.notes'::regclass) THEN ALTER TABLE public.notes ADD CONSTRAINT notes_admin_id_fkey FOREIGN KEY (admin_id) REFERENCES public.profiles(id) ON DELETE CASCADE; RAISE NOTICE 'Added FK notes_admin_id_fkey.'; ELSE RAISE NOTICE 'FK notes_admin_id_fkey exists.'; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='notes' AND column_name='category') THEN ALTER TABLE public.notes ADD COLUMN category public.note_category DEFAULT 'General'::public.note_category; RAISE NOTICE 'Added notes.category.'; ELSE RAISE NOTICE 'notes.category exists.'; END IF; END $$;

DROP TRIGGER IF EXISTS on_notes_updated ON public.notes;
CREATE TRIGGER on_notes_updated
    BEFORE UPDATE ON public.notes
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
COMMENT ON TABLE public.notes IS 'Admin-created notes for specific users.';
DO $$ BEGIN RAISE NOTICE 'Ensured structure and trigger for public.notes.'; END $$;

-- Notifications Table
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT now(),
    user_id UUID NOT NULL,
    message TEXT NOT NULL,
    type public.notification_type NOT NULL
);
DO $$ BEGIN RAISE NOTICE 'Ensured public.notifications table core exists.'; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'notifications_user_id_fkey' AND conrelid = 'public.notifications'::regclass) THEN ALTER TABLE public.notifications ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE; RAISE NOTICE 'Added FK notifications_user_id_fkey.'; ELSE RAISE NOTICE 'FK notifications_user_id_fkey exists.'; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='notifications' AND column_name='link') THEN ALTER TABLE public.notifications ADD COLUMN link TEXT; RAISE NOTICE 'Added notifications.link.'; ELSE RAISE NOTICE 'notifications.link exists.'; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='notifications' AND column_name='is_read') THEN ALTER TABLE public.notifications ADD COLUMN is_read BOOLEAN DEFAULT FALSE; RAISE NOTICE 'Added notifications.is_read.'; ELSE RAISE NOTICE 'notifications.is_read exists.'; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='notifications' AND column_name='triggered_by_user_id') THEN ALTER TABLE public.notifications ADD COLUMN triggered_by_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL; RAISE NOTICE 'Added notifications.triggered_by_user_id.'; ELSE RAISE NOTICE 'notifications.triggered_by_user_id exists.'; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='notifications' AND column_name='task_id') THEN ALTER TABLE public.notifications ADD COLUMN task_id UUID REFERENCES public.tasks(id) ON DELETE CASCADE; RAISE NOTICE 'Added notifications.task_id.'; ELSE RAISE NOTICE 'notifications.task_id exists.'; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='notifications' AND column_name='project_id') THEN ALTER TABLE public.notifications ADD COLUMN project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE; RAISE NOTICE 'Added notifications.project_id.'; ELSE RAISE NOTICE 'notifications.project_id exists.'; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='notifications' AND column_name='note_id') THEN ALTER TABLE public.notifications ADD COLUMN note_id UUID REFERENCES public.notes(id) ON DELETE CASCADE; RAISE NOTICE 'Added notifications.note_id.'; ELSE RAISE NOTICE 'notifications.note_id exists.'; END IF; END $$;
COMMENT ON TABLE public.notifications IS 'Stores user notifications.';
DO $$ BEGIN RAISE NOTICE 'Ensured structure for public.notifications.'; END $$;

-- ============================================================================
-- Function and Trigger to create profile on new auth.users entry
-- ============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  profile_role public.user_role;
  user_email TEXT;
  user_full_name TEXT;
  user_position TEXT;
  user_avatar TEXT;
BEGIN
  user_email := NEW.email;
  user_full_name := NEW.raw_user_meta_data->>'full_name';
  user_position := NEW.raw_user_meta_data->>'position';
  user_avatar := NEW.raw_user_meta_data->>'avatar_url';

  IF NEW.raw_user_meta_data->>'role' = 'Admin' THEN
    profile_role := 'Admin'::public.user_role;
  ELSE
    profile_role := 'User'::public.user_role;
  END IF;

  IF user_full_name IS NULL OR user_full_name = '' THEN
      user_full_name := split_part(user_email, '@', 1);
  END IF;

  INSERT INTO public.profiles (id, full_name, email, role, position, avatar_url)
  VALUES (NEW.id, user_full_name, user_email, profile_role, user_position, user_avatar)
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    email = EXCLUDED.email,
    role = EXCLUDED.role,
    position = EXCLUDED.position,
    avatar_url = EXCLUDED.avatar_url,
    updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
COMMENT ON FUNCTION public.handle_new_user() IS 'Copies new user data from auth.users to public.profiles.';
DO $$ BEGIN RAISE NOTICE 'Ensured handle_new_user function and trigger.'; END $$;

-- ============================================================================
-- Row Level Security (RLS) - Helper Functions
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_user_role(user_id_to_check UUID)
RETURNS public.user_role AS $$
DECLARE
  profile_role public.user_role;
BEGIN
  SELECT role INTO profile_role FROM public.profiles WHERE id = user_id_to_check;
  RETURN profile_role;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;
COMMENT ON FUNCTION public.get_user_role(UUID) IS 'Returns the role of a user. SECURITY DEFINER for RLS.';

CREATE OR REPLACE FUNCTION public.can_update_role_if_admin(new_role public.user_role, old_role public.user_role)
RETURNS BOOLEAN AS $$
BEGIN
  IF new_role IS DISTINCT FROM old_role THEN
    RETURN (SELECT public.get_user_role(auth.uid()) = 'Admin'::public.user_role);
  END IF;
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;
COMMENT ON FUNCTION public.can_update_role_if_admin(public.user_role, public.user_role) IS 'Checks if admin for role change. SECURITY DEFINER for RLS.';
DO $$ BEGIN RAISE NOTICE 'Ensured RLS helper functions.'; END $$;

-- ============================================================================
-- Row Level Security (RLS) - Policies (Drop if exists, then create)
-- ============================================================================

-- Profiles RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view their own profile." ON public.profiles;
CREATE POLICY "Users can view their own profile." ON public.profiles
  FOR SELECT USING (auth.uid() = id);
DROP POLICY IF EXISTS "Authenticated users can view all profiles." ON public.profiles;
CREATE POLICY "Authenticated users can view all profiles." ON public.profiles
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Users can update their own profile (but not their role)." ON public.profiles;
CREATE POLICY "Users can update their own profile (but not their role)." ON public.profiles
  FOR UPDATE USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id AND
    (
        NEW.role IS NOT DISTINCT FROM OLD.role OR -- Role is not changing (handles NULLs safely)
        (SELECT public.get_user_role(auth.uid()) = 'Admin'::public.user_role) -- Or, if role is changing, current user must be an Admin
    )
  );
DROP POLICY IF EXISTS "Admins can manage all profiles." ON public.profiles;
CREATE POLICY "Admins can manage all profiles." ON public.profiles
  FOR ALL USING (public.get_user_role(auth.uid()) = 'Admin'::public.user_role)
  WITH CHECK (public.get_user_role(auth.uid()) = 'Admin'::public.user_role);
DO $$ BEGIN RAISE NOTICE 'Applied RLS to public.profiles.'; END $$;

-- Projects RLS
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated users can view all projects." ON public.projects;
CREATE POLICY "Authenticated users can view all projects." ON public.projects
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Admins can manage all projects." ON public.projects;
CREATE POLICY "Admins can manage all projects." ON public.projects
  FOR ALL USING (public.get_user_role(auth.uid()) = 'Admin'::public.user_role)
  WITH CHECK (public.get_user_role(auth.uid()) = 'Admin'::public.user_role);
DO $$ BEGIN RAISE NOTICE 'Applied RLS to public.projects.'; END $$;

-- Tasks RLS
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated users can view tasks." ON public.tasks;
CREATE POLICY "Authenticated users can view tasks." ON public.tasks
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Admins can manage all tasks." ON public.tasks;
CREATE POLICY "Admins can manage all tasks." ON public.tasks
  FOR ALL USING (public.get_user_role(auth.uid()) = 'Admin'::public.user_role)
  WITH CHECK (public.get_user_role(auth.uid()) = 'Admin'::public.user_role);
DROP POLICY IF EXISTS "Assigned users or Admins can update tasks." ON public.tasks;
CREATE POLICY "Assigned users or Admins can update tasks." ON public.tasks
  FOR UPDATE TO authenticated
  USING ( (auth.uid() = ANY(COALESCE(assignee_ids, '{}'))) OR (public.get_user_role(auth.uid()) = 'Admin'::public.user_role) )
  WITH CHECK ( (auth.uid() = ANY(COALESCE(assignee_ids, '{}'))) OR (public.get_user_role(auth.uid()) = 'Admin'::public.user_role) );
DO $$ BEGIN RAISE NOTICE 'Applied RLS to public.tasks.'; END $$;

-- Notes RLS
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Recipients can view notes addressed to them." ON public.notes;
CREATE POLICY "Recipients can view notes addressed to them." ON public.notes
  FOR SELECT TO authenticated USING (auth.uid() = ANY(recipient_user_ids));
DROP POLICY IF EXISTS "Admins can manage all notes." ON public.notes;
CREATE POLICY "Admins can manage all notes." ON public.notes
  FOR ALL USING (public.get_user_role(auth.uid()) = 'Admin'::public.user_role)
  WITH CHECK (public.get_user_role(auth.uid()) = 'Admin'::public.user_role);
DO $$ BEGIN RAISE NOTICE 'Applied RLS to public.notes.'; END $$;

-- Notifications RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view their own notifications." ON public.notifications;
CREATE POLICY "Users can view their own notifications." ON public.notifications
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update their own notifications (mark as read)." ON public.notifications;
CREATE POLICY "Users can update their own notifications (mark as read)." ON public.notifications
  FOR UPDATE TO authenticated USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id AND OLD.is_read = FALSE AND NEW.is_read = TRUE);
DROP POLICY IF EXISTS "Admins can manage all notifications." ON public.notifications;
CREATE POLICY "Admins can manage all notifications." ON public.notifications
  FOR ALL USING (public.get_user_role(auth.uid()) = 'Admin'::public.user_role)
  WITH CHECK (public.get_user_role(auth.uid()) = 'Admin'::public.user_role);
DO $$ BEGIN RAISE NOTICE 'Applied RLS to public.notifications.'; END $$;

DO $$ BEGIN RAISE NOTICE 'TaskFlow AI Non-Destructive Schema Setup/Update Script Completed Successfully.'; END $$;

