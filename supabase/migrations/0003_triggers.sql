-- 0003_triggers.sql
-- Every trigger and function from docs/04-DATA-MODEL.md §8.
--
-- Two rules shape this file. First, anything that must be correct under
-- concurrency is done in a single statement rather than a read followed by a
-- write. Second, the activity feed and the notification inbox are written here
-- and nowhere else, so the application cannot forge either of them; the RLS
-- policies added in phase 4 give the authenticated role no insert on those
-- tables at all.

-- ---------------------------------------------------------------------------
-- profiles → auth.users
-- ---------------------------------------------------------------------------
-- auth.users belongs to Supabase, so it is not modelled in Drizzle; declaring
-- it there made drizzle-kit try to create a table that already exists. The key
-- is added here instead, which also gives profiles the cascade that removes a
-- profile when its auth user is deleted.

alter table profiles
  drop constraint if exists profiles_id_auth_users_id_fk;

alter table profiles
  add constraint profiles_id_auth_users_id_fk
  foreign key (id) references auth.users (id) on delete cascade;

-- ---------------------------------------------------------------------------
-- set_updated_at
-- ---------------------------------------------------------------------------

create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Bind it to every table in public that carries an updated_at column.
do $$
declare
  target record;
begin
  for target in
    select c.table_name
    from information_schema.columns c
    join information_schema.tables t
      on t.table_schema = c.table_schema
     and t.table_name = c.table_name
    where c.table_schema = 'public'
      and c.column_name = 'updated_at'
      and t.table_type = 'BASE TABLE'
  loop
    execute format(
      'drop trigger if exists set_updated_at on public.%I', target.table_name
    );
    execute format(
      'create trigger set_updated_at before update on public.%I
         for each row execute function set_updated_at()',
      target.table_name
    );
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- assign_issue_sequence
-- ---------------------------------------------------------------------------
-- The increment and the read happen in one UPDATE ... RETURNING. Two clients
-- inserting into the same project at the same moment therefore serialise on the
-- project row and receive different numbers, with no gaps. A SELECT followed by
-- an UPDATE would hand both of them the same sequence_id.

create or replace function assign_issue_sequence()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  next_sequence integer;
begin
  update projects
     set sequence_counter = sequence_counter + 1
   where id = new.project_id
  returning sequence_counter into next_sequence;

  if next_sequence is null then
    raise exception 'PROJECT_NOT_FOUND: %', new.project_id;
  end if;

  new.sequence_id = next_sequence;
  return new;
end;
$$;

drop trigger if exists assign_issue_sequence on issues;
create trigger assign_issue_sequence
  before insert on issues
  for each row execute function assign_issue_sequence();

-- ---------------------------------------------------------------------------
-- set_completed_at
-- ---------------------------------------------------------------------------

create or replace function set_completed_at()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  was_completed boolean;
  is_completed boolean;
begin
  if new.state_id is not distinct from old.state_id then
    return new;
  end if;

  select s.group = 'completed' into was_completed
    from states s where s.id = old.state_id;

  select s.group = 'completed' into is_completed
    from states s where s.id = new.state_id;

  if coalesce(is_completed, false) and not coalesce(was_completed, false) then
    new.completed_at = now();
  elsif not coalesce(is_completed, false) and coalesce(was_completed, false) then
    new.completed_at = null;
  end if;

  return new;
end;
$$;

drop trigger if exists set_completed_at on issues;
create trigger set_completed_at
  before update on issues
  for each row execute function set_completed_at();

-- ---------------------------------------------------------------------------
-- log_issue_activity
-- ---------------------------------------------------------------------------
-- old_display and new_display are resolved at write time so that a state or
-- cycle deleted later still renders correctly in the feed.

create or replace function log_issue_activity()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor uuid := auth.uid();
  old_name text;
  new_name text;
