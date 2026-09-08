-- 0004_rls.sql
-- Row level security for every public table, per docs/04-DATA-MODEL.md §9.
--
-- Three facts shape this file. First, policies are written for the
-- `authenticated` role only — the workspace is invite-only, so `anon` gets no
-- policies at all and can read nothing. Second, RLS is enabled but not forced:
-- the table owner (the `postgres` role Drizzle connects as) bypasses policies,
-- which is why every server action also enforces the same matrix through
-- assertCan() in src/lib/auth/permissions.ts. Authorization is enforced twice,
-- once per access path. Third, everything is idempotent — drop-if-exists
-- before create — so the file can be re-applied safely.
--
-- The five helpers are SECURITY DEFINER so their membership lookups bypass RLS
-- (a policy computing project membership cannot itself be denied that read)
-- and they are marked stable so a policy can call them per row without
-- rescanning more than necessary.

-- ---------------------------------------------------------------------------
-- Helper functions
-- ---------------------------------------------------------------------------

create or replace function is_active_member(uid uuid) returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from workspace_members
    where user_id = uid and is_active
  );
$$;

create or replace function is_workspace_admin(uid uuid) returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from workspace_members
    where user_id = uid
      and is_active
      and role in ('admin', 'president', 'co_president')
  );
$$;

create or replace function is_team_lead(uid uuid, tid uuid) returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select is_workspace_admin(uid) or exists (
    select 1 from team_members
    where team_id = tid and user_id = uid and role = 'lead'
  );
$$;

create or replace function is_project_member(uid uuid, pid uuid) returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select is_workspace_admin(uid) or exists (
    select 1
    from projects p
    left join project_members pm on pm.project_id = p.id and pm.user_id = uid
    left join team_members tm on tm.team_id = p.team_id and tm.user_id = uid
    where p.id = pid and (pm.id is not null or tm.id is not null)
  );
$$;

create or replace function can_manage_project(uid uuid, pid uuid) returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select is_workspace_admin(uid) or exists (
    select 1
    from projects p
    left join project_members pm on pm.project_id = p.id and pm.user_id = uid
    where p.id = pid
      and (
        is_team_lead(uid, p.team_id)
        or pm.role = 'admin'
      )
  );
$$;

-- Resolvers used by child-table policies. They are definer so that checking
-- visibility of an issue's project inside a policy is not itself subject to
-- the issues policies, which would recurse.

create or replace function issue_project_id(iid uuid) returns uuid
language sql stable security definer
set search_path = public, pg_temp
as $$
  select project_id from issues where id = iid
$$;

create or replace function comment_issue_id(cid uuid) returns uuid
language sql stable security definer
set search_path = public, pg_temp
as $$
  select issue_id from comments where id = cid
$$;

create or replace function cycle_project_id(cid uuid) returns uuid
language sql stable security definer
set search_path = public, pg_temp
as $$
  select project_id from cycles where id = cid
$$;

-- ---------------------------------------------------------------------------
-- Enable RLS everywhere
-- ---------------------------------------------------------------------------

do $$
declare
  target record;
begin
  for target in
    select tablename from pg_tables
    where schemaname = 'public'
    order by tablename
  loop
    execute format('alter table public.%I enable row level security', target.tablename);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Identity & membership
-- ---------------------------------------------------------------------------

-- profiles: readable by any active member; self-update only; rows are created
-- by the signup trigger and never deleted.

drop policy if exists profiles_select on profiles;
create policy profiles_select on profiles for select to authenticated
  using (is_active_member(auth.uid()));

drop policy if exists profiles_update on profiles;
create policy profiles_update on profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- workspace_members: the club roster. Admins manage it; members read it. This
-- is also the table a self-escalation attempt would hit, which the RLS suite
-- checks explicitly.

drop policy if exists workspace_members_select on workspace_members;
create policy workspace_members_select on workspace_members for select to authenticated
  using (is_active_member(auth.uid()));

