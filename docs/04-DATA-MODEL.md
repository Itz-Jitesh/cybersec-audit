# 04 — Data Model

Postgres 15 on Supabase. All tables in `public` unless noted. All tables have RLS enabled. All PKs are `uuid default gen_random_uuid()` unless stated.

Common columns on every table: `created_at timestamptz not null default now()`, `updated_at timestamptz not null default now()` (maintained by a shared trigger).

---

## 1. Enums

```
workspace_role  : admin | president | co_president | member
team_role       : lead | member
project_role    : admin | member
state_group     : backlog | unstarted | started | completed | cancelled
priority        : urgent | high | medium | low | none
cycle_status    : upcoming | active | completed
module_status   : planned | in_progress | paused | completed | cancelled
relation_type   : blocks | blocked_by | relates_to | duplicate_of
view_access     : private | public
notification_type: mention | assigned | state_changed | commented | subscribed
```

---

## 2. Identity & membership

### `profiles`
Mirrors `auth.users`. Created by trigger on signup.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | FK → `auth.users.id`, on delete cascade |
| `email` | text unique not null | |
| `display_name` | text not null | defaults to email local-part |
| `avatar_url` | text | from OAuth provider, overridable |
| `bio` | text | |
| `github_handle` | text | |
| `linkedin_url` | text | |
| `last_seen_at` | timestamptz | updated on session refresh |

### `workspace_members`
There is exactly one workspace; this is effectively the club roster.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `user_id` | uuid unique not null | FK → profiles |
| `role` | workspace_role not null default `member` | |
| `is_active` | boolean not null default true | deactivation, not deletion |
| `joined_at` | timestamptz not null default now() | |

### `invites`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `email` | citext not null | |
| `role` | workspace_role not null default `member` | |
| `team_id` | uuid null | FK → teams, optional pre-assignment |
| `team_role` | team_role null | |
| `token` | uuid unique not null default gen_random_uuid() | |
| `invited_by` | uuid not null | FK → profiles |
| `expires_at` | timestamptz not null default now() + interval '7 days' | |
| `accepted_at` | timestamptz null | |

Unique partial index: `(email) where accepted_at is null` — one open invite per email.

### `teams`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `name` | text not null | "Tech", "Design", "R&D" |
| `slug` | text unique not null | `tech`, `design`, `rnd` |
| `description` | text | |
| `color` | text not null default `'#6b7280'` | |
| `logo_emoji` | text | |
| `created_by` | uuid not null | |

### `team_members`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `team_id` | uuid not null | FK → teams, cascade |
| `user_id` | uuid not null | FK → profiles, cascade |
| `role` | team_role not null default `member` | |

Unique: `(team_id, user_id)`.

---

## 3. Projects

### `projects`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `team_id` | uuid not null | FK → teams |
| `name` | text not null | |
| `identifier` | text not null | 2–5 uppercase chars, unique workspace-wide, e.g. `CTF` |
| `description` | text | |
| `icon_emoji` | text | |
| `cover_color` | text | |
| `lead_id` | uuid null | FK → profiles |
| `sequence_counter` | integer not null default 0 | drives `CTF-142` numbering |
| `is_archived` | boolean not null default false | |
| `created_by` | uuid not null | |

Unique: `upper(identifier)`.

### `project_members`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `project_id` | uuid not null | cascade |
| `user_id` | uuid not null | cascade |
| `role` | project_role not null default `member` | |

Unique: `(project_id, user_id)`.

### `states`
Workflow columns. Seeded per project on creation.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `project_id` | uuid not null | cascade |
| `name` | text not null | |
| `group` | state_group not null | |
| `color` | text not null | |
| `sequence` | double precision not null | fractional ordering, allows insert-between |
| `is_default` | boolean not null default false | exactly one true per project |

Default seed: Backlog(backlog) · Todo(unstarted, default) · In Progress(started) · In Review(started) · Done(completed) · Cancelled(cancelled).

### `labels`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `project_id` | uuid not null | cascade |
| `name` | text not null | |
| `color` | text not null | |

Unique: `(project_id, lower(name))`.

---

## 4. Issues

### `issues`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `project_id` | uuid not null | cascade |
| `sequence_id` | integer not null | assigned by trigger from `projects.sequence_counter` |
| `name` | text not null | max 500 chars, enforced by check |
| `description_html` | text | rendered TipTap output |
| `description_json` | jsonb | TipTap doc, source of truth for editing |
| `state_id` | uuid not null | FK → states |
| `priority` | priority not null default `none` | |
| `parent_id` | uuid null | FK → issues, self-referential, on delete set null |
| `cycle_id` | uuid null | FK → cycles, set null on cycle delete |
| `start_date` | date null | |
| `target_date` | date null | |
| `estimate_point` | smallint null | 0–21, Fibonacci-ish |
| `sort_order` | double precision not null | manual ordering within a group |
| `created_by` | uuid not null | |
| `completed_at` | timestamptz null | set by trigger when state group → completed |
| `archived_at` | timestamptz null | soft delete |

