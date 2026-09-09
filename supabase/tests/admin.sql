-- supabase/tests/admin.sql
-- Assertions for phase 11: the admin surface (invites, audit log) and page
-- access, from docs/04-DATA-MODEL.md §10.
--
-- Every block commits rather than rolls back, for the reason views.sql gives:
-- the verdict is recorded by the transaction making the assertion, so a
-- rollback discards the answer along with the attempt.
--
-- Fixtures are self-contained: two teams, one project, an admin, a project
-- member and an outsider, all provisioned through the invite gate.

create temp table if not exists admin_test_results (
  test text primary key,
  pass boolean not null,
  detail text
) on commit preserve rows;

truncate admin_test_results;

create or replace function pg_temp.admin_record(p_test text, p_pass boolean, p_detail text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into admin_test_results (test, pass, detail)
  values (p_test, p_pass, p_detail)
  on conflict (test) do update set pass = excluded.pass, detail = excluded.detail;
end;
$$;

-- ---------------------------------------------------------------------------
-- Fixtures
-- ---------------------------------------------------------------------------
begin;

delete from pages where project_id = '95000000-0000-4000-8000-000000000020';
delete from audit_log where actor_id in (
  select id from profiles where email like '%@admin-test.invalid'
);
delete from projects where identifier = 'ATST';
delete from team_members where user_id in (
  select id from profiles where email like '%@admin-test.invalid'
);
delete from workspace_members where user_id in (
  select id from profiles where email like '%@admin-test.invalid'
);
delete from profiles where email like '%@admin-test.invalid';
delete from auth.users where email like '%@admin-test.invalid';
delete from invites where email::text like '%@admin-test.invalid';
delete from teams where slug in ('admin-test-team', 'admin-test-other');

insert into teams (id, name, slug, color) values
  ('95000000-0000-4000-8000-000000000010', 'Admin Test', 'admin-test-team', '#3f76ff'),
  ('95000000-0000-4000-8000-000000000011', 'Admin Other', 'admin-test-other', '#3f76ff');

insert into invites (email, role, expires_at) values
  ('boss@admin-test.invalid', 'admin', now() + interval '1 day'),
  ('member@admin-test.invalid', 'member', now() + interval '1 day'),
  ('outsider@admin-test.invalid', 'member', now() + interval '1 day');

insert into auth.users (id, email, encrypted_password, raw_user_meta_data) values
  ('95000000-0000-4000-8000-000000000001', 'boss@admin-test.invalid', '', '{"full_name":"Admin Boss"}'::jsonb),
  ('95000000-0000-4000-8000-000000000002', 'member@admin-test.invalid', '', '{"full_name":"Admin Member"}'::jsonb),
  ('95000000-0000-4000-8000-000000000003', 'outsider@admin-test.invalid', '', '{"full_name":"Admin Outsider"}'::jsonb);

insert into team_members (team_id, user_id, role) values
  ('95000000-0000-4000-8000-000000000010', '95000000-0000-4000-8000-000000000002', 'member'),
  ('95000000-0000-4000-8000-000000000011', '95000000-0000-4000-8000-000000000003', 'member');

insert into projects (id, team_id, name, identifier, created_by)
values ('95000000-0000-4000-8000-000000000020',
        '95000000-0000-4000-8000-000000000010',
        'Admin Test Project', 'ATST',
        '95000000-0000-4000-8000-000000000002');

-- One private page owned by the member, one public page on the same project.
insert into pages (id, project_id, title, access, owner_id, created_by) values
  ('95000000-0000-4000-8000-000000000030', '95000000-0000-4000-8000-000000000020',
   'Private notes', 'private',
   '95000000-0000-4000-8000-000000000002', '95000000-0000-4000-8000-000000000002'),
  ('95000000-0000-4000-8000-000000000031', '95000000-0000-4000-8000-000000000020',
   'Shared notes', 'public',
   '95000000-0000-4000-8000-000000000002', '95000000-0000-4000-8000-000000000002');

insert into audit_log (id, actor_id, action, entity_type, entity_id)
values ('95000000-0000-4000-8000-000000000040',
        '95000000-0000-4000-8000-000000000001',
        'invite.sent', 'invite', null);

commit;

-- ---------------------------------------------------------------------------
-- 1. Invites and the audit log are admin-only.
-- ---------------------------------------------------------------------------
begin;
select set_config('role', 'authenticated', true);
select set_config('request.jwt.claims', '{"sub":"95000000-0000-4000-8000-000000000002"}', true);
do $$
declare n int; failed boolean := false;
begin
  select count(*) into n from invites
  where email::text like '%@admin-test.invalid';
  perform pg_temp.admin_record('plain member cannot read invites',
    n = 0, 'saw ' || n || ' rows, expected 0');

  select count(*) into n from audit_log
  where id = '95000000-0000-4000-8000-000000000040';
  perform pg_temp.admin_record('plain member cannot read the audit log',
    n = 0, 'saw ' || n || ' rows, expected 0');

  begin
    insert into invites (email, role, expires_at)
    values ('smuggled@admin-test.invalid', 'admin', now() + interval '1 day');
  exception when insufficient_privilege or check_violation then
    failed := true;
  end;
  perform pg_temp.admin_record('plain member cannot create an invite',
    failed, case when failed then 'insert refused' else 'insert was accepted' end);
end $$;
commit;

-- ---------------------------------------------------------------------------
-- 2. An admin reads both, and cannot forge an audit entry.
-- ---------------------------------------------------------------------------
begin;
select set_config('role', 'authenticated', true);
select set_config('request.jwt.claims', '{"sub":"95000000-0000-4000-8000-000000000001"}', true);
do $$
declare n int; failed boolean := false;
begin
  select count(*) into n from invites
  where email::text like '%@admin-test.invalid';
  perform pg_temp.admin_record('admin reads invites',
    n >= 3, 'saw ' || n || ' rows, expected at least 3');

  select count(*) into n from audit_log
  where id = '95000000-0000-4000-8000-000000000040';
  perform pg_temp.admin_record('admin reads the audit log',
    n = 1, 'saw ' || n || ' rows, expected 1');

  -- audit_log has a select policy and no insert policy at all, so even an
  -- admin cannot write one from a client session. Entries come only from the
  -- server actions, which run as the table owner.
  begin
    insert into audit_log (actor_id, action, entity_type, entity_id)
    values ('95000000-0000-4000-8000-000000000001', 'invite.sent', 'invite', null);
  exception when insufficient_privilege or check_violation then
    failed := true;
  end;
  perform pg_temp.admin_record('admin cannot forge an audit entry',
    failed, case when failed then 'insert refused' else 'insert was accepted' end);
end $$;
commit;

-- ---------------------------------------------------------------------------
-- 3. Page access: private is the owner's alone, public is the project's.
-- ---------------------------------------------------------------------------
begin;
select set_config('role', 'authenticated', true);
select set_config('request.jwt.claims', '{"sub":"95000000-0000-4000-8000-000000000002"}', true);
do $$
declare n int;
begin
  select count(*) into n from pages
  where id = '95000000-0000-4000-8000-000000000030';
  perform pg_temp.admin_record('owner reads own private page',
    n = 1, 'saw ' || n || ' rows, expected 1');
end $$;
commit;

begin;
select set_config('role', 'authenticated', true);
select set_config('request.jwt.claims', '{"sub":"95000000-0000-4000-8000-000000000001"}', true);
do $$
declare n int; failed boolean := false;
begin
  -- The admin is not the owner. A private page is private from admins too:
  -- the select policy names the owner, not the role.
  select count(*) into n from pages
  where id = '95000000-0000-4000-8000-000000000030';
  perform pg_temp.admin_record('non-owner cannot read a private page',
    n = 0, 'saw ' || n || ' rows, expected 0');

  begin
    update pages set title = 'Hijacked'
    where id = '95000000-0000-4000-8000-000000000031';
  exception when insufficient_privilege then
    failed := true;
  end;
  select count(*) into n from pages
  where id = '95000000-0000-4000-8000-000000000031' and title = 'Hijacked';
  perform pg_temp.admin_record('non-owner cannot edit a page',
    n = 0, 'title changed on ' || n || ' rows, expected 0');
end $$;
commit;

-- ---------------------------------------------------------------------------
-- 4. Someone outside the project sees neither page.
-- ---------------------------------------------------------------------------
begin;
select set_config('role', 'authenticated', true);
select set_config('request.jwt.claims', '{"sub":"95000000-0000-4000-8000-000000000003"}', true);
do $$
declare n int;
begin
  select count(*) into n from pages
  where project_id = '95000000-0000-4000-8000-000000000020';
  perform pg_temp.admin_record('outsider cannot read any project page',
    n = 0, 'saw ' || n || ' rows, expected 0');
end $$;
commit;

-- ---------------------------------------------------------------------------
-- Cleanup
-- ---------------------------------------------------------------------------
begin;
select set_config('role', 'postgres', true);
select set_config('request.jwt.claims', '', true);
delete from pages where project_id = '95000000-0000-4000-8000-000000000020';
delete from audit_log where actor_id in (
  select id from profiles where email like '%@admin-test.invalid'
);
delete from projects where identifier = 'ATST';
delete from team_members where user_id in (
  select id from profiles where email like '%@admin-test.invalid'
);
delete from workspace_members where user_id in (
  select id from profiles where email like '%@admin-test.invalid'
);
delete from profiles where email like '%@admin-test.invalid';
delete from auth.users where email like '%@admin-test.invalid';
delete from invites where email::text like '%@admin-test.invalid';
delete from teams where slug in ('admin-test-team', 'admin-test-other');
commit;

select test as test, pass as pass, detail as detail from admin_test_results order by test;
