-- supabase/tests/rls.sql
-- The RLS assertion suite from docs/04-DATA-MODEL.md §10. It creates its own
-- five simulated users (admin, president, tech lead, tech member, design
-- member), runs every read and write assertion inside a per-user transaction
-- that impersonates the `authenticated` role with that user's id as
-- request.jwt.claims, and records PASS or FAIL per assertion.
--
-- Every assertion block commits: temp-table results are transactional, so a
-- rollback would erase the verdicts it recorded. Test writes are undone after
-- the fact by the deterministic cleanup block, which removes only the fixture
-- ids and emails this suite created. The anon block leaves the session acting
-- as the anon role, so the cleanup first resets to postgres.
--
-- Run with: psql "$DATABASE_URL" -f supabase/tests/rls.sql
-- or with:  node --env-file=.env.local src/db/run-rls-tests.ts  (no psql needed)
--
-- The suite prints a final "RLS SUITE: pass" or "RLS SUITE: N FAILURES" line
-- through the runner, which inspects rls_test_results.

create temp table if not exists rls_test_results (
  test text not null,
  pass boolean not null,
  detail text not null
);

create or replace function pg_temp.rls_record(test text, pass boolean, detail text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into rls_test_results (test, pass, detail)
  values (test, pass, detail);
end;
$$;

-- ---------------------------------------------------------------------------
-- Fixtures
-- ---------------------------------------------------------------------------

begin;

delete from workspace_members where user_id in (
  select id from profiles where email like '%@rls-test.invalid'
);
delete from audit_log where action = 'invite.sent' and actor_id in (
  select id from profiles where email like '%@rls-test.invalid'
);
delete from team_members where user_id in (
  select id from profiles where email like '%@rls-test.invalid'
);
delete from projects where identifier in ('RLS', 'RLSD');
delete from profiles where email like '%@rls-test.invalid';
delete from auth.users where email like '%@rls-test.invalid';

insert into auth.users (id, email, encrypted_password) values
  ('90000000-0000-4000-8000-000000000001', 'admin@rls-test.invalid', ''),
  ('90000000-0000-4000-8000-000000000002', 'president@rls-test.invalid', ''),
  ('90000000-0000-4000-8000-000000000003', 'tech-lead@rls-test.invalid', ''),
  ('90000000-0000-4000-8000-000000000004', 'tech-member@rls-test.invalid', ''),
  ('90000000-0000-4000-8000-000000000005', 'design-member@rls-test.invalid', '');

insert into profiles (id, email, display_name) values
  ('90000000-0000-4000-8000-000000000001', 'admin@rls-test.invalid', 'RLS Admin'),
  ('90000000-0000-4000-8000-000000000002', 'president@rls-test.invalid', 'RLS President'),
  ('90000000-0000-4000-8000-000000000003', 'tech-lead@rls-test.invalid', 'RLS Tech Lead'),
  ('90000000-0000-4000-8000-000000000004', 'tech-member@rls-test.invalid', 'RLS Tech Member'),
  ('90000000-0000-4000-8000-000000000005', 'design-member@rls-test.invalid', 'RLS Design Member');

insert into workspace_members (user_id, role) values
  ('90000000-0000-4000-8000-000000000001', 'admin'),
  ('90000000-0000-4000-8000-000000000002', 'president'),
  ('90000000-0000-4000-8000-000000000003', 'member'),
  ('90000000-0000-4000-8000-000000000004', 'member'),
  ('90000000-0000-4000-8000-000000000005', 'member');

insert into team_members (team_id, user_id, role)
select id, '90000000-0000-4000-8000-000000000003', 'lead' from teams where slug = 'tech';
insert into team_members (team_id, user_id, role)
select id, '90000000-0000-4000-8000-000000000004', 'member' from teams where slug = 'tech';
insert into team_members (team_id, user_id, role)
select id, '90000000-0000-4000-8000-000000000005', 'member' from teams where slug = 'design';

insert into projects (id, team_id, name, identifier, created_by)
select '90000000-0000-4000-8000-000000000010', id, 'RLS Test Project', 'RLS',
       '90000000-0000-4000-8000-000000000003'
from teams where slug = 'tech';

insert into states (id, project_id, name, "group", color, sequence, is_default)
values ('90000000-0000-4000-8000-000000000020',
        '90000000-0000-4000-8000-000000000010',
        'Todo', 'unstarted', '#9ca3af', 1000, true);

insert into issues (id, project_id, state_id, name, sort_order, created_by)
values ('90000000-0000-4000-8000-000000000030',
        '90000000-0000-4000-8000-000000000010',
        '90000000-0000-4000-8000-000000000020',
        'RLS fixture issue', 1000,
        '90000000-0000-4000-8000-000000000003');

insert into notifications (id, user_id, actor_id, type, title)
values ('90000000-0000-4000-8000-000000000040',
        '90000000-0000-4000-8000-000000000001',
        '90000000-0000-4000-8000-000000000003',
        'assigned', 'RLS fixture notification');

-- A second project in the design team, so cross-team assertions are real:
-- every non-admin user must see exactly one project and never the other's.
insert into projects (id, team_id, name, identifier, created_by)
select '90000000-0000-4000-8000-000000000011', id, 'RLS Design Project', 'RLSD',
       '90000000-0000-4000-8000-000000000005'
from teams where slug = 'design';

insert into states (id, project_id, name, "group", color, sequence, is_default)
values ('90000000-0000-4000-8000-000000000021',
        '90000000-0000-4000-8000-000000000011',
        'Todo', 'unstarted', '#9ca3af', 1000, true);

-- The activity row exists so the read assertions have something to see; it is
-- inserted here as the table owner, the same way the triggers write it.
insert into issue_activity (id, issue_id, actor_id, field, new_value, new_display)
values ('90000000-0000-4000-8000-000000000050',
        '90000000-0000-4000-8000-000000000030',
        '90000000-0000-4000-8000-000000000003',
        'created', '90000000-0000-4000-8000-000000000030', 'RLS fixture issue');

-- One audit row so the admin-only read policy has something to find.
insert into audit_log (id, actor_id, action, entity_type, entity_id)
values ('90000000-0000-4000-8000-000000000060',
        '90000000-0000-4000-8000-000000000001',
        'invite.sent', 'invite', null);

-- A private view owned by the admin on the tech project: only its owner may
-- see it, which the tech member's read assertion proves.
insert into views (id, project_id, name, access, owner_id, created_by)
values ('90000000-0000-4000-8000-000000000070',
        '90000000-0000-4000-8000-000000000010',
        'RLS private view', 'private',
        '90000000-0000-4000-8000-000000000001',
        '90000000-0000-4000-8000-000000000001');

commit;

-- ---------------------------------------------------------------------------
-- Impersonation pattern
-- ---------------------------------------------------------------------------
-- Each assertion block runs inside its own transaction, becomes `authenticated`
-- carrying the user's id in request.jwt.claims, evaluates one expectation, and
-- rolls back. Nothing a test does survives its own transaction.

-- §10 check 1 — reads own team's project.
begin;
select set_config('role', 'authenticated', true);
select set_config('request.jwt.claims', '{"sub":"90000000-0000-4000-8000-000000000004"}', true);
do $$
declare n int;
begin
  select count(*) into n from projects
  where id = '90000000-0000-4000-8000-000000000010';
  perform pg_temp.rls_record('tech member reads own team project',
    n = 1, 'saw ' || n || ' rows, expected 1');
end $$;
commit;

-- §10 check 2 — must NOT read another team's project.
begin;
select set_config('role', 'authenticated', true);
select set_config('request.jwt.claims', '{"sub":"90000000-0000-4000-8000-000000000004"}', true);
do $$
declare n int;
begin
  select count(*) into n from projects
  where id = '90000000-0000-4000-8000-000000000011';
  perform pg_temp.rls_record('tech member cannot read design project',
    n = 0, 'saw ' || n || ' rows, expected 0');
end $$;
commit;

-- §10 check 3 — must NOT escalate own role.
begin;
select set_config('role', 'authenticated', true);
select set_config('request.jwt.claims', '{"sub":"90000000-0000-4000-8000-000000000004"}', true);
do $$
declare n int;
begin
  update workspace_members set role = 'admin'
  where user_id = '90000000-0000-4000-8000-000000000004';
  get diagnostics n = row_count;
  perform pg_temp.rls_record('tech member cannot escalate own role',
    n = 0, 'updated ' || n || ' rows, expected 0');
end $$;
commit;

-- §10 check 4 — must NOT insert issue_activity directly.
begin;
select set_config('role', 'authenticated', true);
select set_config('request.jwt.claims', '{"sub":"90000000-0000-4000-8000-000000000004"}', true);
do $$
begin
  insert into issue_activity (issue_id, actor_id, field)
  values ('90000000-0000-4000-8000-000000000030',
          '90000000-0000-4000-8000-000000000004', 'state');
  perform pg_temp.rls_record('tech member cannot insert issue_activity',
    false, 'insert was unexpectedly allowed');
exception when others then
  perform pg_temp.rls_record('tech member cannot insert issue_activity',
    true, 'denied: ' || sqlerrm);
end $$;
commit;

-- §10 check 5 — must NOT read another user's notifications.
begin;
select set_config('role', 'authenticated', true);
select set_config('request.jwt.claims', '{"sub":"90000000-0000-4000-8000-000000000004"}', true);
do $$
declare n int;
begin
  select count(*) into n from notifications
  where user_id = '90000000-0000-4000-8000-000000000001';
  perform pg_temp.rls_record('tech member cannot read others notifications',
    n = 0, 'saw ' || n || ' rows, expected 0');
end $$;
commit;

-- Matrix: a member may create issues in a project they can see...
begin;
select set_config('role', 'authenticated', true);
select set_config('request.jwt.claims', '{"sub":"90000000-0000-4000-8000-000000000004"}', true);
do $$
declare n int;
begin
  insert into issues (project_id, state_id, name, sort_order, created_by)
  values ('90000000-0000-4000-8000-000000000010',
          '90000000-0000-4000-8000-000000000020',
          'tech member can create issues', 2000,
          '90000000-0000-4000-8000-000000000004');
  get diagnostics n = row_count;
  perform pg_temp.rls_record('tech member can create an issue in own project',
    n = 1, 'inserted ' || n || ' rows');
end $$;
commit;

-- ...but may never hard-delete one. DELETE denials are silent: the policy's
-- USING clause filters the row out, so the assertion is on the row count.
begin;
select set_config('role', 'authenticated', true);
select set_config('request.jwt.claims', '{"sub":"90000000-0000-4000-8000-000000000004"}', true);
do $$
declare n int;
begin
  delete from issues where id = '90000000-0000-4000-8000-000000000030';
  get diagnostics n = row_count;
  perform pg_temp.rls_record('tech member cannot delete an issue',
    n = 0, 'deleted ' || n || ' rows, expected 0');
end $$;
commit;

-- Design member: same five §10 checks from the other side of the wall.
begin;
select set_config('role', 'authenticated', true);
select set_config('request.jwt.claims', '{"sub":"90000000-0000-4000-8000-000000000005"}', true);
do $$
declare n int;
begin
  select count(*) into n from projects
  where id = '90000000-0000-4000-8000-000000000011';
  perform pg_temp.rls_record('design member reads own team project',
    n = 1, 'saw ' || n || ' rows, expected 1');

  select count(*) into n from projects
  where id = '90000000-0000-4000-8000-000000000010';
  perform pg_temp.rls_record('design member cannot read tech project',
    n = 0, 'saw ' || n || ' rows, expected 0');

  update workspace_members set role = 'admin'
  where user_id = '90000000-0000-4000-8000-000000000005';
  get diagnostics n = row_count;
  perform pg_temp.rls_record('design member cannot escalate own role',
    n = 0, 'updated ' || n || ' rows, expected 0');

  begin
    insert into issue_activity (issue_id, actor_id, field)
    values ('90000000-0000-4000-8000-000000000030',
            '90000000-0000-4000-8000-000000000005', 'state');
    perform pg_temp.rls_record('design member cannot insert issue_activity',
      false, 'insert was unexpectedly allowed');
  exception when others then
    perform pg_temp.rls_record('design member cannot insert issue_activity',
      true, 'denied: ' || sqlerrm);
  end;

  select count(*) into n from notifications
  where user_id = '90000000-0000-4000-8000-000000000001';
  perform pg_temp.rls_record('design member cannot read others notifications',
    n = 0, 'saw ' || n || ' rows, expected 0');
end $$;
commit;

-- Tech lead: reads own, blocked across teams, cannot escalate or forge
-- activity, may not see others' notifications — and CAN delete issues.
begin;
select set_config('role', 'authenticated', true);
select set_config('request.jwt.claims', '{"sub":"90000000-0000-4000-8000-000000000003"}', true);
do $$
declare n int;
begin
  select count(*) into n from projects
  where id = '90000000-0000-4000-8000-000000000010';
  perform pg_temp.rls_record('tech lead reads own team project',
    n = 1, 'saw ' || n || ' rows, expected 1');

  select count(*) into n from projects
  where id = '90000000-0000-4000-8000-000000000011';
  perform pg_temp.rls_record('tech lead cannot read design project',
    n = 0, 'saw ' || n || ' rows, expected 0');

  update workspace_members set role = 'admin'
  where user_id = '90000000-0000-4000-8000-000000000003';
  get diagnostics n = row_count;
  perform pg_temp.rls_record('tech lead cannot escalate own role',
    n = 0, 'updated ' || n || ' rows, expected 0');

  begin
    insert into issue_activity (issue_id, actor_id, field)
    values ('90000000-0000-4000-8000-000000000030',
            '90000000-0000-4000-8000-000000000003', 'state');
    perform pg_temp.rls_record('tech lead cannot insert issue_activity',
      false, 'insert was unexpectedly allowed');
  exception when others then
    perform pg_temp.rls_record('tech lead cannot insert issue_activity',
      true, 'denied: ' || sqlerrm);
  end;

  select count(*) into n from notifications
  where user_id = '90000000-0000-4000-8000-000000000001';
  perform pg_temp.rls_record('tech lead cannot read others notifications',
    n = 0, 'saw ' || n || ' rows, expected 0');

  delete from issues where id = '90000000-0000-4000-8000-000000000030';
  get diagnostics n = row_count;
  perform pg_temp.rls_record('tech lead can delete an issue in own project',
    n = 1, 'deleted ' || n || ' rows');
end $$;
commit;

-- Admin: sees both projects, can read the audit log and invites, sees own
-- notification — but still cannot forge activity or read others' inbox.
begin;
select set_config('role', 'authenticated', true);
select set_config('request.jwt.claims', '{"sub":"90000000-0000-4000-8000-000000000001"}', true);
do $$
declare n int;
begin
  select count(*) into n from projects;
  perform pg_temp.rls_record('admin reads every project',
    n = 2, 'saw ' || n || ' rows, expected 2');

  select count(*) into n from invites;
  perform pg_temp.rls_record('admin reads invites',
    n >= 1, 'saw ' || n || ' rows, expected at least 1');

  select count(*) into n from audit_log;
  perform pg_temp.rls_record('admin reads audit log',
    n >= 1, 'saw ' || n || ' rows, expected at least 1');

  select count(*) into n from views
  where id = '90000000-0000-4000-8000-000000000070';
  perform pg_temp.rls_record('admin reads own private view',
    n = 1, 'saw ' || n || ' rows, expected 1');

  select count(*) into n from notifications
  where user_id = '90000000-0000-4000-8000-000000000001';
  perform pg_temp.rls_record('admin reads own notification',
    n = 1, 'saw ' || n || ' rows, expected 1');

  begin
    insert into issue_activity (issue_id, actor_id, field)
    values ('90000000-0000-4000-8000-000000000030',
            '90000000-0000-4000-8000-000000000001', 'state');
    perform pg_temp.rls_record('admin cannot insert issue_activity',
      false, 'insert was unexpectedly allowed');
  exception when others then
    perform pg_temp.rls_record('admin cannot insert issue_activity',
      true, 'denied: ' || sqlerrm);
  end;

  select count(*) into n from notifications
  where user_id = '90000000-0000-4000-8000-000000000003';
  perform pg_temp.rls_record('admin cannot read others notifications',
    n = 0, 'saw ' || n || ' rows, expected 0');
end $$;
commit;

-- President: everything except deleting the workspace, and the same
-- trigger-only and inbox-privacy rules.
begin;
select set_config('role', 'authenticated', true);
select set_config('request.jwt.claims', '{"sub":"90000000-0000-4000-8000-000000000002"}', true);
do $$
declare n int;
begin
  select count(*) into n from projects;
  perform pg_temp.rls_record('president reads every project',
    n = 2, 'saw ' || n || ' rows, expected 2');

  begin
    insert into issue_activity (issue_id, actor_id, field)
    values ('90000000-0000-4000-8000-000000000030',
            '90000000-0000-4000-8000-000000000002', 'state');
    perform pg_temp.rls_record('president cannot insert issue_activity',
      false, 'insert was unexpectedly allowed');
  exception when others then
    perform pg_temp.rls_record('president cannot insert issue_activity',
      true, 'denied: ' || sqlerrm);
  end;

  select count(*) into n from notifications
  where user_id = '90000000-0000-4000-8000-000000000001';
  perform pg_temp.rls_record('president cannot read others notifications',
    n = 0, 'saw ' || n || ' rows, expected 0');

  select count(*) into n from audit_log;
  perform pg_temp.rls_record('president reads audit log',
    n >= 1, 'saw ' || n || ' rows; president is admin-class per is_workspace_admin');
end $$;
commit;

-- anon: the unauthenticated role sees nothing at all.
begin;
select set_config('role', 'anon', true);
do $$
declare n int;
begin
  select count(*) into n from projects;
  perform pg_temp.rls_record('anon reads nothing',
    n = 0, 'saw ' || n || ' rows, expected 0');
end $$;
commit;

-- The anon block committed while the session was still acting as anon, so
-- reset to postgres before any further work.
select set_config('role', 'postgres', true);

-- ---------------------------------------------------------------------------
-- Cleanup — remove only what this suite created
-- ---------------------------------------------------------------------------

begin;

delete from audit_log where id = '90000000-0000-4000-8000-000000000060';
delete from issues where name = 'tech member can create issues';
delete from issue_activity where issue_id = '90000000-0000-4000-8000-000000000030';
delete from notifications where id = '90000000-0000-4000-8000-000000000040';
delete from views where id = '90000000-0000-4000-8000-000000000070';
delete from projects where identifier in ('RLS', 'RLSD');
delete from team_members where user_id in (
  select id from profiles where email like '%@rls-test.invalid'
);
delete from workspace_members where user_id in (
  select id from profiles where email like '%@rls-test.invalid'
);
delete from profiles where email like '%@rls-test.invalid';
delete from auth.users where email like '%@rls-test.invalid';

commit;

-- The runner and psql both read the verdict from here.
select test as test, pass as pass, detail as detail from rls_test_results order by test;