Unique: `(project_id, sequence_id)`.

### `issue_assignees`
`(id, issue_id, user_id)` — unique `(issue_id, user_id)`, both cascade.

### `issue_labels`
`(id, issue_id, label_id)` — unique `(issue_id, label_id)`, both cascade.

### `issue_relations`
`(id, issue_id, related_issue_id, relation_type, created_by)`.
Unique `(issue_id, related_issue_id, relation_type)`. Check `issue_id <> related_issue_id`.
Application creates the inverse row on `blocks`/`blocked_by`.

### `issue_links`
`(id, issue_id, url, title, created_by)`.

### `issue_attachments`
`(id, issue_id, storage_path, file_name, file_size, mime_type, uploaded_by)`. Files live in Supabase Storage bucket `attachments`, path `{project_id}/{issue_id}/{uuid}-{filename}`.

### `issue_activity`
Append-only. Written by trigger, never by application code.

| Column | Type |
|---|---|
| `id` | uuid PK |
| `issue_id` | uuid not null cascade |
| `actor_id` | uuid not null |
| `field` | text not null (`state`, `priority`, `assignee`, `label`, `cycle`, `module`, `target_date`, `name`, `description`, `created`) |
| `old_value` | text null |
| `new_value` | text null |
| `old_display` | text null (human-readable, denormalised so deleted labels still render) |
| `new_display` | text null |

Index: `(issue_id, created_at desc)`.

### `issue_subscribers`
`(id, issue_id, user_id)` — auto-created for creator, assignees, and commenters.

---

## 5. Cycles & modules

### `cycles`
`(id, project_id, name, description, start_date, end_date, status cycle_status, created_by)`.
`status` is maintained by a daily cron: `upcoming` if `start_date > today`, `active` if between, `completed` if `end_date < today`.
Constraint: no two non-completed cycles in a project may overlap in date range (enforce in application; a Postgres exclusion constraint is optional hardening).

### `cycle_snapshots`
For burndown charts. Written daily by cron for active cycles.
`(id, cycle_id, snapshot_date, total_issues, completed_issues, started_issues, pending_issues)`.
Unique `(cycle_id, snapshot_date)`.

### `modules`
`(id, project_id, name, description, lead_id, status module_status, start_date, target_date, sort_order, created_by)`.

### `module_issues`
`(id, module_id, issue_id)` — unique `(module_id, issue_id)`.

---

## 6. Views, pages, notifications, favorites

### `views`
`(id, project_id null, team_id null, name, description, filters jsonb, display_props jsonb, layout text, access view_access, owner_id, created_by)`.
`project_id null AND team_id null` = workspace-level view.
`filters` shape:
```json
{
  "state_group": ["started"],
  "priority": ["urgent","high"],
  "assignees": ["<uuid>"],
  "labels": [],
  "cycle": [],
  "module": [],
  "created_by": [],
  "target_date": { "op": "before", "value": "2026-10-01" },
  "search": ""
}
```
`display_props` shape:
```json
{ "groupBy":"state","orderBy":"sort_order","showSubIssues":true,
  "properties":{"id":true,"priority":true,"state":true,"assignee":true,
                "labels":true,"dueDate":true,"estimate":false,"subIssueCount":true} }
```

### `pages`
`(id, project_id null, team_id null, title, content_json jsonb, content_html text, access view_access, owner_id, is_archived, created_by)`.

### `notifications`
`(id, user_id, issue_id null, actor_id, type notification_type, title, body, read_at null, snoozed_till null)`.
Index: `(user_id, read_at, created_at desc)`.

### `favorites`
`(id, user_id, entity_type text, entity_id uuid, sort_order)` — unique `(user_id, entity_type, entity_id)`. `entity_type ∈ project | cycle | module | view | page`.

### `audit_log`
`(id, actor_id, action text, entity_type text, entity_id uuid, metadata jsonb)`. Written for: invite sent/revoked, role changed, member deactivated, project deleted, team deleted.

---

## 7. Required indexes

