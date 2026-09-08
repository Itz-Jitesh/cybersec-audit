-- supabase/tests/projects.sql
-- Assertions for phase 7: project provisioning and the state guards.
--
-- These exercise the database-side invariants the actions rely on. The
-- authorization half is asserted in rls.sql, which proves a member who is not
-- a team lead cannot write to a project they do not manage.

create temp table if not exists project_test_results (
  test text primary key,
  pass boolean not null,
  detail text
) on commit preserve rows;

truncate project_test_results;

create or replace function pg_temp.project_record(p_test text, p_pass boolean, p_detail text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into project_test_results (test, pass, detail)
  values (p_test, p_pass, p_detail)
  on conflict (test) do update set pass = excluded.pass, detail = excluded.detail;
end;
$$;

begin;

delete from invites where email::text like '%@project-test.invalid';
delete from projects where identifier in ('PTST');
delete from teams where slug = 'project-test-team';

insert into teams (id, name, slug, color)
values ('92000000-0000-4000-8000-000000000001', 'Project Test', 'project-test-team', '#3f76ff');

insert into invites (email, role, expires_at)
values ('creator@project-test.invalid', 'member', now() + interval '1 day');

insert into auth.users (id, email, raw_user_meta_data)
values ('92000000-0000-4000-8000-000000000002', 'creator@project-test.invalid',
        '{"full_name":"Project Creator"}'::jsonb);

commit;

-- ---------------------------------------------------------------------------
-- Provisioning: six states, seven labels, one project_members row
-- ---------------------------------------------------------------------------
-- Mirrors the single transaction createProject runs.

begin;

insert into projects (id, team_id, name, identifier, created_by)
values ('92000000-0000-4000-8000-000000000010',
        '92000000-0000-4000-8000-000000000001',
        'Project Test', 'PTST', '92000000-0000-4000-8000-000000000002');

insert into states (project_id, name, "group", color, sequence, is_default) values
  ('92000000-0000-4000-8000-000000000010', 'Backlog', 'backlog', '#6b7280', 1000, false),
  ('92000000-0000-4000-8000-000000000010', 'Todo', 'unstarted', '#9ca3af', 2000, true),
  ('92000000-0000-4000-8000-000000000010', 'In Progress', 'started', '#f59e0b', 3000, false),
  ('92000000-0000-4000-8000-000000000010', 'In Review', 'started', '#f59e0b', 4000, false),
  ('92000000-0000-4000-8000-000000000010', 'Done', 'completed', '#16a34a', 5000, false),
  ('92000000-0000-4000-8000-000000000010', 'Cancelled', 'cancelled', '#ef4444', 6000, false);

insert into labels (project_id, name, color) values
  ('92000000-0000-4000-8000-000000000010', 'bug', '#ef4444'),
  ('92000000-0000-4000-8000-000000000010', 'feature', '#3f76ff'),
  ('92000000-0000-4000-8000-000000000010', 'documentation', '#8b5cf6'),
  ('92000000-0000-4000-8000-000000000010', 'research', '#14b8a6'),
  ('92000000-0000-4000-8000-000000000010', 'ctf', '#f59e0b'),
  ('92000000-0000-4000-8000-000000000010', 'blocked', '#f97316'),
  ('92000000-0000-4000-8000-000000000010', 'good-first-issue', '#16a34a');

insert into project_members (project_id, user_id, role)
values ('92000000-0000-4000-8000-000000000010',
        '92000000-0000-4000-8000-000000000002', 'admin');

do $$
declare n int;
begin
  select count(*) into n from states where project_id = '92000000-0000-4000-8000-000000000010';
  perform pg_temp.project_record('a new project has six states',
    n = 6, 'saw ' || n || ', expected 6');

  select count(*) into n from labels where project_id = '92000000-0000-4000-8000-000000000010';
  perform pg_temp.project_record('a new project has seven labels',
    n = 7, 'saw ' || n || ', expected 7');

  select count(*) into n from project_members
   where project_id = '92000000-0000-4000-8000-000000000010' and role = 'admin';
  perform pg_temp.project_record('the creator is a project admin',
    n = 1, 'saw ' || n || ', expected 1');

  select count(*) into n from states
   where project_id = '92000000-0000-4000-8000-000000000010' and is_default;
  perform pg_temp.project_record('exactly one state is the default',
    n = 1, 'saw ' || n || ', expected 1');
end $$;
commit;

-- ---------------------------------------------------------------------------
-- The identifier is unique workspace-wide, case-insensitively
-- ---------------------------------------------------------------------------

begin;
do $$
begin
  begin
    insert into projects (team_id, name, identifier, created_by)
    values ('92000000-0000-4000-8000-000000000001', 'Duplicate', 'ptst',
            '92000000-0000-4000-8000-000000000002');
    perform pg_temp.project_record('identifier is unique case-insensitively',
      false, 'a lowercase duplicate was accepted');
  exception when others then
    perform pg_temp.project_record('identifier is unique case-insensitively',
      true, 'rejected: ' || sqlerrm);
  end;
end $$;
commit;

-- ---------------------------------------------------------------------------
-- A state holding issues cannot simply be dropped
-- ---------------------------------------------------------------------------
-- issues.state_id is NOT NULL with no ON DELETE action, so the database refuses
-- the delete. deleteState checks for this first so the user gets a sentence
-- rather than a constraint violation, but the constraint is the real backstop.

begin;

insert into issues (id, project_id, state_id, name, sort_order, created_by)
select '92000000-0000-4000-8000-000000000020',
       '92000000-0000-4000-8000-000000000010', s.id, 'Holds a state', 1000,
       '92000000-0000-4000-8000-000000000002'
from states s
where s.project_id = '92000000-0000-4000-8000-000000000010' and s.name = 'Todo';

do $$
declare target uuid; n int;
begin
  select id into target from states
   where project_id = '92000000-0000-4000-8000-000000000010' and name = 'Todo';

  select count(*) into n from issues where state_id = target;
  perform pg_temp.project_record('deleteState can detect issues in a state',
    n = 1, 'saw ' || n || ' issue(s) referencing the state, expected 1');

  begin
    delete from states where id = target;
    perform pg_temp.project_record('a state with issues cannot be deleted',
      false, 'the delete was unexpectedly allowed');
  exception when others then
    perform pg_temp.project_record('a state with issues cannot be deleted',
      true, 'rejected: ' || sqlerrm);
  end;
end $$;
commit;

-- ---------------------------------------------------------------------------
-- The issue sequence starts at one and increments per project
-- ---------------------------------------------------------------------------

begin;
do $$
declare first_seq int; second_seq int;
begin
  select sequence_id into first_seq from issues
   where id = '92000000-0000-4000-8000-000000000020';

  insert into issues (id, project_id, state_id, name, sort_order, created_by)
  select '92000000-0000-4000-8000-000000000021',
         '92000000-0000-4000-8000-000000000010', s.id, 'Second issue', 2000,
         '92000000-0000-4000-8000-000000000002'
  from states s
  where s.project_id = '92000000-0000-4000-8000-000000000010' and s.name = 'Todo';

  select sequence_id into second_seq from issues
   where id = '92000000-0000-4000-8000-000000000021';

  perform pg_temp.project_record('the first issue in a project is number one',
    first_seq = 1, 'got ' || first_seq);
  perform pg_temp.project_record('the sequence increments without gaps',
    second_seq = 2, 'got ' || second_seq);
end $$;
commit;

-- ---------------------------------------------------------------------------
-- Cleanup
-- ---------------------------------------------------------------------------

begin;

delete from issues where project_id = '92000000-0000-4000-8000-000000000010';
delete from projects where team_id = '92000000-0000-4000-8000-000000000001';
delete from team_members where user_id = '92000000-0000-4000-8000-000000000002';
delete from workspace_members where user_id = '92000000-0000-4000-8000-000000000002';
delete from profiles where email like '%@project-test.invalid';
delete from auth.users where email like '%@project-test.invalid';
delete from invites where email::text like '%@project-test.invalid';
delete from teams where slug = 'project-test-team';

commit;

select test as test, pass as pass, detail as detail from project_test_results order by test;