drop policy if exists workspace_members_insert on workspace_members;
create policy workspace_members_insert on workspace_members for insert to authenticated
  with check (is_workspace_admin(auth.uid()));

drop policy if exists workspace_members_update on workspace_members;
create policy workspace_members_update on workspace_members for update to authenticated
  using (is_workspace_admin(auth.uid()))
  with check (is_workspace_admin(auth.uid()));

drop policy if exists workspace_members_delete on workspace_members;
create policy workspace_members_delete on workspace_members for delete to authenticated
  using (is_workspace_admin(auth.uid()));

-- invites: admin eyes only, all four operations.

drop policy if exists invites_select on invites;
create policy invites_select on invites for select to authenticated
  using (is_workspace_admin(auth.uid()));

drop policy if exists invites_insert on invites;
create policy invites_insert on invites for insert to authenticated
  with check (is_workspace_admin(auth.uid()));

drop policy if exists invites_update on invites;
create policy invites_update on invites for update to authenticated
  using (is_workspace_admin(auth.uid()))
  with check (is_workspace_admin(auth.uid()));

drop policy if exists invites_delete on invites;
create policy invites_delete on invites for delete to authenticated
  using (is_workspace_admin(auth.uid()));

-- ---------------------------------------------------------------------------
-- Teams
-- ---------------------------------------------------------------------------

drop policy if exists teams_select on teams;
create policy teams_select on teams for select to authenticated
  using (is_active_member(auth.uid()));

drop policy if exists teams_insert on teams;
create policy teams_insert on teams for insert to authenticated
  with check (is_workspace_admin(auth.uid()));

drop policy if exists teams_update on teams;
create policy teams_update on teams for update to authenticated
  using (is_team_lead(auth.uid(), id))
  with check (is_team_lead(auth.uid(), id));

drop policy if exists teams_delete on teams;
create policy teams_delete on teams for delete to authenticated
  using (is_workspace_admin(auth.uid()));

drop policy if exists team_members_select on team_members;
create policy team_members_select on team_members for select to authenticated
  using (is_active_member(auth.uid()));

drop policy if exists team_members_insert on team_members;
create policy team_members_insert on team_members for insert to authenticated
  with check (is_team_lead(auth.uid(), team_id));

drop policy if exists team_members_update on team_members;
create policy team_members_update on team_members for update to authenticated
  using (is_team_lead(auth.uid(), team_id))
  with check (is_team_lead(auth.uid(), team_id));

drop policy if exists team_members_delete on team_members;
create policy team_members_delete on team_members for delete to authenticated
  using (is_team_lead(auth.uid(), team_id));

-- ---------------------------------------------------------------------------
-- Projects, project members, states, labels
-- ---------------------------------------------------------------------------

drop policy if exists projects_select on projects;
create policy projects_select on projects for select to authenticated
  using (is_project_member(auth.uid(), id));

drop policy if exists projects_insert on projects;
create policy projects_insert on projects for insert to authenticated
  with check (is_team_lead(auth.uid(), team_id));

drop policy if exists projects_update on projects;
create policy projects_update on projects for update to authenticated
  using (can_manage_project(auth.uid(), id))
  with check (can_manage_project(auth.uid(), id));

drop policy if exists projects_delete on projects;
create policy projects_delete on projects for delete to authenticated
  using (is_workspace_admin(auth.uid()));

drop policy if exists project_members_select on project_members;
create policy project_members_select on project_members for select to authenticated
  using (is_project_member(auth.uid(), project_id));

drop policy if exists project_members_insert on project_members;
create policy project_members_insert on project_members for insert to authenticated
  with check (can_manage_project(auth.uid(), project_id));

drop policy if exists project_members_update on project_members;
create policy project_members_update on project_members for update to authenticated
  using (can_manage_project(auth.uid(), project_id))
  with check (can_manage_project(auth.uid(), project_id));

drop policy if exists project_members_delete on project_members;
create policy project_members_delete on project_members for delete to authenticated
  using (can_manage_project(auth.uid(), project_id));