```sql
create index on issues (project_id, state_id) where archived_at is null;
create index on issues (project_id, sort_order) where archived_at is null;
create index on issues (cycle_id) where cycle_id is not null;
create index on issues (parent_id) where parent_id is not null;
create index on issues (target_date) where target_date is not null and archived_at is null;
create index on issue_assignees (user_id);
create index on issue_labels (label_id);
create index on module_issues (issue_id);
create index on comments (issue_id, created_at);
create index on notifications (user_id, read_at, created_at desc);
create index on project_members (user_id);
create index on team_members (user_id);

-- full-text search for Cmd+K
alter table issues add column search_vector tsvector
  generated always as (
    to_tsvector('english', coalesce(name,'') || ' ' || coalesce(description_html,''))
  ) stored;
create index on issues using gin (search_vector);
```

---

## 8. Triggers and functions

| Name | Fires | Does |
|---|---|---|
| `handle_new_user()` | after insert on `auth.users` | Validates invite, creates profile + workspace_member + team_member, marks invite accepted. Raises exception if no valid invite. |
| `set_updated_at()` | before update, all tables | `new.updated_at = now()` |
| `assign_issue_sequence()` | before insert on `issues` | Atomically increments `projects.sequence_counter`, sets `sequence_id` |
| `log_issue_activity()` | after insert/update on `issues` | Diffs old vs new, writes `issue_activity` rows |
| `log_assignee_activity()` | after insert/delete on `issue_assignees` | Writes activity row |
| `log_label_activity()` | after insert/delete on `issue_labels` | Writes activity row |
| `set_completed_at()` | before update on `issues` | Sets/clears `completed_at` when state group crosses into/out of `completed` |
| `fanout_notifications()` | after insert on `issue_activity`, `comments` | Inserts `notifications` rows for subscribers and mentioned users, excluding the actor |
| `auto_subscribe()` | after insert on `comments`, `issue_assignees` | Adds `issue_subscribers` row if absent |

---

## 9. RLS policy model

Helper functions (SECURITY DEFINER, `search_path = public`):

```sql
create function is_active_member(uid uuid) returns boolean
  -- exists in workspace_members with is_active

create function is_workspace_admin(uid uuid) returns boolean
  -- role in ('admin','president','co_president')

create function is_team_lead(uid uuid, tid uuid) returns boolean
  -- is_workspace_admin OR team_members row with role='lead'

create function is_project_member(uid uuid, pid uuid) returns boolean
  -- is_workspace_admin OR project_members row
  -- OR team_members row for the project's team

create function can_manage_project(uid uuid, pid uuid) returns boolean
  -- is_workspace_admin OR is_team_lead(uid, project.team_id)
  -- OR project_members role='admin'
```

Policy pattern per table:

| Table | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| `profiles` | any active member | trigger only | self only | never |
| `workspace_members` | any active member | admin | admin | admin |
| `invites` | admin | admin | admin | admin |
| `teams` | any active member | admin | admin or team lead | admin |
| `team_members` | any active member | admin or team lead | admin or team lead | admin or team lead |
| `projects` | `is_project_member` | admin or team lead | `can_manage_project` | admin |
| `project_members` | `is_project_member` | `can_manage_project` | `can_manage_project` | `can_manage_project` |
| `states`, `labels` | `is_project_member` | `can_manage_project` | `can_manage_project` | `can_manage_project` |
| `issues` | `is_project_member` | `is_project_member` | `is_project_member` | `can_manage_project` |
| `issue_*` join tables | via parent issue's project | `is_project_member` | `is_project_member` | `is_project_member` |
| `issue_activity` | via parent issue | trigger only (no client insert) | never | never |
| `cycles`, `modules` | `is_project_member` | `can_manage_project` | `can_manage_project` | `can_manage_project` |
| `comments` | via parent issue | `is_project_member` | author only | author or `can_manage_project` |
| `views`, `pages` | `access='public'` and project member, OR `owner_id = auth.uid()` | `is_project_member` | owner | owner or `can_manage_project` |
| `notifications` | `user_id = auth.uid()` | trigger only | `user_id = auth.uid()` | `user_id = auth.uid()` |
| `favorites` | self | self | self | self |
| `audit_log` | admin | trigger only | never | never |

**Critical:** the service-role key bypasses RLS entirely. It is used only in the invite-acceptance trigger path and admin operations. Never expose it to the client, never use it as a shortcut to "make the query work."

---

## 10. Verification requirement

Before Phase 4 is considered done, `supabase/tests/rls.sql` must exist and assert, for each of five simulated users (admin, president, tech lead, tech member, design member):
- can read own team's projects ✓
- **cannot read another team's projects ✗**
- cannot escalate own role ✗
- cannot insert `issue_activity` directly ✗
- cannot read another user's notifications ✗

If any of these pass when they should fail, stop and fix before building further.
