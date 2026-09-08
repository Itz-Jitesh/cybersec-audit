-- supabase/tests/auth.sql
-- Assertions for the invite gate in supabase/migrations/0006_handle_new_user.sql.
--
-- The gate is the only thing standing between a stranger with a Google account
-- and a seat in this workspace, so it is asserted the same way the RLS matrix
-- is: by doing the thing and checking what the database did about it.
--
-- Every block commits, because the results table is a temp table and a rollback
-- would discard the verdict along with the side effect it was recording.

create temp table if not exists auth_test_results (
  test text primary key,
  pass boolean not null,
  detail text
) on commit preserve rows;

truncate auth_test_results;

-- Parameters are named apart from the columns; plpgsql resolves a bare `test`
-- to the column otherwise and the insert fails as ambiguous.
create or replace function pg_temp.auth_record(p_test text, p_pass boolean, p_detail text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into auth_test_results (test, pass, detail)
  values (p_test, p_pass, p_detail)
  on conflict (test) do update set pass = excluded.pass, detail = excluded.detail;
end;
$$;

-- ---------------------------------------------------------------------------
-- Fixtures
-- ---------------------------------------------------------------------------

begin;

delete from team_members where user_id in (
  select id from profiles where email like '%@auth-test.invalid');
delete from workspace_members where user_id in (
  select id from profiles where email like '%@auth-test.invalid');
delete from profiles where email like '%@auth-test.invalid';
delete from auth.users where email like '%@auth-test.invalid';
delete from invites where email::text like '%@auth-test.invalid';
delete from teams where slug = 'auth-test-team';

insert into teams (id, name, slug, color)
values ('91000000-0000-4000-8000-000000000001',
        'Auth Test Team', 'auth-test-team', '#3f76ff');

-- An open invite carrying a role and a team pre-assignment.
insert into invites (id, email, role, team_id, team_role, expires_at)
values ('91000000-0000-4000-8000-000000000010',
        'invited@auth-test.invalid', 'member',
        '91000000-0000-4000-8000-000000000001', 'lead',
        now() + interval '7 days');

-- An invite that has already lapsed.
insert into invites (id, email, role, expires_at)
values ('91000000-0000-4000-8000-000000000011',
        'expired@auth-test.invalid', 'member', now() - interval '1 day');

-- An invite that has already been used.
insert into invites (id, email, role, expires_at, accepted_at)
values ('91000000-0000-4000-8000-000000000012',
        'used@auth-test.invalid', 'member',
        now() + interval '7 days', now());

commit;

-- ---------------------------------------------------------------------------
-- An uninvited address is rejected and leaves nothing behind
-- ---------------------------------------------------------------------------

begin;
do $$
declare n int;
begin
  begin
    insert into auth.users (id, email, raw_user_meta_data)
    values ('91000000-0000-4000-8000-000000000020',
            'stranger@auth-test.invalid', '{"full_name":"A Stranger"}'::jsonb);
    perform pg_temp.auth_record('uninvited sign-in is rejected',
      false, 'the insert was unexpectedly allowed');
  exception when others then
    perform pg_temp.auth_record('uninvited sign-in is rejected',
      sqlerrm like '%NO_INVITE%', 'raised: ' || sqlerrm);
  end;

  select count(*) into n from profiles where email = 'stranger@auth-test.invalid';
  perform pg_temp.auth_record('uninvited sign-in creates no profile',
    n = 0, 'saw ' || n || ' profiles, expected 0');

  select count(*) into n from auth.users where email = 'stranger@auth-test.invalid';
  perform pg_temp.auth_record('uninvited sign-in creates no auth user',
    n = 0, 'saw ' || n || ' auth users, expected 0');
end $$;
commit;

-- ---------------------------------------------------------------------------
-- An expired invite is not a valid invite
-- ---------------------------------------------------------------------------

begin;
do $$
begin
  begin
    insert into auth.users (id, email)
    values ('91000000-0000-4000-8000-000000000021', 'expired@auth-test.invalid');
    perform pg_temp.auth_record('expired invite is rejected',
      false, 'the insert was unexpectedly allowed');
  exception when others then
    perform pg_temp.auth_record('expired invite is rejected',
      sqlerrm like '%NO_INVITE%', 'raised: ' || sqlerrm);
  end;
end $$;
commit;

-- ---------------------------------------------------------------------------
-- An invite cannot be redeemed twice
-- ---------------------------------------------------------------------------

begin;
do $$
begin
  begin
    insert into auth.users (id, email)
    values ('91000000-0000-4000-8000-000000000022', 'used@auth-test.invalid');
    perform pg_temp.auth_record('already-accepted invite is rejected',
      false, 'the insert was unexpectedly allowed');
  exception when others then
    perform pg_temp.auth_record('already-accepted invite is rejected',
      sqlerrm like '%NO_INVITE%', 'raised: ' || sqlerrm);
  end;
end $$;
commit;

-- ---------------------------------------------------------------------------
-- A valid invite provisions exactly one of each row and is consumed
-- ---------------------------------------------------------------------------

begin;

insert into auth.users (id, email, raw_user_meta_data)
values ('91000000-0000-4000-8000-000000000023',
        'invited@auth-test.invalid',
        '{"full_name":"Invited Member","avatar_url":"https://example.invalid/a.png"}'::jsonb);

do $$
declare n int; got text;
begin
  select count(*) into n from profiles where id = '91000000-0000-4000-8000-000000000023';
  perform pg_temp.auth_record('invited sign-in creates exactly one profile',
    n = 1, 'saw ' || n || ' profiles, expected 1');

  select display_name into got from profiles
   where id = '91000000-0000-4000-8000-000000000023';
  perform pg_temp.auth_record('display name comes from the OAuth metadata',
    got = 'Invited Member', 'got ' || coalesce(got, 'null'));

  select count(*) into n from workspace_members
   where user_id = '91000000-0000-4000-8000-000000000023' and is_active;
  perform pg_temp.auth_record('invited sign-in creates one active membership',
    n = 1, 'saw ' || n || ' memberships, expected 1');

  select role::text into got from team_members
   where user_id = '91000000-0000-4000-8000-000000000023';
  perform pg_temp.auth_record('team pre-assignment carries the invited team role',
    got = 'lead', 'got ' || coalesce(got, 'null') || ', expected lead');

  select count(*) into n from invites
   where id = '91000000-0000-4000-8000-000000000010' and accepted_at is not null;
  perform pg_temp.auth_record('the invite is marked accepted',
    n = 1, 'saw ' || n || ' accepted, expected 1');
end $$;
commit;

-- ---------------------------------------------------------------------------
-- The address matched case-insensitively, because providers vary
-- ---------------------------------------------------------------------------

begin;

insert into invites (id, email, role, expires_at)
values ('91000000-0000-4000-8000-000000000013',
        'MixedCase@auth-test.invalid', 'member', now() + interval '7 days');

do $$
declare n int;
begin
  insert into auth.users (id, email)
  values ('91000000-0000-4000-8000-000000000024', 'mixedcase@auth-test.invalid');

  select count(*) into n from profiles where id = '91000000-0000-4000-8000-000000000024';
  perform pg_temp.auth_record('invite email matches case-insensitively',
    n = 1, 'saw ' || n || ' profiles, expected 1');
exception when others then
  perform pg_temp.auth_record('invite email matches case-insensitively',
    false, 'raised: ' || sqlerrm);
end $$;
commit;

-- ---------------------------------------------------------------------------
-- Cleanup — remove only what this suite created
-- ---------------------------------------------------------------------------

begin;

delete from team_members where user_id in (
  select id from profiles where email like '%@auth-test.invalid');
delete from workspace_members where user_id in (
  select id from profiles where email like '%@auth-test.invalid');
delete from profiles where email like '%@auth-test.invalid';
delete from auth.users where email like '%@auth-test.invalid';
delete from invites where email::text like '%@auth-test.invalid';
delete from teams where slug = 'auth-test-team';

commit;

select test as test, pass as pass, detail as detail from auth_test_results order by test;