-- states and labels share the projects pattern: members read, managers write.

drop policy if exists states_select on states;
create policy states_select on states for select to authenticated
  using (is_project_member(auth.uid(), project_id));

drop policy if exists states_insert on states;
create policy states_insert on states for insert to authenticated
  with check (can_manage_project(auth.uid(), project_id));

drop policy if exists states_update on states;
create policy states_update on states for update to authenticated
  using (can_manage_project(auth.uid(), project_id))
  with check (can_manage_project(auth.uid(), project_id));

drop policy if exists states_delete on states;
create policy states_delete on states for delete to authenticated
  using (can_manage_project(auth.uid(), project_id));

drop policy if exists labels_select on labels;
create policy labels_select on labels for select to authenticated
  using (is_project_member(auth.uid(), project_id));

drop policy if exists labels_insert on labels;
create policy labels_insert on labels for insert to authenticated
  with check (can_manage_project(auth.uid(), project_id));

drop policy if exists labels_update on labels;
create policy labels_update on labels for update to authenticated
  using (can_manage_project(auth.uid(), project_id))
  with check (can_manage_project(auth.uid(), project_id));

drop policy if exists labels_delete on labels;
create policy labels_delete on labels for delete to authenticated
  using (can_manage_project(auth.uid(), project_id));

-- ---------------------------------------------------------------------------
-- Issues and their child tables
-- ---------------------------------------------------------------------------
-- Members write issues (create, edit, archive-as-update); deletion is hard
-- delete, so it is reserved for managers. Child tables resolve their project
-- through the parent issue.

drop policy if exists issues_select on issues;
create policy issues_select on issues for select to authenticated
  using (is_project_member(auth.uid(), project_id));

drop policy if exists issues_insert on issues;
create policy issues_insert on issues for insert to authenticated
  with check (is_project_member(auth.uid(), project_id));

drop policy if exists issues_update on issues;
create policy issues_update on issues for update to authenticated
  using (is_project_member(auth.uid(), project_id))
  with check (is_project_member(auth.uid(), project_id));

drop policy if exists issues_delete on issues;
create policy issues_delete on issues for delete to authenticated
  using (can_manage_project(auth.uid(), project_id));

-- issue_assignees / issue_labels / issue_relations / issue_links /
-- issue_attachments / issue_subscribers: all follow the same pattern.
-- issue_activity is deliberately given no write policies: it is append-only
-- and written exclusively by triggers running as the definer owner.

drop policy if exists issue_assignees_select on issue_assignees;
create policy issue_assignees_select on issue_assignees for select to authenticated
  using (is_project_member(auth.uid(), issue_project_id(issue_id)));

drop policy if exists issue_assignees_write on issue_assignees;
create policy issue_assignees_write on issue_assignees for insert to authenticated
  with check (is_project_member(auth.uid(), issue_project_id(issue_id)));

drop policy if exists issue_assignees_update on issue_assignees;
create policy issue_assignees_update on issue_assignees for update to authenticated
  using (is_project_member(auth.uid(), issue_project_id(issue_id)))
  with check (is_project_member(auth.uid(), issue_project_id(issue_id)));

drop policy if exists issue_assignees_delete on issue_assignees;
create policy issue_assignees_delete on issue_assignees for delete to authenticated
  using (is_project_member(auth.uid(), issue_project_id(issue_id)));

drop policy if exists issue_labels_select on issue_labels;
create policy issue_labels_select on issue_labels for select to authenticated
  using (is_project_member(auth.uid(), issue_project_id(issue_id)));

drop policy if exists issue_labels_write on issue_labels;
create policy issue_labels_write on issue_labels for insert to authenticated
  with check (is_project_member(auth.uid(), issue_project_id(issue_id)));

drop policy if exists issue_labels_update on issue_labels;
create policy issue_labels_update on issue_labels for update to authenticated
  using (is_project_member(auth.uid(), issue_project_id(issue_id)))
  with check (is_project_member(auth.uid(), issue_project_id(issue_id)));