begin
  -- An insert performed outside a user session, such as by the seed script, has
  -- no actor to attribute the entry to, so it is skipped rather than failing.
  if actor is null then
    return null;
  end if;

  if tg_op = 'INSERT' then
    insert into issue_activity (issue_id, actor_id, field, new_value, new_display)
    values (new.id, actor, 'created', new.id::text, new.name);
    return null;
  end if;

  if new.name is distinct from old.name then
    insert into issue_activity
      (issue_id, actor_id, field, old_value, new_value, old_display, new_display)
    values (new.id, actor, 'name', old.name, new.name, old.name, new.name);
  end if;

  if new.description_html is distinct from old.description_html then
    insert into issue_activity (issue_id, actor_id, field)
    values (new.id, actor, 'description');
  end if;

  if new.state_id is distinct from old.state_id then
    select name into old_name from states where id = old.state_id;
    select name into new_name from states where id = new.state_id;
    insert into issue_activity
      (issue_id, actor_id, field, old_value, new_value, old_display, new_display)
    values (new.id, actor, 'state', old.state_id::text, new.state_id::text,
            old_name, new_name);
  end if;

  if new.priority is distinct from old.priority then
    insert into issue_activity
      (issue_id, actor_id, field, old_value, new_value, old_display, new_display)
    values (new.id, actor, 'priority', old.priority::text, new.priority::text,
            old.priority::text, new.priority::text);
  end if;

  if new.parent_id is distinct from old.parent_id then
    select name into old_name from issues where id = old.parent_id;
    select name into new_name from issues where id = new.parent_id;
    insert into issue_activity
      (issue_id, actor_id, field, old_value, new_value, old_display, new_display)
    values (new.id, actor, 'parent', old.parent_id::text, new.parent_id::text,
            old_name, new_name);
  end if;

  if new.cycle_id is distinct from old.cycle_id then
    select name into old_name from cycles where id = old.cycle_id;
    select name into new_name from cycles where id = new.cycle_id;
    insert into issue_activity
      (issue_id, actor_id, field, old_value, new_value, old_display, new_display)
    values (new.id, actor, 'cycle', old.cycle_id::text, new.cycle_id::text,
            old_name, new_name);
  end if;

  if new.start_date is distinct from old.start_date then
    insert into issue_activity
      (issue_id, actor_id, field, old_value, new_value, old_display, new_display)
    values (new.id, actor, 'start_date', old.start_date::text,
            new.start_date::text, old.start_date::text, new.start_date::text);
  end if;

  if new.target_date is distinct from old.target_date then
    insert into issue_activity
      (issue_id, actor_id, field, old_value, new_value, old_display, new_display)
    values (new.id, actor, 'target_date', old.target_date::text,
            new.target_date::text, old.target_date::text, new.target_date::text);
  end if;

  if new.estimate_point is distinct from old.estimate_point then
    insert into issue_activity
      (issue_id, actor_id, field, old_value, new_value, old_display, new_display)
    values (new.id, actor, 'estimate', old.estimate_point::text,
            new.estimate_point::text, old.estimate_point::text,
            new.estimate_point::text);
  end if;

  return null;
end;
$$;

drop trigger if exists log_issue_activity on issues;
create trigger log_issue_activity
  after insert or update on issues
  for each row execute function log_issue_activity();

-- ---------------------------------------------------------------------------
-- log_assignee_activity / log_label_activity
-- ---------------------------------------------------------------------------

create or replace function log_assignee_activity()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor uuid := auth.uid();
  display text;
begin
  if actor is null then
    return null;
  end if;

  if tg_op = 'INSERT' then
    select display_name into display from profiles where id = new.user_id;
    insert into issue_activity
      (issue_id, actor_id, field, new_value, new_display)
    values (new.issue_id, actor, 'assignee', new.user_id::text, display);
  else
    select display_name into display from profiles where id = old.user_id;
    insert into issue_activity
      (issue_id, actor_id, field, old_value, old_display)
    values (old.issue_id, actor, 'assignee', old.user_id::text, display);
  end if;

  return null;
end;
$$;

drop trigger if exists log_assignee_activity on issue_assignees;
create trigger log_assignee_activity
  after insert or delete on issue_assignees
  for each row execute function log_assignee_activity();

create or replace function log_label_activity()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor uuid := auth.uid();
  display text;
