-- 0010_fix_mentor_rls.sql
-- Fix 0009: add mentor to enum + fix RLS functions.
-- 0009 was never applied on production, so the enum is still missing 'mentor'.
-- Mentors have READ access to all teams/projects but are NOT admins.

-- 1. Add 'mentor' to the workspace_role enum (idempotent).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumtypid = 'workspace_role'::regtype
      AND enumlabel = 'mentor'
  ) THEN
    ALTER TYPE workspace_role ADD VALUE 'mentor' AFTER 'member';
  END IF;
END
$$;

-- 2. Revert is_workspace_admin: only admin, president, co_president.
CREATE OR REPLACE FUNCTION is_workspace_admin(uid uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM workspace_members
    WHERE user_id = uid
      AND is_active
      AND role IN ('admin', 'president', 'co_president')
  );
$$;

-- 3. New helper: is the user a mentor?
CREATE OR REPLACE FUNCTION is_mentor(uid uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM workspace_members
    WHERE user_id = uid
      AND is_active
      AND role = 'mentor'
  );
$$;

-- 4. Fix is_project_member: workspace admins OR mentors OR direct membership.
CREATE OR REPLACE FUNCTION is_project_member(uid uuid, pid uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT is_workspace_admin(uid) OR is_mentor(uid) OR EXISTS (
    SELECT 1
    FROM projects p
    LEFT JOIN project_members pm ON pm.project_id = p.id AND pm.user_id = uid
    LEFT JOIN team_members tm ON tm.team_id = p.team_id AND tm.user_id = uid
    WHERE p.id = pid AND (pm.id IS NOT NULL OR tm.id IS NOT NULL)
  );
$$;
