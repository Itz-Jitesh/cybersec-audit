-- 0015_drop_issue_archive.sql
-- Remove issue archiving, and hold deletion to the workspace admin roles.
--
-- Archiving was available to any project member — archiveIssue guarded on
-- issue.write — so a member could make an issue disappear from every list in
-- the application, and the only route back was another member noticing and
-- unarchiving it. On the live database that had already happened: the single
-- issue in the project was archived, which is why the lists looked empty.
--
-- The user's decision is that there is no archive at all. An issue is in a
-- state — backlog, current, completed, cancelled — and that is the whole of its
-- lifecycle. Removing something for good is deletion, and deletion belongs to
-- admin, president and co_president alone.
--
-- Dropping the column would take the three partial indexes with it, so they are
-- rebuilt first without the predicate. Every archived issue becomes an ordinary
-- issue again, which is the intended outcome rather than a side effect.
--
-- docs/04-DATA-MODEL.md still documents issues.archived_at. The user's
-- instruction is newer than the document.

drop index if exists issues_project_id_state_id_idx;
drop index if exists issues_project_id_sort_order_idx;
drop index if exists issues_target_date_idx;

alter table issues drop column if exists archived_at;

create index if not exists issues_project_id_state_id_idx
  on issues (project_id, state_id);
create index if not exists issues_project_id_sort_order_idx
  on issues (project_id, sort_order);
create index if not exists issues_target_date_idx
  on issues (target_date) where target_date is not null;

-- Deletion is the only irreversible act left on an issue, so it is held to the
-- workspace admin roles rather than to project management. A team lead runs
-- their team's work; erasing the record of it is not part of that.
drop policy if exists issues_delete on issues;
create policy issues_delete on issues for delete to authenticated
  using (is_workspace_admin(auth.uid()));
