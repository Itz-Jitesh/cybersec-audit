-- supabase/tests/reactions.sql
-- Assertions for the comment reaction rules: one reaction per person per
-- comment (0014_one_reaction_per_comment.sql), and the access matrix around it.
--
-- Same shape as the other suites here. Every block commits, because the verdict
-- is recorded by the transaction that made the assertion and a rollback would
-- discard the answer along with the attempt. The block at the end removes
-- everything this suite created.

create temp table if not exists reaction_test_results (
  test text primary key,
  pass boolean not null,
  detail text
) on commit preserve rows;

truncate reaction_test_results;

create or replace function pg_temp.reaction_record(p_test text, p_pass boolean, p_detail text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into reaction_test_results (test, pass, detail)
  values (p_test, p_pass, p_detail)
  on conflict (test) do update set pass = excluded.pass, detail = excluded.detail;
end;
$$;

-- ---------------------------------------------------------------------------
-- Fixtures: a team, a project, an issue, one comment, and two members of that
-- team. Neither is a workspace admin.
-- ---------------------------------------------------------------------------

begin;

delete from comment_reactions where comment_id = 'c1000000-0000-4000-8000-000000000050';
delete from comments where issue_id = 'c1000000-0000-4000-8000-000000000040';
delete from issues where project_id = 'c1000000-0000-4000-8000-000000000020';
delete from states where project_id = 'c1000000-0000-4000-8000-000000000020';
delete from projects where identifier = 'RXNS';
delete from team_members where user_id in (
  select id from profiles where email like '%@reaction-test.invalid'
);
delete from workspace_members where user_id in (
  select id from profiles where email like '%@reaction-test.invalid'
);
delete from profiles where email like '%@reaction-test.invalid';
delete from auth.users where email like '%@reaction-test.invalid';
delete from invites where email::text like '%@reaction-test.invalid';
delete from teams where slug = 'reaction-test-team';

insert into teams (id, name, slug, color) values
  ('c1000000-0000-4000-8000-000000000010', 'Reaction Test', 'reaction-test-team', '#3f76ff');

insert into invites (email, role, expires_at) values
  ('one@reaction-test.invalid', 'member', now() + interval '1 day'),
  ('two@reaction-test.invalid', 'member', now() + interval '1 day');

insert into auth.users (id, email, encrypted_password, raw_user_meta_data) values
  ('c1000000-0000-4000-8000-000000000001', 'one@reaction-test.invalid', '', '{"full_name":"Reactor One"}'::jsonb),
  ('c1000000-0000-4000-8000-000000000002', 'two@reaction-test.invalid', '', '{"full_name":"Reactor Two"}'::jsonb);

insert into team_members (team_id, user_id, role) values
  ('c1000000-0000-4000-8000-000000000010', 'c1000000-0000-4000-8000-000000000001', 'member'),
  ('c1000000-0000-4000-8000-000000000010', 'c1000000-0000-4000-8000-000000000002', 'member');

insert into projects (id, team_id, name, identifier, created_by)
values ('c1000000-0000-4000-8000-000000000020',
        'c1000000-0000-4000-8000-000000000010',
        'Reaction Test Project', 'RXNS',
        'c1000000-0000-4000-8000-000000000001');

insert into states (id, project_id, name, "group", color, sequence, is_default) values
  ('c1000000-0000-4000-8000-000000000030', 'c1000000-0000-4000-8000-000000000020',
   'Todo', 'unstarted', '#9ca3af', 1000, true);

insert into issues (id, project_id, name, state_id, sort_order, created_by)
values ('c1000000-0000-4000-8000-000000000040',
        'c1000000-0000-4000-8000-000000000020',
        'Reaction fixture issue',
        'c1000000-0000-4000-8000-000000000030',
        1000,
        'c1000000-0000-4000-8000-000000000001');

-- Written by member one, so member two is reacting to somebody else's comment.
insert into comments (id, issue_id, author_id, content_html)
values ('c1000000-0000-4000-8000-000000000050',
        'c1000000-0000-4000-8000-000000000040',
        'c1000000-0000-4000-8000-000000000001',
        '<p>fixture comment</p>');

commit;

-- ---------------------------------------------------------------------------
-- 1. A member reacts to somebody else's comment. Authorship is not a factor.
-- ---------------------------------------------------------------------------
begin;
select set_config('role', 'authenticated', true);
select set_config('request.jwt.claims', '{"sub":"c1000000-0000-4000-8000-000000000002"}', true);
do $$
declare n int;
begin
  begin
    insert into comment_reactions (comment_id, user_id, emoji)
    values ('c1000000-0000-4000-8000-000000000050',
            'c1000000-0000-4000-8000-000000000002', '👍');
    select count(*) into n from comment_reactions
     where comment_id = 'c1000000-0000-4000-8000-000000000050';
    perform pg_temp.reaction_record('a member reacts to another persons comment',
      n = 1, 'saw ' || n || ' reactions, expected 1');
  exception when others then
    perform pg_temp.reaction_record('a member reacts to another persons comment',
      false, 'refused: ' || left(sqlerrm, 60));
  end;
end $$;
commit;

-- ---------------------------------------------------------------------------
-- 2. The same person cannot hold a second reaction on the same comment. This is
--    the rule 0014 added: one per person per comment, not one per emoji.
-- ---------------------------------------------------------------------------
begin;
select set_config('role', 'authenticated', true);
select set_config('request.jwt.claims', '{"sub":"c1000000-0000-4000-8000-000000000002"}', true);
do $$
begin
  begin
    insert into comment_reactions (comment_id, user_id, emoji)
    values ('c1000000-0000-4000-8000-000000000050',
            'c1000000-0000-4000-8000-000000000002', '🎉');
    perform pg_temp.reaction_record('a second emoji from the same person is refused',
      false, 'the insert was allowed — they now hold two');
  exception when unique_violation then
    perform pg_temp.reaction_record('a second emoji from the same person is refused',
      true, 'refused by the unique constraint');
  when others then
    perform pg_temp.reaction_record('a second emoji from the same person is refused',
      false, 'refused for the wrong reason: ' || left(sqlerrm, 60));
  end;
end $$;
commit;

-- ---------------------------------------------------------------------------
-- 3. Switching emoji is delete-then-insert, which is what the action does, and
--    it leaves exactly one row.
-- ---------------------------------------------------------------------------
begin;
select set_config('role', 'authenticated', true);
select set_config('request.jwt.claims', '{"sub":"c1000000-0000-4000-8000-000000000002"}', true);
do $$
declare n int; kept text;
begin
  delete from comment_reactions
   where comment_id = 'c1000000-0000-4000-8000-000000000050'
     and user_id = 'c1000000-0000-4000-8000-000000000002';
  insert into comment_reactions (comment_id, user_id, emoji)
  values ('c1000000-0000-4000-8000-000000000050',
          'c1000000-0000-4000-8000-000000000002', '🚀');

  select count(*), max(emoji) into n, kept from comment_reactions
   where comment_id = 'c1000000-0000-4000-8000-000000000050'
     and user_id = 'c1000000-0000-4000-8000-000000000002';
  perform pg_temp.reaction_record('switching emoji replaces rather than stacks',
    n = 1 and kept = '🚀', 'holds ' || n || ' reaction(s), emoji ' || coalesce(kept, 'none'));
end $$;
commit;

-- ---------------------------------------------------------------------------
-- 4. Two different people may each react to the same comment, including with
--    the same emoji. The constraint is per person, not per comment.
-- ---------------------------------------------------------------------------
begin;
select set_config('role', 'authenticated', true);
select set_config('request.jwt.claims', '{"sub":"c1000000-0000-4000-8000-000000000001"}', true);
do $$
declare n int;
begin
  begin
    insert into comment_reactions (comment_id, user_id, emoji)
    values ('c1000000-0000-4000-8000-000000000050',
            'c1000000-0000-4000-8000-000000000001', '🚀');
    select count(*) into n from comment_reactions
     where comment_id = 'c1000000-0000-4000-8000-000000000050';
    perform pg_temp.reaction_record('two people may hold the same emoji',
      n = 2, 'saw ' || n || ' reactions, expected 2');
  exception when others then
    perform pg_temp.reaction_record('two people may hold the same emoji',
      false, 'refused: ' || left(sqlerrm, 60));
  end;
end $$;
commit;

-- ---------------------------------------------------------------------------
-- 5. A reaction is still pinned to the person making it, and removable only by
--    them.
-- ---------------------------------------------------------------------------
begin;
select set_config('role', 'authenticated', true);
select set_config('request.jwt.claims', '{"sub":"c1000000-0000-4000-8000-000000000002"}', true);
do $$
declare n int;
begin
  begin
    insert into comment_reactions (comment_id, user_id, emoji)
    values ('c1000000-0000-4000-8000-000000000050',
            'c1000000-0000-4000-8000-000000000001', '😄');
    perform pg_temp.reaction_record('cannot react as somebody else',
      false, 'the insert was allowed');
  exception when others then
    perform pg_temp.reaction_record('cannot react as somebody else',
      true, 'refused: ' || left(sqlerrm, 60));
  end;

  delete from comment_reactions
   where comment_id = 'c1000000-0000-4000-8000-000000000050'
     and user_id = 'c1000000-0000-4000-8000-000000000001';
  get diagnostics n = row_count;
  perform pg_temp.reaction_record('cannot remove somebody elses reaction',
    n = 0, 'deleted ' || n || ' rows, expected 0');
end $$;
commit;

-- ---------------------------------------------------------------------------
-- Cleanup — by fixture id and email only.
-- ---------------------------------------------------------------------------
begin;
reset role;
select set_config('request.jwt.claims', '', true);

delete from comment_reactions where comment_id = 'c1000000-0000-4000-8000-000000000050';
delete from comments where issue_id = 'c1000000-0000-4000-8000-000000000040';
delete from issue_subscribers where issue_id = 'c1000000-0000-4000-8000-000000000040';
delete from notifications where issue_id = 'c1000000-0000-4000-8000-000000000040';
delete from issues where project_id = 'c1000000-0000-4000-8000-000000000020';
delete from states where project_id = 'c1000000-0000-4000-8000-000000000020';
delete from projects where identifier = 'RXNS';
delete from team_members where user_id in (
  select id from profiles where email like '%@reaction-test.invalid'
);
delete from workspace_members where user_id in (
  select id from profiles where email like '%@reaction-test.invalid'
);
delete from profiles where email like '%@reaction-test.invalid';
delete from auth.users where email like '%@reaction-test.invalid';
delete from invites where email::text like '%@reaction-test.invalid';
delete from teams where slug = 'reaction-test-team';
commit;