drop policy if exists issue_labels_delete on issue_labels;
create policy issue_labels_delete on issue_labels for delete to authenticated
  using (is_project_member(auth.uid(), issue_project_id(issue_id)));

drop policy if exists issue_relations_select on issue_relations;
create policy issue_relations_select on issue_relations for select to authenticated
  using (is_project_member(auth.uid(), issue_project_id(issue_id)));

drop policy if exists issue_relations_write on issue_relations;
create policy issue_relations_write on issue_relations for insert to authenticated
  with check (is_project_member(auth.uid(), issue_project_id(issue_id)));

drop policy if exists issue_relations_update on issue_relations;
create policy issue_relations_update on issue_relations for update to authenticated
  using (is_project_member(auth.uid(), issue_project_id(issue_id)))
  with check (is_project_member(auth.uid(), issue_project_id(issue_id)));

drop policy if exists issue_relations_delete on issue_relations;
create policy issue_relations_delete on issue_relations for delete to authenticated
  using (is_project_member(auth.uid(), issue_project_id(issue_id)));

drop policy if exists issue_links_select on issue_links;
create policy issue_links_select on issue_links for select to authenticated
  using (is_project_member(auth.uid(), issue_project_id(issue_id)));

drop policy if exists issue_links_write on issue_links;
create policy issue_links_write on issue_links for insert to authenticated
  with check (is_project_member(auth.uid(), issue_project_id(issue_id)));

drop policy if exists issue_links_update on issue_links;
create policy issue_links_update on issue_links for update to authenticated
  using (is_project_member(auth.uid(), issue_project_id(issue_id)))
  with check (is_project_member(auth.uid(), issue_project_id(issue_id)));

drop policy if exists issue_links_delete on issue_links;
create policy issue_links_delete on issue_links for delete to authenticated
  using (is_project_member(auth.uid(), issue_project_id(issue_id)));

drop policy if exists issue_attachments_select on issue_attachments;
create policy issue_attachments_select on issue_attachments for select to authenticated
  using (is_project_member(auth.uid(), issue_project_id(issue_id)));

drop policy if exists issue_attachments_write on issue_attachments;
create policy issue_attachments_write on issue_attachments for insert to authenticated
  with check (is_project_member(auth.uid(), issue_project_id(issue_id)));

drop policy if exists issue_attachments_update on issue_attachments;
create policy issue_attachments_update on issue_attachments for update to authenticated
  using (is_project_member(auth.uid(), issue_project_id(issue_id)))
  with check (is_project_member(auth.uid(), issue_project_id(issue_id)));

drop policy if exists issue_attachments_delete on issue_attachments;
create policy issue_attachments_delete on issue_attachments for delete to authenticated
  using (is_project_member(auth.uid(), issue_project_id(issue_id)));

drop policy if exists issue_subscribers_select on issue_subscribers;
create policy issue_subscribers_select on issue_subscribers for select to authenticated
  using (is_project_member(auth.uid(), issue_project_id(issue_id)));

drop policy if exists issue_subscribers_write on issue_subscribers;
create policy issue_subscribers_write on issue_subscribers for insert to authenticated
  with check (is_project_member(auth.uid(), issue_project_id(issue_id)));

drop policy if exists issue_subscribers_update on issue_subscribers;
create policy issue_subscribers_update on issue_subscribers for update to authenticated
  using (is_project_member(auth.uid(), issue_project_id(issue_id)))
  with check (is_project_member(auth.uid(), issue_project_id(issue_id)));

drop policy if exists issue_subscribers_delete on issue_subscribers;
create policy issue_subscribers_delete on issue_subscribers for delete to authenticated
  using (is_project_member(auth.uid(), issue_project_id(issue_id)));

-- Append-only, trigger-written. Readable through the parent issue's project;
-- no insert, update or delete policy exists on purpose.

drop policy if exists issue_activity_select on issue_activity;
create policy issue_activity_select on issue_activity for select to authenticated
  using (is_project_member(auth.uid(), issue_project_id(issue_id)));

