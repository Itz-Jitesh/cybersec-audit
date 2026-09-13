-- supabase/tests/my-issues.sql
-- Assertions for the /my-issues visibility rule.
--
-- Unlike the other suites, the rule under test is not an RLS policy. Reads on
-- this route go through Drizzle as the `postgres` role, which has BYPASSRLS,
-- so the only thing deciding what a person sees is the WHERE clause in
-- src/db/queries/my-issues.ts. The predicate below is that clause written out.
-- This therefore asserts the rule rather than the exact code path — the
-- honest description of what it buys is that the rule is right and stays
-- right, not that the TypeScript builds it correctly.
--
-- The rule that matters: being assigned to an issue is not permission to read
-- it. Assignment rows survive a member leaving a team, so without the
-- membership test a former member would keep seeing that team's work here long
-- after losing access to it everywhere else.

create temp table if not exists my_issue_test_results (
  test text primary key,
  pass boolean not null,
  detail text
) on commit preserve rows;

truncate my_issue_test_results;

create or replace function pg_temp.my_issue_record(p_test text, p_pass boolean, p_detail text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into my_issue_test_results (test, pass, detail)
  values (p_test, p_pass, p_detail)
  on conflict (test) do update set pass = excluded.pass, detail = excluded.detail;
end;
$$;

-- The visibility predicate from getMyIssues, as a function so each assertion
-- calls the same one thing rather than repeating it and drifting.
create or replace function pg_temp.visible_assigned_count(uid uuid)
returns int
language sql
stable
set search_path = public, pg_temp
as $$
  select count(*)::int
  from issues i
  join issue_assignees ia on ia.issue_id = i.id
  join states s on s.id = i.state_id
  join projects p on p.id = i.project_id
  where ia.user_id = uid
    -- Issue archiving is gone (0015). Project archiving is a separate feature
    -- and still hides an entire project's work from this list.
    and p.is_archived = false
    and (
      exists (
        select 1 from project_members pm
        where pm.project_id = p.id and pm.user_id = uid
      )
      or exists (
        select 1 from team_members tm
        where tm.team_id = p.team_id and tm.user_id = uid
      )
    )
$$;

-- ---------------------------------------------------------------------------
-- Fixtures
-- ---------------------------------------------------------------------------
begin;

delete from issue_assignees where user_id in (
  select id from profiles where email like '%@mine-test.invalid'
);
delete from issues where project_id = '96000000-0000-4000-8000-000000000020';
delete from states where project_id = '96000000-0000-4000-8000-000000000020';
delete from projects where identifier = 'MINE';
delete from team_members where user_id in (
  select id from profiles where email like '%@mine-test.invalid'
);
delete from workspace_members where user_id in (
  select id from profiles where email like '%@mine-test.invalid'
);
delete from profiles where email like '%@mine-test.invalid';
delete from auth.users where email like '%@mine-test.invalid';
delete from invites where email::text like '%@mine-test.invalid';
delete from teams where slug = 'mine-test-team';

insert into teams (id, name, slug, color)
values ('96000000-0000-4000-8000-000000000010', 'Mine Test', 'mine-test-team', '#3f76ff');

insert into invites (email, role, expires_at)
values ('worker@mine-test.invalid', 'member', now() + interval '1 day');

insert into auth.users (id, email, encrypted_password, raw_user_meta_data)
values ('96000000-0000-4000-8000-000000000001', 'worker@mine-test.invalid', '',
        '{"full_name":"Mine Worker"}'::jsonb);

insert into team_members (team_id, user_id, role)
values ('96000000-0000-4000-8000-000000000010',
        '96000000-0000-4000-8000-000000000001', 'member');

insert into projects (id, team_id, name, identifier, created_by)
values ('96000000-0000-4000-8000-000000000020',
        '96000000-0000-4000-8000-000000000010',
        'Mine Test Project', 'MINE',
        '96000000-0000-4000-8000-000000000001');

insert into states (id, project_id, name, "group", color, sequence, is_default)
values ('96000000-0000-4000-8000-000000000030',
        '96000000-0000-4000-8000-000000000020',
        'Todo', 'unstarted', '#9ca3af', 1000, true);

insert into issues (id, project_id, state_id, name, sort_order, created_by)
values ('96000000-0000-4000-8000-000000000040',
        '96000000-0000-4000-8000-000000000020',
        '96000000-0000-4000-8000-000000000030',
        'Assigned fixture issue', 1000,
        '96000000-0000-4000-8000-000000000001');

insert into issue_assignees (issue_id, user_id)
values ('96000000-0000-4000-8000-000000000040',
        '96000000-0000-4000-8000-000000000001');

commit;

-- ---------------------------------------------------------------------------
-- 1. A team member sees their own assignment.
-- ---------------------------------------------------------------------------
begin;
do $$
declare n int;
begin
  n := pg_temp.visible_assigned_count('96000000-0000-4000-8000-000000000001');
  perform pg_temp.my_issue_record('team member sees their assignment',
    n = 1, 'saw ' || n || ' rows, expected 1');
end $$;
commit;

-- ---------------------------------------------------------------------------
-- 2. Removed from the team, the assignment stops being visible.
-- ---------------------------------------------------------------------------
begin;
delete from team_members
where team_id = '96000000-0000-4000-8000-000000000010'
  and user_id = '96000000-0000-4000-8000-000000000001';

do $$
declare n int; a int;
begin
  -- The assignment row is still there. That is the point: it is not the
  -- assignment that grants the read, and this assertion is worthless if the
  -- row quietly disappeared instead.
  select count(*) into a from issue_assignees
  where user_id = '96000000-0000-4000-8000-000000000001';
  perform pg_temp.my_issue_record('the assignment row survives removal',
    a = 1, 'saw ' || a || ' assignment rows, expected 1');

  n := pg_temp.visible_assigned_count('96000000-0000-4000-8000-000000000001');
  perform pg_temp.my_issue_record('a removed member loses the assignment',
    n = 0, 'saw ' || n || ' rows, expected 0');
end $$;
commit;

-- ---------------------------------------------------------------------------
-- 3. Direct project membership is enough on its own, with no team membership.
-- ---------------------------------------------------------------------------
begin;
insert into project_members (project_id, user_id, role)
values ('96000000-0000-4000-8000-000000000020',
        '96000000-0000-4000-8000-000000000001', 'member')
on conflict do nothing;

do $$
declare n int;
begin
  n := pg_temp.visible_assigned_count('96000000-0000-4000-8000-000000000001');
  perform pg_temp.my_issue_record('project membership alone grants the read',
    n = 1, 'saw ' || n || ' rows, expected 1');
end $$;
commit;

-- ---------------------------------------------------------------------------
-- 4. Archiving the project takes it out of the worklist.
-- ---------------------------------------------------------------------------
begin;
update projects set is_archived = true
where id = '96000000-0000-4000-8000-000000000020';

do $$
declare n int;
begin
  n := pg_temp.visible_assigned_count('96000000-0000-4000-8000-000000000001');
  perform pg_temp.my_issue_record('an archived project drops out',
    n = 0, 'saw ' || n || ' rows, expected 0');
end $$;
commit;

-- ---------------------------------------------------------------------------
-- Cleanup
-- ---------------------------------------------------------------------------
begin;
delete from issue_assignees where user_id in (
  select id from profiles where email like '%@mine-test.invalid'
);
delete from project_members where project_id = '96000000-0000-4000-8000-000000000020';
delete from issues where project_id = '96000000-0000-4000-8000-000000000020';
delete from states where project_id = '96000000-0000-4000-8000-000000000020';
delete from projects where identifier = 'MINE';
delete from team_members where user_id in (
  select id from profiles where email like '%@mine-test.invalid'
);
delete from workspace_members where user_id in (
  select id from profiles where email like '%@mine-test.invalid'
);
delete from profiles where email like '%@mine-test.invalid';
delete from auth.users where email like '%@mine-test.invalid';
delete from invites where email::text like '%@mine-test.invalid';
delete from teams where slug = 'mine-test-team';
commit;

select test as test, pass as pass, detail as detail from my_issue_test_results order by test;
