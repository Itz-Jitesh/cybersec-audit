-- 0013_subscriber_actor.sql
-- Pin issue_subscribers writes to the acting user.
--
-- The policies from 0004 tested project membership and nothing else, so any
-- member of a project could write a subscription row carrying somebody else's
-- user id, or delete somebody else's. Following an issue is a statement about
-- yourself; a teammate cannot make it for you, and cannot take it back.
--
-- It stopped being merely untidy when 0012 added notify_issue_subscribed: a
-- forged row now tells the team lead that a person started following an issue
-- they never asked to follow.
--
-- The application path was never the hole — toggleSubscription writes the
-- session's own id — but the Supabase client path carries a real session and is
-- governed by these policies alone, which is exactly the second enforcement path
-- the project requires.
--
-- auto_subscribe is unaffected: it is SECURITY DEFINER and runs as the table
-- owner, so it can still subscribe an assignee or a commenter on their behalf.
-- Idempotent.

drop policy if exists issue_subscribers_write on issue_subscribers;
create policy issue_subscribers_write on issue_subscribers for insert to authenticated
  with check (
    is_project_member(auth.uid(), issue_project_id(issue_id))
    and user_id = auth.uid()
  );

-- Nothing on the row is meaningfully editable — it is an issue id, a user id and
-- a timestamp — so an update may only ever touch your own row, and may not move
-- it to someone else.
drop policy if exists issue_subscribers_update on issue_subscribers;
create policy issue_subscribers_update on issue_subscribers for update to authenticated
  using (
    is_project_member(auth.uid(), issue_project_id(issue_id))
    and user_id = auth.uid()
  )
  with check (
    is_project_member(auth.uid(), issue_project_id(issue_id))
    and user_id = auth.uid()
  );

drop policy if exists issue_subscribers_delete on issue_subscribers;
create policy issue_subscribers_delete on issue_subscribers for delete to authenticated
  using (
    is_project_member(auth.uid(), issue_project_id(issue_id))
    and user_id = auth.uid()
  );