-- ---------------------------------------------------------------------------
-- Cycles and modules
-- ---------------------------------------------------------------------------

drop policy if exists cycles_select on cycles;
create policy cycles_select on cycles for select to authenticated
  using (is_project_member(auth.uid(), project_id));

drop policy if exists cycles_insert on cycles;
create policy cycles_insert on cycles for insert to authenticated
  with check (can_manage_project(auth.uid(), project_id));

drop policy if exists cycles_update on cycles;
create policy cycles_update on cycles for update to authenticated
  using (can_manage_project(auth.uid(), project_id))
  with check (can_manage_project(auth.uid(), project_id));

drop policy if exists cycles_delete on cycles;
create policy cycles_delete on cycles for delete to authenticated
  using (can_manage_project(auth.uid(), project_id));

-- Snapshots are written by the burndown cron as the service role, which
-- bypasses RLS; members get read-only access for the chart.

drop policy if exists cycle_snapshots_select on cycle_snapshots;
create policy cycle_snapshots_select on cycle_snapshots for select to authenticated
  using (is_project_member(auth.uid(), cycle_project_id(cycle_id)));

drop policy if exists modules_select on modules;
create policy modules_select on modules for select to authenticated
  using (is_project_member(auth.uid(), project_id));

drop policy if exists modules_insert on modules;
create policy modules_insert on modules for insert to authenticated
  with check (can_manage_project(auth.uid(), project_id));

drop policy if exists modules_update on modules;
create policy modules_update on modules for update to authenticated
  using (can_manage_project(auth.uid(), project_id))
  with check (can_manage_project(auth.uid(), project_id));

drop policy if exists modules_delete on modules;
create policy modules_delete on modules for delete to authenticated
  using (can_manage_project(auth.uid(), project_id));

drop policy if exists module_issues_select on module_issues;
create policy module_issues_select on module_issues for select to authenticated
  using (is_project_member(auth.uid(), issue_project_id(issue_id)));

drop policy if exists module_issues_write on module_issues;
create policy module_issues_write on module_issues for insert to authenticated
  with check (is_project_member(auth.uid(), issue_project_id(issue_id)));

drop policy if exists module_issues_update on module_issues;
create policy module_issues_update on module_issues for update to authenticated
  using (is_project_member(auth.uid(), issue_project_id(issue_id)))
  with check (is_project_member(auth.uid(), issue_project_id(issue_id)));

drop policy if exists module_issues_delete on module_issues;
create policy module_issues_delete on module_issues for delete to authenticated
  using (is_project_member(auth.uid(), issue_project_id(issue_id)));

-- ---------------------------------------------------------------------------
-- Collaboration: comments and reactions
-- ---------------------------------------------------------------------------
-- Comments resolve their project through the parent issue. Authors may edit
-- their own comments; managers may delete any. Reactions are toggle rows:
-- create and remove your own, no update.

drop policy if exists comments_select on comments;
create policy comments_select on comments for select to authenticated
  using (is_project_member(auth.uid(), issue_project_id(issue_id)));

drop policy if exists comments_insert on comments;
create policy comments_insert on comments for insert to authenticated
  with check (
    author_id = auth.uid()
    and is_project_member(auth.uid(), issue_project_id(issue_id))
  );

drop policy if exists comments_update on comments;
create policy comments_update on comments for update to authenticated
  using (author_id = auth.uid())
  with check (author_id = auth.uid());

drop policy if exists comments_delete on comments;
create policy comments_delete on comments for delete to authenticated
  using (
    author_id = auth.uid()
    or can_manage_project(auth.uid(), issue_project_id(issue_id))
  );

drop policy if exists comment_reactions_select on comment_reactions;
create policy comment_reactions_select on comment_reactions for select to authenticated
  using (is_project_member(auth.uid(), issue_project_id(comment_issue_id(comment_id))));

