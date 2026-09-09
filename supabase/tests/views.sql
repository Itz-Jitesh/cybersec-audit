-- supabase/tests/views.sql
-- Assertions for phase 9: the saved-view access matrix from
-- docs/04-DATA-MODEL.md §9.
--
-- Every block commits rather than rolls back. The verdict is recorded into a
-- temp table by the same transaction that made the assertion, so a rollback
-- would discard the answer along with the attempt — which reads as a silently
-- missing test rather than a failing one. Committing is safe here because the
-- mutations under test are the ones the policies refuse, and the two that do
-- change data clean up after themselves.
--
-- A view is a stored query and its access column is the only thing standing
-- between a private filter set and everyone on the project. That makes it worth
-- asserting through the policies rather than trusting the action alone — the
-- action is one of the two enforcement paths, and this is the other.
--
-- Fixtures are self-contained: this suite provisions its own team, project and
-- three members rather than borrowing rls.sql's, which deletes them again at
-- the end of its own run.

create temp table if not exists view_test_results (
  test text primary key,
  pass boolean not null,
  detail text
) on commit preserve rows;

truncate view_test_results;

create or replace function pg_temp.view_record(p_test text, p_pass boolean, p_detail text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into view_test_results (test, pass, detail)
  values (p_test, p_pass, p_detail)
  on conflict (test) do update set pass = excluded.pass, detail = excluded.detail;
end;
$$;

-- ---------------------------------------------------------------------------
-- Fixtures
-- ---------------------------------------------------------------------------
-- Three members: the lead of the project's team, another member of it, and a
-- member of a different team. None is a workspace admin, since an admin sees
-- everything and would make every assertion below vacuous.
--
-- Users are provisioned through invites, the way handle_new_user requires, so
-- the fixture is one the application could actually have produced.

begin;

delete from views where id in (
  '93000000-0000-4000-8000-000000000030',
  '93000000-0000-4000-8000-000000000031',
  '93000000-0000-4000-8000-000000000032'
);
delete from projects where identifier = 'VTST';
delete from team_members where user_id in (
  select id from profiles where email like '%@view-test.invalid'
);
delete from workspace_members where user_id in (
  select id from profiles where email like '%@view-test.invalid'
);
delete from profiles where email like '%@view-test.invalid';
delete from auth.users where email like '%@view-test.invalid';
delete from invites where email::text like '%@view-test.invalid';
delete from teams where slug in ('view-test-team', 'view-test-other');

insert into teams (id, name, slug, color) values
  ('93000000-0000-4000-8000-000000000010', 'View Test', 'view-test-team', '#3f76ff'),
  ('93000000-0000-4000-8000-000000000011', 'View Test Other', 'view-test-other', '#3f76ff');

insert into invites (email, role, expires_at) values
  ('lead@view-test.invalid', 'member', now() + interval '1 day'),
  ('member@view-test.invalid', 'member', now() + interval '1 day'),
  ('outsider@view-test.invalid', 'member', now() + interval '1 day');

insert into auth.users (id, email, encrypted_password, raw_user_meta_data) values
  ('93000000-0000-4000-8000-000000000001', 'lead@view-test.invalid', '', '{"full_name":"View Lead"}'::jsonb),
  ('93000000-0000-4000-8000-000000000002', 'member@view-test.invalid', '', '{"full_name":"View Member"}'::jsonb),
  ('93000000-0000-4000-8000-000000000003', 'outsider@view-test.invalid', '', '{"full_name":"View Outsider"}'::jsonb);

insert into team_members (team_id, user_id, role) values
  ('93000000-0000-4000-8000-000000000010', '93000000-0000-4000-8000-000000000001', 'lead'),
  ('93000000-0000-4000-8000-000000000010', '93000000-0000-4000-8000-000000000002', 'member'),
  ('93000000-0000-4000-8000-000000000011', '93000000-0000-4000-8000-000000000003', 'member');

insert into projects (id, team_id, name, identifier, created_by)
values ('93000000-0000-4000-8000-000000000020',
        '93000000-0000-4000-8000-000000000010',
        'View Test Project', 'VTST',
        '93000000-0000-4000-8000-000000000001');

-- One private and one public view, both owned by the lead.
insert into views (id, project_id, name, filters, display_props, layout, access, owner_id, created_by)
values
  ('93000000-0000-4000-8000-000000000030',
   '93000000-0000-4000-8000-000000000020',
   'Private view', '{"priorities":["urgent"]}'::jsonb, '{}'::jsonb, 'list', 'private',
   '93000000-0000-4000-8000-000000000001', '93000000-0000-4000-8000-000000000001'),
  ('93000000-0000-4000-8000-000000000031',
   '93000000-0000-4000-8000-000000000020',
   'Public view', '{}'::jsonb, '{}'::jsonb, 'kanban', 'public',
   '93000000-0000-4000-8000-000000000001', '93000000-0000-4000-8000-000000000001');

commit;

-- ---------------------------------------------------------------------------
-- 1. The owner sees their own private view.
-- ---------------------------------------------------------------------------
begin;
select set_config('role', 'authenticated', true);
select set_config('request.jwt.claims', '{"sub":"93000000-0000-4000-8000-000000000001"}', true);
do $$
declare n int;
begin
  select count(*) into n from views
  where id = '93000000-0000-4000-8000-000000000030';
  perform pg_temp.view_record('owner reads own private view',
    n = 1, 'saw ' || n || ' rows, expected 1');
end $$;
commit;

-- ---------------------------------------------------------------------------
-- 2. Another project member must NOT see it. This is the whole point of the
--    private setting.
-- ---------------------------------------------------------------------------
begin;
select set_config('role', 'authenticated', true);
select set_config('request.jwt.claims', '{"sub":"93000000-0000-4000-8000-000000000002"}', true);
do $$
declare n int;
begin
  select count(*) into n from views
  where id = '93000000-0000-4000-8000-000000000030';
  perform pg_temp.view_record('project member cannot read another private view',
    n = 0, 'saw ' || n || ' rows, expected 0');
end $$;
commit;

-- ---------------------------------------------------------------------------
-- 3. That same member does see the public one.
-- ---------------------------------------------------------------------------
begin;
select set_config('role', 'authenticated', true);
select set_config('request.jwt.claims', '{"sub":"93000000-0000-4000-8000-000000000002"}', true);
do $$
declare n int;
begin
  select count(*) into n from views
  where id = '93000000-0000-4000-8000-000000000031';
  perform pg_temp.view_record('project member reads public view',
    n = 1, 'saw ' || n || ' rows, expected 1');
end $$;
commit;

-- ---------------------------------------------------------------------------
-- 4. A member of another team must not see the public one either. Public means
--    public to the project, not to the workspace.
-- ---------------------------------------------------------------------------
begin;
select set_config('role', 'authenticated', true);
select set_config('request.jwt.claims', '{"sub":"93000000-0000-4000-8000-000000000003"}', true);
do $$
declare n int;
begin
  select count(*) into n from views
  where id = '93000000-0000-4000-8000-000000000031';
  perform pg_temp.view_record('outside member cannot read public view',
    n = 0, 'saw ' || n || ' rows, expected 0');
end $$;
commit;

-- ---------------------------------------------------------------------------
-- 5. A non-owner must not edit a public view. Reading it is not editing it.
-- ---------------------------------------------------------------------------
begin;
select set_config('role', 'authenticated', true);
select set_config('request.jwt.claims', '{"sub":"93000000-0000-4000-8000-000000000002"}', true);
do $$
declare n int;
begin
  update views set name = 'Hijacked'
  where id = '93000000-0000-4000-8000-000000000031';
  get diagnostics n = row_count;
  perform pg_temp.view_record('non-owner cannot edit public view',
    n = 0, 'updated ' || n || ' rows, expected 0');
end $$;
commit;

-- ---------------------------------------------------------------------------
-- 6. A non-owner who cannot manage the project must not delete it.
-- ---------------------------------------------------------------------------
begin;
select set_config('role', 'authenticated', true);
select set_config('request.jwt.claims', '{"sub":"93000000-0000-4000-8000-000000000002"}', true);
do $$
declare n int;
begin
  delete from views where id = '93000000-0000-4000-8000-000000000031';
  get diagnostics n = row_count;
  perform pg_temp.view_record('non-owner cannot delete public view',
    n = 0, 'deleted ' || n || ' rows, expected 0');
end $$;
commit;

-- ---------------------------------------------------------------------------
-- 7. The team lead, who can manage the project, may delete a view they do not
--    own. Moderation is a real power and has to be asserted as one.
-- ---------------------------------------------------------------------------
begin;

insert into views (id, project_id, name, filters, display_props, layout, access, owner_id, created_by)
values ('93000000-0000-4000-8000-000000000032',
        '93000000-0000-4000-8000-000000000020',
        'Member view', '{}'::jsonb, '{}'::jsonb, 'list', 'public',
        '93000000-0000-4000-8000-000000000002', '93000000-0000-4000-8000-000000000002');

select set_config('role', 'authenticated', true);
select set_config('request.jwt.claims', '{"sub":"93000000-0000-4000-8000-000000000001"}', true);
do $$
declare n int;
begin
  delete from views where id = '93000000-0000-4000-8000-000000000032';
  get diagnostics n = row_count;
  perform pg_temp.view_record('project manager deletes another members view',
    n = 1, 'deleted ' || n || ' rows, expected 1');
end $$;
commit;

-- ---------------------------------------------------------------------------
-- 8. A member cannot create a view in a project they are not in. Insert is
--    where a stored query in someone else's project would come from.
-- ---------------------------------------------------------------------------
begin;
select set_config('role', 'authenticated', true);
select set_config('request.jwt.claims', '{"sub":"93000000-0000-4000-8000-000000000003"}', true);
do $$
declare failed boolean := false;
begin
  begin
    insert into views (project_id, name, filters, display_props, layout, access, owner_id, created_by)
    values ('93000000-0000-4000-8000-000000000020', 'Intruder',
            '{}'::jsonb, '{}'::jsonb, 'list', 'public',
            '93000000-0000-4000-8000-000000000003',
            '93000000-0000-4000-8000-000000000003');
  exception when insufficient_privilege or check_violation then
    failed := true;
  end;
  perform pg_temp.view_record('outside member cannot create a view in the project',
    failed, case when failed then 'insert refused' else 'insert was accepted' end);
end $$;
commit;

-- ---------------------------------------------------------------------------
-- 9. A view cannot be created under someone else's name. owner_id = auth.uid()
--    in the insert policy is what stops a private view being planted on a
--    person who never made it.
-- ---------------------------------------------------------------------------
begin;
select set_config('role', 'authenticated', true);
select set_config('request.jwt.claims', '{"sub":"93000000-0000-4000-8000-000000000002"}', true);
do $$
declare failed boolean := false;
begin
  begin
    insert into views (project_id, name, filters, display_props, layout, access, owner_id, created_by)
    values ('93000000-0000-4000-8000-000000000020', 'Planted',
            '{}'::jsonb, '{}'::jsonb, 'list', 'private',
            '93000000-0000-4000-8000-000000000001',
            '93000000-0000-4000-8000-000000000002');
  exception when insufficient_privilege or check_violation then
    failed := true;
  end;
  perform pg_temp.view_record('cannot create a view owned by someone else',
    failed, case when failed then 'insert refused' else 'insert was accepted' end);
end $$;
commit;

-- ---------------------------------------------------------------------------
-- Cleanup
-- ---------------------------------------------------------------------------
begin;
select set_config('role', 'postgres', true);
select set_config('request.jwt.claims', '', true);
delete from views where project_id = '93000000-0000-4000-8000-000000000020';
delete from projects where identifier = 'VTST';
delete from team_members where user_id in (
  select id from profiles where email like '%@view-test.invalid'
);
delete from workspace_members where user_id in (
  select id from profiles where email like '%@view-test.invalid'
);
delete from profiles where email like '%@view-test.invalid';
delete from auth.users where email like '%@view-test.invalid';
delete from invites where email::text like '%@view-test.invalid';
delete from teams where slug in ('view-test-team', 'view-test-other');
commit;

select test as test, pass as pass, detail as detail from view_test_results order by test;
