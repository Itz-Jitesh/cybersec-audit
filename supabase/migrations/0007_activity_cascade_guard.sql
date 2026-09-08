-- 0007_activity_cascade_guard.sql
-- Deleting an issue with labels or assignees raised a foreign key violation.
--
-- issue_labels and issue_assignees cascade from issues. On a delete, Postgres
-- removes the issue row first and then fires the referential action that
-- removes the join rows, so log_label_activity and log_assignee_activity were
-- running with the parent already gone. Each tried to insert an
-- issue_activity row pointing at it:
--
--   insert or update on table "issue_activity" violates foreign key constraint
--   "issue_activity_issue_id_issues_id_fk"
--
-- The delete therefore failed outright for any issue that carried a label or an
-- assignee, which is most of them. It only surfaced now because the activity
-- triggers skip entirely when auth.uid() is null, and every test until this one
-- deleted its fixtures as the table owner rather than as a signed-in user.
--
-- The fix is to say what was always meant: a row disappearing because its issue
-- was deleted is not an unassignment or a label removal, and there is nothing
-- left to attach the entry to. Both functions now return early when the parent
-- issue is gone.

create or replace function log_assignee_activity()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor uuid := auth.uid();
  display text;
  target_issue uuid := coalesce(new.issue_id, old.issue_id);
begin
  if actor is null then
    return null;
  end if;

  -- The issue itself is being deleted; the cascade is not an unassignment.
  if not exists (select 1 from issues where id = target_issue) then
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

create or replace function log_label_activity()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor uuid := auth.uid();
  display text;
  target_issue uuid := coalesce(new.issue_id, old.issue_id);
begin
  if actor is null then
    return null;
  end if;

  if not exists (select 1 from issues where id = target_issue) then
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

-- The same reasoning applies when a label is deleted from project settings:
-- issue_labels cascades from labels too, and the label row is gone by the time
-- the trigger runs, so new_display would be null. That case is harmless — the
-- entry is still attached to a live issue — and is left recording the removal
-- with a null display, which the feed renders as "removed a label".