drop policy if exists comment_reactions_insert on comment_reactions;
create policy comment_reactions_insert on comment_reactions for insert to authenticated
  with check (
    user_id = auth.uid()
    and is_project_member(auth.uid(), issue_project_id(comment_issue_id(comment_id)))
  );

drop policy if exists comment_reactions_delete on comment_reactions;
create policy comment_reactions_delete on comment_reactions for delete to authenticated
  using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Views and pages
-- ---------------------------------------------------------------------------
-- Owner sees everything of theirs. Public entries are additionally visible
-- through their scope: project views to project members, team views to that
-- team, workspace views to any active member.

drop policy if exists views_select on views;
create policy views_select on views for select to authenticated
  using (
    owner_id = auth.uid()
    or (
      access = 'public'
      and is_active_member(auth.uid())
      and (
        project_id is null
        or is_project_member(auth.uid(), project_id)
      )
      and (
        team_id is null
        or exists (
          select 1 from team_members tm
          where tm.team_id = views.team_id and tm.user_id = auth.uid()
        )
      )
    )
  );

drop policy if exists views_insert on views;
create policy views_insert on views for insert to authenticated
  with check (
    owner_id = auth.uid()
    and is_active_member(auth.uid())
    and (
      project_id is null
      or is_project_member(auth.uid(), project_id)
    )
  );

drop policy if exists views_update on views;
create policy views_update on views for update to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

drop policy if exists views_delete on views;
create policy views_delete on views for delete to authenticated
  using (
    owner_id = auth.uid()
    or (
      project_id is not null
      and can_manage_project(auth.uid(), project_id)
    )
    or (
      project_id is null
      and is_workspace_admin(auth.uid())
    )
  );

drop policy if exists pages_select on pages;
create policy pages_select on pages for select to authenticated
  using (
    owner_id = auth.uid()
    or (
      access = 'public'
      and is_active_member(auth.uid())
      and (
        project_id is null
        or is_project_member(auth.uid(), project_id)
      )
      and (
        team_id is null
        or exists (
          select 1 from team_members tm
          where tm.team_id = pages.team_id and tm.user_id = auth.uid()
        )
      )
    )
  );

drop policy if exists pages_insert on pages;
create policy pages_insert on pages for insert to authenticated
  with check (
    owner_id = auth.uid()
    and is_active_member(auth.uid())
    and (
      project_id is null
      or is_project_member(auth.uid(), project_id)
    )
  );

drop policy if exists pages_update on pages;
create policy pages_update on pages for update to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

drop policy if exists pages_delete on pages;
create policy pages_delete on pages for delete to authenticated
  using (
    owner_id = auth.uid()
    or (
      project_id is not null
      and can_manage_project(auth.uid(), project_id)
    )
    or (
      project_id is null
      and is_workspace_admin(auth.uid())
    )
  );

-- ---------------------------------------------------------------------------
-- Notifications, favorites, audit log
-- ---------------------------------------------------------------------------
-- notifications and audit_log have no insert policies: they are written
-- exclusively by triggers. notifications rows are private to their user, who
-- may mark them read or dismiss them.

drop policy if exists notifications_select on notifications;
create policy notifications_select on notifications for select to authenticated
  using (user_id = auth.uid());

drop policy if exists notifications_update on notifications;
create policy notifications_update on notifications for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists notifications_delete on notifications;
create policy notifications_delete on notifications for delete to authenticated
  using (user_id = auth.uid());

drop policy if exists favorites_select on favorites;
create policy favorites_select on favorites for select to authenticated
  using (user_id = auth.uid());

drop policy if exists favorites_insert on favorites;
create policy favorites_insert on favorites for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists favorites_update on favorites;
create policy favorites_update on favorites for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists favorites_delete on favorites;
create policy favorites_delete on favorites for delete to authenticated
  using (user_id = auth.uid());

-- Admin eyes only, and no writes from any client role.

drop policy if exists audit_log_select on audit_log;
create policy audit_log_select on audit_log for select to authenticated
  using (is_workspace_admin(auth.uid()));