begin
  if actor is null then
    return null;
  end if;

  if tg_op = 'INSERT' then
    select name into display from labels where id = new.label_id;
    insert into issue_activity
      (issue_id, actor_id, field, new_value, new_display)
    values (new.issue_id, actor, 'label', new.label_id::text, display);
  else
    select name into display from labels where id = old.label_id;
    insert into issue_activity
      (issue_id, actor_id, field, old_value, old_display)
    values (old.issue_id, actor, 'label', old.label_id::text, display);
  end if;

  return null;
end;
$$;

drop trigger if exists log_label_activity on issue_labels;
create trigger log_label_activity
  after insert or delete on issue_labels
  for each row execute function log_label_activity();

-- ---------------------------------------------------------------------------
-- auto_subscribe
-- ---------------------------------------------------------------------------

create or replace function auto_subscribe()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  target_issue uuid;
  target_user uuid;
begin
  if tg_table_name = 'comments' then
    target_issue := new.issue_id;
    target_user := new.author_id;
  else
    target_issue := new.issue_id;
    target_user := new.user_id;
  end if;

  insert into issue_subscribers (issue_id, user_id)
  values (target_issue, target_user)
  on conflict (issue_id, user_id) do nothing;

  return null;
end;
$$;

drop trigger if exists auto_subscribe on comments;
create trigger auto_subscribe
  after insert on comments
  for each row execute function auto_subscribe();

drop trigger if exists auto_subscribe on issue_assignees;
create trigger auto_subscribe
  after insert on issue_assignees
  for each row execute function auto_subscribe();

-- ---------------------------------------------------------------------------
-- fanout_notifications
-- ---------------------------------------------------------------------------
-- Fires on both issue_activity and comments, so it branches on tg_table_name.
--
-- Recipients are the union of the issue's subscribers and, for a comment, every
-- user id appearing in a data-mention-id attribute in the comment HTML. The
-- actor is always excluded, and distinct on (user_id) collapses a user who is
-- both subscribed and mentioned into one row. Mentions are ordered first so the
-- surviving row for such a user is the mention, which is the more specific and
-- more useful notification of the two.

create or replace function fanout_notifications()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  target_issue uuid;
  actor uuid;
  subscriber_type notification_type;
  issue_title text;
  body_text text;
  mention_ids uuid[] := '{}';
begin
  if tg_table_name = 'comments' then
    target_issue := new.issue_id;
    actor := new.author_id;
    subscriber_type := 'commented';
    body_text := left(regexp_replace(new.content_html, '<[^>]*>', '', 'g'), 280);

    -- Collected here rather than inside the insert below, because NEW is an
    -- issue_activity row on the other trigger and has no content_html field to
    -- reference at execution time.
    select coalesce(array_agg(distinct match[1]::uuid), '{}')
      into mention_ids
      from regexp_matches(
             new.content_html,
             'data-mention-id="([0-9a-fA-F-]{36})"',
             'g'
           ) as match;
  else
    target_issue := new.issue_id;
    actor := new.actor_id;
    subscriber_type := case new.field
      when 'assignee' then 'assigned'::notification_type
      when 'state' then 'state_changed'::notification_type
      else 'subscribed'::notification_type
    end;
    body_text := coalesce(new.new_display, new.old_display);
  end if;

  select name into issue_title from issues where id = target_issue;

  insert into notifications (user_id, issue_id, actor_id, type, title, body)
  select distinct on (candidate.user_id)
         candidate.user_id, target_issue, actor, candidate.type,
         coalesce(issue_title, 'Issue'), body_text
  from (
    -- Mentions first, so distinct on keeps them over a plain subscription.
    select mentioned as user_id, 'mention'::notification_type as type, 0 as rank
      from unnest(mention_ids) as mentioned

    union all

    select s.user_id, subscriber_type as type, 1 as rank
      from issue_subscribers s
     where s.issue_id = target_issue
  ) candidate
  where candidate.user_id is distinct from actor
  order by candidate.user_id, candidate.rank;

  return null;
end;
$$;

drop trigger if exists fanout_notifications on comments;
create trigger fanout_notifications
  after insert on comments
  for each row execute function fanout_notifications();

drop trigger if exists fanout_notifications on issue_activity;
create trigger fanout_notifications
  after insert on issue_activity
  for each row execute function fanout_notifications();
