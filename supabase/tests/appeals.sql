-- supabase/tests/appeals.sql
-- Assertions for the appeal workflow added in 0011_appeal_enums.sql and
-- 0012_appeals.sql: who may raise an appeal, who may decide one, who is
-- notified, and who may move an issue into a completed state.
--
-- Same shape as the other suites in this directory. Every block commits,
-- because the verdict is recorded by the transaction that made the assertion
-- and a rollback would throw the answer away with the attempt. The fixture
-- block at the end of the file removes everything this suite created.
--
-- Fixtures are self-contained: a team with a lead and a plain member, a second
-- team whose member is an outsider here, a project and one issue. None of the
-- three is a workspace admin, since an admin may do everything and would make
-- every denial below vacuous.

create temp table if not exists appeal_test_results (
  test text primary key,
  pass boolean not null,
  detail text
) on commit preserve rows;

truncate appeal_test_results;

create or replace function pg_temp.appeal_record(p_test text, p_pass boolean, p_detail text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into appeal_test_results (test, pass, detail)
  values (p_test, p_pass, p_detail)
  on conflict (test) do update set pass = excluded.pass, detail = excluded.detail;
end;
$$;

-- ---------------------------------------------------------------------------
-- Fixtures
-- ---------------------------------------------------------------------------

begin;

delete from issue_appeals where project_id = 'a9000000-0000-4000-8000-000000000020';
delete from notifications where user_id in (
  select id from profiles where email like '%@appeal-test.invalid'
);
delete from issues where project_id = 'a9000000-0000-4000-8000-000000000020';
delete from states where project_id = 'a9000000-0000-4000-8000-000000000020';
delete from projects where identifier = 'APTS';
delete from team_members where user_id in (
  select id from profiles where email like '%@appeal-test.invalid'
);
delete from workspace_members where user_id in (
  select id from profiles where email like '%@appeal-test.invalid'
);
delete from profiles where email like '%@appeal-test.invalid';
delete from auth.users where email like '%@appeal-test.invalid';
delete from invites where email::text like '%@appeal-test.invalid';
delete from teams where slug in ('appeal-test-team', 'appeal-test-other');

insert into teams (id, name, slug, color) values
  ('a9000000-0000-4000-8000-000000000010', 'Appeal Test', 'appeal-test-team', '#3f76ff'),
  ('a9000000-0000-4000-8000-000000000011', 'Appeal Other', 'appeal-test-other', '#3f76ff');

insert into invites (email, role, expires_at) values
  ('lead@appeal-test.invalid', 'member', now() + interval '1 day'),
  ('member@appeal-test.invalid', 'member', now() + interval '1 day'),
  ('outsider@appeal-test.invalid', 'member', now() + interval '1 day');

insert into auth.users (id, email, encrypted_password, raw_user_meta_data) values
  ('a9000000-0000-4000-8000-000000000001', 'lead@appeal-test.invalid', '', '{"full_name":"Appeal Lead"}'::jsonb),
  ('a9000000-0000-4000-8000-000000000002', 'member@appeal-test.invalid', '', '{"full_name":"Appeal Member"}'::jsonb),
  ('a9000000-0000-4000-8000-000000000003', 'outsider@appeal-test.invalid', '', '{"full_name":"Appeal Outsider"}'::jsonb);

insert into team_members (team_id, user_id, role) values
  ('a9000000-0000-4000-8000-000000000010', 'a9000000-0000-4000-8000-000000000001', 'lead'),
  ('a9000000-0000-4000-8000-000000000010', 'a9000000-0000-4000-8000-000000000002', 'member'),
  ('a9000000-0000-4000-8000-000000000011', 'a9000000-0000-4000-8000-000000000003', 'member');

insert into projects (id, team_id, name, identifier, created_by)
values ('a9000000-0000-4000-8000-000000000020',
        'a9000000-0000-4000-8000-000000000010',
        'Appeal Test Project', 'APTS',
        'a9000000-0000-4000-8000-000000000001');

-- States are seeded by createProject, not by a database trigger, so the three
-- the assertions need are created here explicitly.
insert into states (id, project_id, name, "group", color, sequence, is_default) values
  ('a9000000-0000-4000-8000-000000000025', 'a9000000-0000-4000-8000-000000000020',
   'Todo', 'unstarted', '#9ca3af', 1000, true),
  ('a9000000-0000-4000-8000-000000000026', 'a9000000-0000-4000-8000-000000000020',
   'In progress', 'started', '#f59e0b', 2000, false),
  ('a9000000-0000-4000-8000-000000000027', 'a9000000-0000-4000-8000-000000000020',
   'Done', 'completed', '#16a34a', 3000, false);

insert into issues (id, project_id, name, state_id, sort_order, created_by)
values ('a9000000-0000-4000-8000-000000000030',
        'a9000000-0000-4000-8000-000000000020',
        'Existing issue',
        'a9000000-0000-4000-8000-000000000025',
        1000,
        'a9000000-0000-4000-8000-000000000002');

commit;

-- ---------------------------------------------------------------------------
-- 1. A plain member may raise a create appeal for themselves.
-- ---------------------------------------------------------------------------
begin;
select set_config('role', 'authenticated', true);
select set_config('request.jwt.claims', '{"sub":"a9000000-0000-4000-8000-000000000002"}', true);
do $$
declare n int;
begin
  begin
    insert into issue_appeals (id, project_id, kind, title, note, requested_by)
    values ('a9000000-0000-4000-8000-000000000040',
            'a9000000-0000-4000-8000-000000000020', 'create',
            'Please open this', 'found a gap',
            'a9000000-0000-4000-8000-000000000002');
    select count(*) into n from issue_appeals
     where id = 'a9000000-0000-4000-8000-000000000040';
    perform pg_temp.appeal_record('member raises a create appeal',
      n = 1, 'inserted ' || n || ' rows, expected 1');
  exception when others then
    perform pg_temp.appeal_record('member raises a create appeal',
      false, 'refused: ' || sqlerrm);
  end;
end $$;
commit;

-- ---------------------------------------------------------------------------
-- 2. Raising it notified the lead, and did not notify the requester. Read as
--    the owner: notifications_select would hide the lead's row from anyone else.
-- ---------------------------------------------------------------------------
begin;
reset role;
select set_config('request.jwt.claims', '', true);
do $$
declare lead_n int; self_n int;
begin
  select count(*) into lead_n from notifications
   where user_id = 'a9000000-0000-4000-8000-000000000001'
     and type = 'appeal_submitted';
  select count(*) into self_n from notifications
   where user_id = 'a9000000-0000-4000-8000-000000000002'
     and type = 'appeal_submitted';
  perform pg_temp.appeal_record('the appeal notifies the team lead',
    lead_n >= 1, 'lead got ' || lead_n || ' appeal notifications, expected at least 1');
  perform pg_temp.appeal_record('the appeal does not notify its own author',
    self_n = 0, 'author got ' || self_n || ' appeal notifications, expected 0');
end $$;
commit;

-- ---------------------------------------------------------------------------
-- 3. A member outside the project cannot raise one in it, and cannot see it.
-- ---------------------------------------------------------------------------
begin;
select set_config('role', 'authenticated', true);
select set_config('request.jwt.claims', '{"sub":"a9000000-0000-4000-8000-000000000003"}', true);
do $$
declare n int;
begin
  begin
    insert into issue_appeals (project_id, kind, title, requested_by)
    values ('a9000000-0000-4000-8000-000000000020', 'create', 'Not mine',
            'a9000000-0000-4000-8000-000000000003');
    perform pg_temp.appeal_record('outsider cannot raise an appeal',
      false, 'the insert was allowed');
  exception when others then
    perform pg_temp.appeal_record('outsider cannot raise an appeal',
      true, 'refused: ' || left(sqlerrm, 60));
  end;

  select count(*) into n from issue_appeals
   where project_id = 'a9000000-0000-4000-8000-000000000020';
  perform pg_temp.appeal_record('outsider cannot read the appeal',
    n = 0, 'saw ' || n || ' rows, expected 0');
end $$;
commit;

-- ---------------------------------------------------------------------------
-- 4. A member cannot raise an appeal in someone else's name, and cannot raise
--    one that is already approved.
-- ---------------------------------------------------------------------------
begin;
select set_config('role', 'authenticated', true);
select set_config('request.jwt.claims', '{"sub":"a9000000-0000-4000-8000-000000000002"}', true);
do $$
begin
  begin
    insert into issue_appeals (project_id, kind, title, requested_by)
    values ('a9000000-0000-4000-8000-000000000020', 'create', 'Forged',
            'a9000000-0000-4000-8000-000000000001');
    perform pg_temp.appeal_record('cannot raise an appeal for someone else',
      false, 'the insert was allowed');
  exception when others then
    perform pg_temp.appeal_record('cannot raise an appeal for someone else',
      true, 'refused: ' || left(sqlerrm, 60));
  end;

  begin
    insert into issue_appeals (project_id, kind, title, requested_by, status)
    values ('a9000000-0000-4000-8000-000000000020', 'create', 'Pre-approved',
            'a9000000-0000-4000-8000-000000000002', 'approved');
    perform pg_temp.appeal_record('cannot raise an appeal already approved',
      false, 'the insert was allowed');
  exception when others then
    perform pg_temp.appeal_record('cannot raise an appeal already approved',
      true, 'refused: ' || left(sqlerrm, 60));
  end;
end $$;
commit;

-- ---------------------------------------------------------------------------
-- 5. The requester cannot approve their own appeal.
-- ---------------------------------------------------------------------------
begin;
select set_config('role', 'authenticated', true);
select set_config('request.jwt.claims', '{"sub":"a9000000-0000-4000-8000-000000000002"}', true);
do $$
declare n int;
begin
  update issue_appeals
     set status = 'approved', decided_by = 'a9000000-0000-4000-8000-000000000002',
         decided_at = now()
   where id = 'a9000000-0000-4000-8000-000000000040';
  get diagnostics n = row_count;
  perform pg_temp.appeal_record('requester cannot approve their own appeal',
    n = 0, 'updated ' || n || ' rows, expected 0');
end $$;
commit;

-- ---------------------------------------------------------------------------
-- 6. The team lead can approve it, and that notifies the requester.
-- ---------------------------------------------------------------------------
begin;
select set_config('role', 'authenticated', true);
select set_config('request.jwt.claims', '{"sub":"a9000000-0000-4000-8000-000000000001"}', true);
do $$
declare n int;
begin
  update issue_appeals
     set status = 'approved', decided_by = 'a9000000-0000-4000-8000-000000000001',
         decided_at = now()
   where id = 'a9000000-0000-4000-8000-000000000040';
  get diagnostics n = row_count;
  perform pg_temp.appeal_record('the team lead approves the appeal',
    n = 1, 'updated ' || n || ' rows, expected 1');
end $$;
commit;

-- The fan-out is counted as the owner, not as the lead. notifications_select
-- restricts a reader to their own rows, so counting someone else's inbox from
-- inside the actor's session measures the policy rather than the trigger.
begin;
reset role;
select set_config('request.jwt.claims', '', true);
do $$
declare notified int;
begin
  select count(*) into notified from notifications
   where user_id = 'a9000000-0000-4000-8000-000000000002'
     and type = 'appeal_approved';
  perform pg_temp.appeal_record('approval notifies the requester',
    notified = 1, 'requester got ' || notified || ' approval notifications, expected 1');
end $$;
commit;

-- ---------------------------------------------------------------------------
-- 7. A plain member cannot move an issue into a completed state.
-- ---------------------------------------------------------------------------
begin;
select set_config('role', 'authenticated', true);
select set_config('request.jwt.claims', '{"sub":"a9000000-0000-4000-8000-000000000002"}', true);
do $$
begin
  begin
    update issues
       set state_id = 'a9000000-0000-4000-8000-000000000027'
     where id = 'a9000000-0000-4000-8000-000000000030';
    perform pg_temp.appeal_record('member cannot complete an issue',
      false, 'the update was allowed');
  exception when others then
    perform pg_temp.appeal_record('member cannot complete an issue',
      true, 'refused: ' || left(sqlerrm, 60));
  end;
end $$;
commit;

-- ---------------------------------------------------------------------------
-- 8. The same member may still move it to a non-completed state, so the gate is
--    about completion and not about editing.
-- ---------------------------------------------------------------------------
begin;
select set_config('role', 'authenticated', true);
select set_config('request.jwt.claims', '{"sub":"a9000000-0000-4000-8000-000000000002"}', true);
do $$
declare n int;
begin
  update issues
     set state_id = 'a9000000-0000-4000-8000-000000000026'
   where id = 'a9000000-0000-4000-8000-000000000030';
  get diagnostics n = row_count;
  perform pg_temp.appeal_record('member may still start an issue',
    n = 1, 'updated ' || n || ' rows, expected 1');
end $$;
commit;

-- ---------------------------------------------------------------------------
-- 9. The team lead may complete it.
-- ---------------------------------------------------------------------------
begin;
select set_config('role', 'authenticated', true);
select set_config('request.jwt.claims', '{"sub":"a9000000-0000-4000-8000-000000000001"}', true);
do $$
declare n int;
begin
  update issues
     set state_id = 'a9000000-0000-4000-8000-000000000027'
   where id = 'a9000000-0000-4000-8000-000000000030';
  get diagnostics n = row_count;
  perform pg_temp.appeal_record('the team lead may complete an issue',
    n = 1, 'updated ' || n || ' rows, expected 1');
end $$;
commit;

-- ---------------------------------------------------------------------------
-- 10. Subscribing notifies the lead, and not the subscriber themselves.
-- ---------------------------------------------------------------------------
begin;
select set_config('role', 'authenticated', true);
select set_config('request.jwt.claims', '{"sub":"a9000000-0000-4000-8000-000000000002"}', true);
do $$
begin
  insert into issue_subscribers (issue_id, user_id)
  values ('a9000000-0000-4000-8000-000000000030',
          'a9000000-0000-4000-8000-000000000002')
  on conflict (issue_id, user_id) do nothing;
end $$;
commit;

-- Counted as the owner, for the same reason as the approval fan-out above.
begin;
reset role;
select set_config('request.jwt.claims', '', true);
do $$
declare lead_n int; self_n int;
begin
  select count(*) into lead_n from notifications
   where user_id = 'a9000000-0000-4000-8000-000000000001'
     and type = 'subscribed_to';
  select count(*) into self_n from notifications
   where user_id = 'a9000000-0000-4000-8000-000000000002'
     and type = 'subscribed_to';
  perform pg_temp.appeal_record('subscribing notifies the team lead',
    lead_n >= 1, 'lead got ' || lead_n || ' follow notifications, expected at least 1');
  perform pg_temp.appeal_record('subscribing does not notify the subscriber',
    self_n = 0, 'subscriber got ' || self_n || ' follow notifications, expected 0');
end $$;
commit;

-- ---------------------------------------------------------------------------
-- 11. A completion appeal needs an issue, and a create appeal must not carry
--     one — the shape constraint, checked as the owner so no policy is in play.
-- ---------------------------------------------------------------------------
begin;
reset role;
do $$
begin
  begin
    insert into issue_appeals (project_id, kind, requested_by)
    values ('a9000000-0000-4000-8000-000000000020', 'complete',
            'a9000000-0000-4000-8000-000000000002');
    perform pg_temp.appeal_record('a completion appeal requires an issue',
      false, 'the insert was allowed');
  exception when others then
    perform pg_temp.appeal_record('a completion appeal requires an issue',
      true, 'refused: ' || left(sqlerrm, 60));
  end;

  begin
    insert into issue_appeals (project_id, kind, requested_by)
    values ('a9000000-0000-4000-8000-000000000020', 'create',
            'a9000000-0000-4000-8000-000000000002');
    perform pg_temp.appeal_record('a create appeal requires a title',
      false, 'the insert was allowed');
  exception when others then
    perform pg_temp.appeal_record('a create appeal requires a title',
      true, 'refused: ' || left(sqlerrm, 60));
  end;
end $$;
commit;

-- ---------------------------------------------------------------------------
-- Cleanup — deterministic, by fixture id and email only.
-- ---------------------------------------------------------------------------
begin;
reset role;
select set_config('request.jwt.claims', '', true);

delete from issue_appeals where project_id = 'a9000000-0000-4000-8000-000000000020';
delete from notifications where user_id in (
  select id from profiles where email like '%@appeal-test.invalid'
);
delete from issues where project_id = 'a9000000-0000-4000-8000-000000000020';
delete from states where project_id = 'a9000000-0000-4000-8000-000000000020';
delete from projects where identifier = 'APTS';
delete from team_members where user_id in (
  select id from profiles where email like '%@appeal-test.invalid'
);
delete from workspace_members where user_id in (
  select id from profiles where email like '%@appeal-test.invalid'
);
delete from profiles where email like '%@appeal-test.invalid';
delete from auth.users where email like '%@appeal-test.invalid';
delete from invites where email::text like '%@appeal-test.invalid';
delete from teams where slug in ('appeal-test-team', 'appeal-test-other');
commit;
