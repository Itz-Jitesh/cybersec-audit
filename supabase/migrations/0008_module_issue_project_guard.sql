-- 0008_module_issue_project_guard.sql
--
-- module_issues policies checked membership of the *issue's* project and never
-- looked at the module's. Since anyone can create an issue in a project they
-- belong to, that let a member of one team attach their own issue to any
-- module in the workspace: the row satisfied the policy because the issue was
-- theirs, and the module was never consulted.
--
-- The fix asserts both sides — the caller must belong to the issue's project
-- and to the module's, and the two must be the same project. Attaching an
-- issue across projects is meaningless anyway, since a module belongs to one
-- project, so the equality is a data-integrity rule as much as an access one.
--
-- Found by supabase/tests/modules.sql assertion
-- "outsider cannot attach an issue to another project module".

create or replace function module_project_id(mid uuid) returns uuid
language sql stable security definer
set search_path = public, pg_temp
as $$
  select project_id from modules where id = mid
$$;

drop policy if exists module_issues_select on module_issues;
create policy module_issues_select on module_issues for select to authenticated
  using (
    is_project_member(auth.uid(), issue_project_id(issue_id))
    and is_project_member(auth.uid(), module_project_id(module_id))
  );

drop policy if exists module_issues_write on module_issues;
create policy module_issues_write on module_issues for insert to authenticated
  with check (
    issue_project_id(issue_id) = module_project_id(module_id)
    and is_project_member(auth.uid(), module_project_id(module_id))
  );

drop policy if exists module_issues_update on module_issues;
create policy module_issues_update on module_issues for update to authenticated
  using (
    is_project_member(auth.uid(), issue_project_id(issue_id))
    and is_project_member(auth.uid(), module_project_id(module_id))
  )
  with check (
    issue_project_id(issue_id) = module_project_id(module_id)
    and is_project_member(auth.uid(), module_project_id(module_id))
  );

drop policy if exists module_issues_delete on module_issues;
create policy module_issues_delete on module_issues for delete to authenticated
  using (
    is_project_member(auth.uid(), issue_project_id(issue_id))
    and is_project_member(auth.uid(), module_project_id(module_id))
  );
