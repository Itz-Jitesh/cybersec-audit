-- 0009_mentor_role.sql
-- Add mentor workspace role: view + comment on all teams, no admin/dev.

-- 1. Extend the enum
ALTER TYPE workspace_role ADD VALUE IF NOT EXISTS 'mentor' AFTER 'member';

-- 2. Update RLS helpers to treat mentor like workspace admin for reads.
--    Mentors see all teams and projects but cannot manage anything.

CREATE OR REPLACE FUNCTION is_workspace_admin(uid uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM workspace_members
    WHERE user_id = uid
      AND is_active
      AND role IN ('admin', 'president', 'co_president', 'mentor')
  );
$$;

CREATE OR REPLACE FUNCTION is_project_member(uid uuid, pid uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT is_workspace_admin(uid) OR EXISTS (
    SELECT 1
    FROM projects p
    LEFT JOIN project_members pm ON pm.project_id = p.id AND pm.user_id = uid
    LEFT JOIN team_members tm ON tm.team_id = p.team_id AND tm.user_id = uid
    WHERE p.id = pid AND (pm.id IS NOT NULL OR tm.id IS NOT NULL)
  );
$$;
