-- 0005_security_fixes.sql
-- Three authorization defects found while auditing phases 3 and 4.
--
-- Written as a new migration rather than an edit to 0003 or 0004, both of which
-- are already applied.

-- ---------------------------------------------------------------------------
-- 1. An administrator could edit their own workspace_members row
-- ---------------------------------------------------------------------------
-- docs/04-DATA-MODEL.md restricts this table to administrators, and prompt 4
-- adds that a user must not be able to update their own role row. The policy as
-- written enforced only the first half, which left a co_president — who passes
-- is_workspace_admin — able to promote themselves to admin, and any
-- administrator able to defeat a deactivation by reactivating their own row.
--
-- Role changes now always require a second administrator. That is the intended
-- shape of the control: the workspace has several admins, so no one is locked
-- out, and no single account can raise its own privileges.

drop policy if exists workspace_members_update on workspace_members;
create policy workspace_members_update on workspace_members for update to authenticated
  using (is_workspace_admin(auth.uid()) and user_id <> auth.uid())
  with check (is_workspace_admin(auth.uid()) and user_id <> auth.uid());

-- The same reasoning applies to deletion: removing your own membership row is
-- another way to escape a role change or an audit trail.
drop policy if exists workspace_members_delete on workspace_members;
create policy workspace_members_delete on workspace_members for delete to authenticated
  using (is_workspace_admin(auth.uid()) and user_id <> auth.uid());

-- ---------------------------------------------------------------------------
-- 2. profiles.id and profiles.email were mutable by their owner
-- ---------------------------------------------------------------------------
-- The profiles_update policy correctly limits a user to their own row, but a
-- policy cannot restrict which columns that update touches. Email is the key
-- the entire invite system matches on: handle_new_user looks up an invite by
-- the address, so a member able to rewrite their own email could align it with
-- a pending administrator invite. The address belongs to the OAuth provider and
-- is mirrored from auth.users, so it is not the user's to edit here.

create or replace function guard_profile_immutable_columns()
returns trigger
language plpgsql
as $$
begin
  if new.id is distinct from old.id then
    raise exception 'PROFILE_ID_IMMUTABLE';
  end if;

  if new.email is distinct from old.email then
    raise exception 'PROFILE_EMAIL_IMMUTABLE';
  end if;

  return new;
end;
$$;

drop trigger if exists guard_profile_immutable_columns on profiles;
create trigger guard_profile_immutable_columns
  before update on profiles
  for each row execute function guard_profile_immutable_columns();

-- ---------------------------------------------------------------------------
-- 3. fanout_notifications leaked issue content across project boundaries
-- ---------------------------------------------------------------------------
-- The function parses recipient ids out of data-mention-id attributes in
-- comment HTML, which is attacker-controlled: a member could mention any user
-- id in the workspace, including someone with no access to the project, and the
-- resulting notification carried the issue title and a text rendering of the
-- comment. Because the function is SECURITY DEFINER, the insert bypassed RLS
-- entirely, so nothing downstream caught it.
--
-- Every candidate recipient is now checked against is_project_member for the
-- issue's own project before a row is written. A mention of someone outside the
-- project is silently dropped rather than raising, since the commenter should
-- not learn whether that account exists.

create or replace function fanout_notifications()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  target_issue uuid;
  target_project uuid;
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

  select name, project_id into issue_title, target_project
    from issues where id = target_issue;

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
    -- The check that stops a mention reaching outside the project.
    and is_project_member(candidate.user_id, target_project)
  order by candidate.user_id, candidate.rank;

  return null;
end;
$$;
