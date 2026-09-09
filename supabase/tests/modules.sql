-- supabase/tests/modules.sql
-- Assertions for phase 10: the cycle and module access matrix from
-- docs/04-DATA-MODEL.md §10, plus the two invariants the application relies on
-- (a module's issues stay inside its own project; a cycle is visible only to
-- the project's members).
--
-- Every block commits rather than rolls back, for the same reason views.sql
-- gives: the verdict is written to a temp table by the transaction making the
-- assertion, so a rollback discards the answer along with the attempt.
--
-- Fixtures are self-contained — this suite provisions its own two teams, two
-- projects and three members through the invite gate, so it runs in any order
-- and cleans up after itself.

create temp table if not exists module_test_results (
  test text primary key,
  pass boolean not null,
  detail text
) on commit preserve rows;

truncate module_test_results;

create or replace function pg_temp.module_record(p_test text, p_pass boolean, p_detail text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into module_test_results (test, pass, detail)
  values (p_test, p_pass, p_detail)
  on conflict (test) do update set pass = excluded.pass, detail = excluded.detail;
end;
$$;

-- ---------------------------------------------------------------------------
-- Fixtures
-- ---------------------------------------------------------------------------
begin;

delete from module_issues where module_id in (
  '94000000-0000-4000-8000-000000000040',
  '94000000-0000-4000-8000-000000000041'
);
delete from modules where project_id in (
  '94000000-0000-4000-8000-000000000020',
  '94000000-0000-4000-8000-000000000021'
);
delete from cycles where project_id in (
  '94000000-0000-4000-8000-000000000020',
  '94000000-0000-4000-8000-000000000021'
);
delete from issues where project_id in (
  '94000000-0000-4000-8000-000000000020',
  '94000000-0000-4000-8000-000000000021'
);
delete from states where project_id in (
  '94000000-0000-4000-8000-000000000020',
  '94000000-0000-4000-8000-000000000021'
);
delete from projects where identifier in ('MTST', 'MOTH');
delete from team_members where user_id in (
  select id from profiles where email like '%@module-test.invalid'
);
delete from workspace_members where user_id in (
  select id from profiles where email like '%@module-test.invalid'
);
delete from profiles where email like '%@module-test.invalid';
delete from auth.users where email like '%@module-test.invalid';
delete from invites where email::text like '%@module-test.invalid';
delete from teams where slug in ('module-test-team', 'module-test-other');

insert into teams (id, name, slug, color) values
  ('94000000-0000-4000-8000-000000000010', 'Module Test', 'module-test-team', '#3f76ff'),
  ('94000000-0000-4000-8000-000000000011', 'Module Other', 'module-test-other', '#3f76ff');

insert into invites (email, role, expires_at) values
  ('lead@module-test.invalid', 'member', now() + interval '1 day'),
  ('member@module-test.invalid', 'member', now() + interval '1 day'),
  ('outsider@module-test.invalid', 'member', now() + interval '1 day');

insert into auth.users (id, email, encrypted_password, raw_user_meta_data) values
  ('94000000-0000-4000-8000-000000000001', 'lead@module-test.invalid', '', '{"full_name":"Module Lead"}'::jsonb),
  ('94000000-0000-4000-8000-000000000002', 'member@module-test.invalid', '', '{"full_name":"Module Member"}'::jsonb),
  ('94000000-0000-4000-8000-000000000003', 'outsider@module-test.invalid', '', '{"full_name":"Module Outsider"}'::jsonb);

insert into team_members (team_id, user_id, role) values
  ('94000000-0000-4000-8000-000000000010', '94000000-0000-4000-8000-000000000001', 'lead'),
  ('94000000-0000-4000-8000-000000000010', '94000000-0000-4000-8000-000000000002', 'member'),
  ('94000000-0000-4000-8000-000000000011', '94000000-0000-4000-8000-000000000003', 'member');

insert into projects (id, team_id, name, identifier, created_by) values
  ('94000000-0000-4000-8000-000000000020', '94000000-0000-4000-8000-000000000010',
   'Module Test Project', 'MTST', '94000000-0000-4000-8000-000000000001'),
  ('94000000-0000-4000-8000-000000000021', '94000000-0000-4000-8000-000000000011',
   'Module Other Project', 'MOTH', '94000000-0000-4000-8000-000000000003');

insert into states (id, project_id, name, "group", color, sequence, is_default) values
  ('94000000-0000-4000-8000-000000000030', '94000000-0000-4000-8000-000000000020',
   'Todo', 'unstarted', '#9ca3af', 1000, true),
  ('94000000-0000-4000-8000-000000000031', '94000000-0000-4000-8000-000000000021',
   'Todo', 'unstarted', '#9ca3af', 1000, true);

insert into issues (id, project_id, state_id, name, sort_order, created_by) values
  ('94000000-0000-4000-8000-000000000050', '94000000-0000-4000-8000-000000000020',
   '94000000-0000-4000-8000-000000000030', 'Module fixture issue', 1000,
   '94000000-0000-4000-8000-000000000001'),
  ('94000000-0000-4000-8000-000000000051', '94000000-0000-4000-8000-000000000021',
   '94000000-0000-4000-8000-000000000031', 'Other project issue', 1000,
   '94000000-0000-4000-8000-000000000003');

insert into modules (id, project_id, name, status, sort_order, created_by) values
  ('94000000-0000-4000-8000-000000000040', '94000000-0000-4000-8000-000000000020',
   'Test module', 'planned', 1000, '94000000-0000-4000-8000-000000000001'),
  ('94000000-0000-4000-8000-000000000041', '94000000-0000-4000-8000-000000000021',
   'Other module', 'planned', 1000, '94000000-0000-4000-8000-000000000003');

insert into cycles (id, project_id, name, start_date, end_date, created_by) values
  ('94000000-0000-4000-8000-000000000060', '94000000-0000-4000-8000-000000000020',
   'Test cycle', current_date, current_date + 14, '94000000-0000-4000-8000-000000000001');

commit;

-- ---------------------------------------------------------------------------
-- 1. A project member reads their own project's module.
-- ---------------------------------------------------------------------------
begin;
select set_config('role', 'authenticated', true);
select set_config('request.jwt.claims', '{"sub":"94000000-0000-4000-8000-000000000002"}', true);
do $$
declare n int;
begin
  select count(*) into n from modules
  where id = '94000000-0000-4000-8000-000000000040';
  perform pg_temp.module_record('member reads own project module',
    n = 1, 'saw ' || n || ' rows, expected 1');

  select count(*) into n from modules
  where id = '94000000-0000-4000-8000-000000000041';
  perform pg_temp.module_record('member cannot read another team module',
    n = 0, 'saw ' || n || ' rows, expected 0');

  select count(*) into n from cycles
  where id = '94000000-0000-4000-8000-000000000060';
  perform pg_temp.module_record('member reads own project cycle',
    n = 1, 'saw ' || n || ' rows, expected 1');
end $$;
commit;

-- ---------------------------------------------------------------------------
-- 2. An outsider sees neither the module nor the cycle.
-- ---------------------------------------------------------------------------
begin;
select set_config('role', 'authenticated', true);
select set_config('request.jwt.claims', '{"sub":"94000000-0000-4000-8000-000000000003"}', true);
do $$
declare n int;
begin
  select count(*) into n from modules
  where id = '94000000-0000-4000-8000-000000000040';
  perform pg_temp.module_record('outsider cannot read the module',
    n = 0, 'saw ' || n || ' rows, expected 0');

  select count(*) into n from cycles
  where id = '94000000-0000-4000-8000-000000000060';
  perform pg_temp.module_record('outsider cannot read the cycle',
    n = 0, 'saw ' || n || ' rows, expected 0');
end $$;
commit;

-- ---------------------------------------------------------------------------
-- 3. An outsider cannot create a module in someone else's project.
-- ---------------------------------------------------------------------------
begin;
select set_config('role', 'authenticated', true);
select set_config('request.jwt.claims', '{"sub":"94000000-0000-4000-8000-000000000003"}', true);
do $$
declare failed boolean := false;
begin
  begin
    insert into modules (project_id, name, status, sort_order, created_by)
    values ('94000000-0000-4000-8000-000000000020', 'Smuggled module', 'planned',
            2000, '94000000-0000-4000-8000-000000000003');
  exception when insufficient_privilege or check_violation then
    failed := true;
  end;
  perform pg_temp.module_record('outsider cannot create a module in another project',
    failed, case when failed then 'insert refused' else 'insert was accepted' end);
end $$;
commit;

-- ---------------------------------------------------------------------------
-- 4. An outsider cannot attach their own issue to someone else's module.
-- ---------------------------------------------------------------------------
begin;
select set_config('role', 'authenticated', true);
select set_config('request.jwt.claims', '{"sub":"94000000-0000-4000-8000-000000000003"}', true);
do $$
declare failed boolean := false;
begin
  begin
    insert into module_issues (module_id, issue_id)
    values ('94000000-0000-4000-8000-000000000040',
            '94000000-0000-4000-8000-000000000051');
  exception when insufficient_privilege or check_violation or foreign_key_violation then
    failed := true;
  end;
  perform pg_temp.module_record('outsider cannot attach an issue to another project module',
    failed, case when failed then 'insert refused' else 'insert was accepted' end);
end $$;
commit;

-- ---------------------------------------------------------------------------
-- 5. A project member can attach and detach an issue in their own module.
-- ---------------------------------------------------------------------------
begin;
select set_config('role', 'authenticated', true);
select set_config('request.jwt.claims', '{"sub":"94000000-0000-4000-8000-000000000002"}', true);
do $$
declare n int;
begin
  insert into module_issues (module_id, issue_id)
  values ('94000000-0000-4000-8000-000000000040',
          '94000000-0000-4000-8000-000000000050')
  on conflict do nothing;

  select count(*) into n from module_issues
  where module_id = '94000000-0000-4000-8000-000000000040';
  perform pg_temp.module_record('member attaches an issue to own module',
    n = 1, 'saw ' || n || ' rows, expected 1');

  delete from module_issues
  where module_id = '94000000-0000-4000-8000-000000000040'
    and issue_id = '94000000-0000-4000-8000-000000000050';

  select count(*) into n from module_issues
  where module_id = '94000000-0000-4000-8000-000000000040';
  perform pg_temp.module_record('member detaches an issue from own module',
    n = 0, 'saw ' || n || ' rows, expected 0');
end $$;
commit;

-- ---------------------------------------------------------------------------
-- 6. A plain member cannot delete a module; the team lead can.
-- ---------------------------------------------------------------------------
begin;
select set_config('role', 'authenticated', true);
select set_config('request.jwt.claims', '{"sub":"94000000-0000-4000-8000-000000000002"}', true);
do $$
declare n int;
begin
  with removed as (
    delete from modules where id = '94000000-0000-4000-8000-000000000040'
    returning 1
  )
  select count(*) into n from removed;
  perform pg_temp.module_record('plain member cannot delete a module',
    n = 0, 'deleted ' || n || ' rows, expected 0');
end $$;
commit;

begin;
select set_config('role', 'authenticated', true);
select set_config('request.jwt.claims', '{"sub":"94000000-0000-4000-8000-000000000001"}', true);
do $$
declare n int;
begin
  with removed as (
    delete from modules where id = '94000000-0000-4000-8000-000000000040'
    returning 1
  )
  select count(*) into n from removed;
  perform pg_temp.module_record('team lead deletes a module',
    n = 1, 'deleted ' || n || ' rows, expected 1');
end $$;
commit;

-- ---------------------------------------------------------------------------
-- Cleanup
-- ---------------------------------------------------------------------------
begin;
select set_config('role', 'postgres', true);
select set_config('request.jwt.claims', '', true);
delete from module_issues where module_id in (
  '94000000-0000-4000-8000-000000000040',
  '94000000-0000-4000-8000-000000000041'
);
delete from modules where project_id in (
  '94000000-0000-4000-8000-000000000020',
  '94000000-0000-4000-8000-000000000021'
);
delete from cycles where project_id in (
  '94000000-0000-4000-8000-000000000020',
  '94000000-0000-4000-8000-000000000021'
);
delete from issues where project_id in (
  '94000000-0000-4000-8000-000000000020',
  '94000000-0000-4000-8000-000000000021'
);
delete from states where project_id in (
  '94000000-0000-4000-8000-000000000020',
  '94000000-0000-4000-8000-000000000021'
);
delete from projects where identifier in ('MTST', 'MOTH');
delete from team_members where user_id in (
  select id from profiles where email like '%@module-test.invalid'
);
delete from workspace_members where user_id in (
  select id from profiles where email like '%@module-test.invalid'
);
delete from profiles where email like '%@module-test.invalid';
delete from auth.users where email like '%@module-test.invalid';
delete from invites where email::text like '%@module-test.invalid';
delete from teams where slug in ('module-test-team', 'module-test-other');
commit;

select test as test, pass as pass, detail as detail from module_test_results order by test;
