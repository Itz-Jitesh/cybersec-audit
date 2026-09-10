-- supabase/tests/team-members.sql
-- Assertions for the team membership management UI.
--
-- What this suite is, stated plainly: the application reads and writes through
-- Drizzle as `postgres`, which has BYPASSRLS, so these policies do not
-- constrain the server actions. `assertCan(user, { kind: "team.manage" })` is
-- what constrains them, and its SQL twin `is_team_lead` is the predicate below.
-- Asserting the policies proves the rule the actions implement is the right
-- one and that the Supabase-client path is closed; it does not prove the
-- TypeScript calls it. The last two blocks cover the two database facts the
-- actions actually depend on: the unique constraint behind ALREADY_MEMBER, and
-- that a team may hold more than one lead.
--
-- Every block commits rather than rolls back: the verdict is recorded by the
-- transaction making the assertion, so a rollback discards the answer.

create temp table if not exists team_member_test_results (
  test text primary key,
  pass boolean not null,
  detail text
) on commit preserve rows;

truncate team_member_test_results;

create or replace function pg_temp.tm_record(p_test text, p_pass boolean, p_detail text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into team_member_test_results (test, pass, detail)
  values (p_test, p_pass, p_detail)
  on conflict (test) do update set pass = excluded.pass, detail = excluded.detail;
end;
$$;

-- ---------------------------------------------------------------------------
-- Fixtures: two teams, an admin, a lead and a plain member on Alpha, and a
-- lead on Beta who must not be able to touch Alpha.
-- ---------------------------------------------------------------------------
begin;

delete from team_members where user_id in (
  select id from profiles where email like '%@tm-test.invalid'
);
delete from workspace_members where user_id in (
  select id from profiles where email like '%@tm-test.invalid'
);
delete from profiles where email like '%@tm-test.invalid';
delete from auth.users where email like '%@tm-test.invalid';
delete from invites where email::text like '%@tm-test.invalid';
delete from teams where slug in ('tm-test-alpha', 'tm-test-beta');

insert into teams (id, name, slug, color) values
  ('96000000-0000-4000-8000-000000000010', 'TM Alpha', 'tm-test-alpha', '#3f76ff'),
  ('96000000-0000-4000-8000-000000000011', 'TM Beta', 'tm-test-beta', '#3f76ff');

insert into invites (email, role, expires_at) values
  ('boss@tm-test.invalid', 'admin', now() + interval '1 day'),
  ('lead@tm-test.invalid', 'member', now() + interval '1 day'),
  ('plain@tm-test.invalid', 'member', now() + interval '1 day'),
  ('other@tm-test.invalid', 'member', now() + interval '1 day'),
  ('spare@tm-test.invalid', 'member', now() + interval '1 day');

insert into auth.users (id, email, encrypted_password, raw_user_meta_data) values
  ('96000000-0000-4000-8000-000000000001', 'boss@tm-test.invalid', '', '{"full_name":"TM Boss"}'::jsonb),
  ('96000000-0000-4000-8000-000000000002', 'lead@tm-test.invalid', '', '{"full_name":"TM Lead"}'::jsonb),
  ('96000000-0000-4000-8000-000000000003', 'plain@tm-test.invalid', '', '{"full_name":"TM Plain"}'::jsonb),
  ('96000000-0000-4000-8000-000000000004', 'other@tm-test.invalid', '', '{"full_name":"TM Other"}'::jsonb),
  ('96000000-0000-4000-8000-000000000005', 'spare@tm-test.invalid', '', '{"full_name":"TM Spare"}'::jsonb);

insert into team_members (team_id, user_id, role) values
  ('96000000-0000-4000-8000-000000000010', '96000000-0000-4000-8000-000000000002', 'lead'),
  ('96000000-0000-4000-8000-000000000010', '96000000-0000-4000-8000-000000000003', 'member'),
  ('96000000-0000-4000-8000-000000000011', '96000000-0000-4000-8000-000000000004', 'lead');

commit;

-- ---------------------------------------------------------------------------
-- 1. A plain member of the team can read the roster but change nothing.
-- ---------------------------------------------------------------------------
begin;
select set_config('role', 'authenticated', true);
select set_config('request.jwt.claims', '{"sub":"96000000-0000-4000-8000-000000000003"}', true);
do $$
declare n int; failed boolean := false;
begin
  select count(*) into n from team_members
  where team_id = '96000000-0000-4000-8000-000000000010';
  perform pg_temp.tm_record('a plain member reads the roster',
    n = 2, 'saw ' || n || ' rows, expected 2');

  begin
    insert into team_members (team_id, user_id, role)
    values ('96000000-0000-4000-8000-000000000010',
            '96000000-0000-4000-8000-000000000005', 'member');
  exception when insufficient_privilege or check_violation then
    failed := true;
  end;
  perform pg_temp.tm_record('a plain member cannot add anyone',
    failed, case when failed then 'insert refused' else 'insert was accepted' end);

  update team_members set role = 'lead'
  where team_id = '96000000-0000-4000-8000-000000000010'
    and user_id = '96000000-0000-4000-8000-000000000003';
  get diagnostics n = row_count;
  perform pg_temp.tm_record('a plain member cannot promote themselves',
    n = 0, 'updated ' || n || ' rows, expected 0');

  delete from team_members
  where team_id = '96000000-0000-4000-8000-000000000010'
    and user_id = '96000000-0000-4000-8000-000000000002';
  get diagnostics n = row_count;
  perform pg_temp.tm_record('a plain member cannot remove the lead',
    n = 0, 'deleted ' || n || ' rows, expected 0');
end $$;
commit;

-- ---------------------------------------------------------------------------
-- 2. The lead of another team is an outsider here. This is the cross-team
--    case the UI cannot enforce: nothing stops a crafted request carrying
--    a different team id.
-- ---------------------------------------------------------------------------
begin;
select set_config('role', 'authenticated', true);
select set_config('request.jwt.claims', '{"sub":"96000000-0000-4000-8000-000000000004"}', true);
do $$
declare n int; failed boolean := false;
begin
  begin
    insert into team_members (team_id, user_id, role)
    values ('96000000-0000-4000-8000-000000000010',
            '96000000-0000-4000-8000-000000000005', 'member');
  exception when insufficient_privilege or check_violation then
    failed := true;
  end;
  perform pg_temp.tm_record('another team''s lead cannot add to this team',
    failed, case when failed then 'insert refused' else 'insert was accepted' end);

  update team_members set role = 'member'
  where team_id = '96000000-0000-4000-8000-000000000010'
    and user_id = '96000000-0000-4000-8000-000000000002';
  get diagnostics n = row_count;
  perform pg_temp.tm_record('another team''s lead cannot demote this team''s lead',
    n = 0, 'updated ' || n || ' rows, expected 0');

  delete from team_members
  where team_id = '96000000-0000-4000-8000-000000000010'
    and user_id = '96000000-0000-4000-8000-000000000003';
  get diagnostics n = row_count;
  perform pg_temp.tm_record('another team''s lead cannot remove this team''s member',
    n = 0, 'deleted ' || n || ' rows, expected 0');
end $$;
commit;

-- ---------------------------------------------------------------------------
-- 3. The team's own lead can add, promote and remove.
-- ---------------------------------------------------------------------------
begin;
select set_config('role', 'authenticated', true);
select set_config('request.jwt.claims', '{"sub":"96000000-0000-4000-8000-000000000002"}', true);
do $$
declare n int;
begin
  insert into team_members (team_id, user_id, role)
  values ('96000000-0000-4000-8000-000000000010',
          '96000000-0000-4000-8000-000000000005', 'member');
  get diagnostics n = row_count;
  perform pg_temp.tm_record('the team lead adds a member',
    n = 1, 'inserted ' || n || ' rows, expected 1');

  update team_members set role = 'lead'
  where team_id = '96000000-0000-4000-8000-000000000010'
    and user_id = '96000000-0000-4000-8000-000000000005';
  get diagnostics n = row_count;
  perform pg_temp.tm_record('the team lead promotes a member to lead',
    n = 1, 'updated ' || n || ' rows, expected 1');

  -- Two leads now. setTeamRole deliberately enforces no single-lead rule, and
  -- neither does the schema.
  select count(*) into n from team_members
  where team_id = '96000000-0000-4000-8000-000000000010' and role = 'lead';
  perform pg_temp.tm_record('a team may hold more than one lead',
    n = 2, 'saw ' || n || ' leads, expected 2');

  delete from team_members
  where team_id = '96000000-0000-4000-8000-000000000010'
    and user_id = '96000000-0000-4000-8000-000000000005';
  get diagnostics n = row_count;
  perform pg_temp.tm_record('the team lead removes a member',
    n = 1, 'deleted ' || n || ' rows, expected 1');
end $$;
commit;

-- ---------------------------------------------------------------------------
-- 4. A workspace admin manages a team they do not belong to.
-- ---------------------------------------------------------------------------
begin;
select set_config('role', 'authenticated', true);
select set_config('request.jwt.claims', '{"sub":"96000000-0000-4000-8000-000000000001"}', true);
do $$
declare n int;
begin
  insert into team_members (team_id, user_id, role)
  values ('96000000-0000-4000-8000-000000000010',
          '96000000-0000-4000-8000-000000000005', 'member');
  get diagnostics n = row_count;
  perform pg_temp.tm_record('a workspace admin adds to a team they are not on',
    n = 1, 'inserted ' || n || ' rows, expected 1');

  delete from team_members
  where team_id = '96000000-0000-4000-8000-000000000010'
    and user_id = '96000000-0000-4000-8000-000000000005';
  get diagnostics n = row_count;
  perform pg_temp.tm_record('a workspace admin removes from that team',
    n = 1, 'deleted ' || n || ' rows, expected 1');
end $$;
commit;

-- ---------------------------------------------------------------------------
-- 5. The unique constraint behind ALREADY_MEMBER. addTeamMember relies on the
--    database refusing the duplicate rather than on a prior read, because two
--    admins adding the same person at once would both pass a read.
-- ---------------------------------------------------------------------------
begin;
select set_config('role', 'postgres', true);
select set_config('request.jwt.claims', '', true);
do $$
declare n int; failed boolean := false;
begin
  begin
    insert into team_members (team_id, user_id, role)
    values ('96000000-0000-4000-8000-000000000010',
            '96000000-0000-4000-8000-000000000003', 'member');
  exception when unique_violation then
    failed := true;
  end;
  perform pg_temp.tm_record('a duplicate membership is refused by the constraint',
    failed, case when failed then 'unique violation raised' else 'duplicate was accepted' end);

  -- on conflict do nothing is the form the action uses: no error, no row, so
  -- an empty returning() is what reports ALREADY_MEMBER.
  insert into team_members (team_id, user_id, role)
  values ('96000000-0000-4000-8000-000000000010',
          '96000000-0000-4000-8000-000000000003', 'member')
  on conflict do nothing;
  get diagnostics n = row_count;
  perform pg_temp.tm_record('on conflict do nothing returns no row for a duplicate',
    n = 0, 'inserted ' || n || ' rows, expected 0');
end $$;
commit;

-- ---------------------------------------------------------------------------
-- Cleanup
-- ---------------------------------------------------------------------------
begin;
select set_config('role', 'postgres', true);
select set_config('request.jwt.claims', '', true);
delete from team_members where user_id in (
  select id from profiles where email like '%@tm-test.invalid'
);
delete from workspace_members where user_id in (
  select id from profiles where email like '%@tm-test.invalid'
);
delete from profiles where email like '%@tm-test.invalid';
delete from auth.users where email like '%@tm-test.invalid';
delete from invites where email::text like '%@tm-test.invalid';
delete from teams where slug in ('tm-test-alpha', 'tm-test-beta');
commit;

select test as test, pass as pass, detail as detail from team_member_test_results order by test;
