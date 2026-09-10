# 02 — Product Requirements Document

## 1. Product summary

A private, invite-only project tracker for the CyberSec Atria IT club. Functionally equivalent to Plane's core product: workspace → teams → projects → issues, with cycles (sprints), modules (epics), multiple board views, realtime collaboration, and notifications.

**Not** a public product. No billing, no marketing site, no multi-tenant workspaces, no external guests.

## 2. Users and roles

| Role | Scope | Can |
|---|---|---|
| `admin` | Workspace | Everything. Invite/remove members, create/delete teams and projects, change any role, access admin panel. |
| `president` | Workspace | Everything except deleting the workspace and demoting an admin. |
| `co_president` | Workspace | Same as president. |
| `lead` | Team | Create/edit/archive projects within their team, manage team membership, full issue rights in team projects. |
| `member` | Team/Project | Create and edit issues, comment, self-assign, create personal views. Cannot delete projects or manage membership. |

Notes:
- Roles are **additive**: a user has one workspace role and zero-or-more team roles.
- `admin`/`president`/`co_president` implicitly have `lead` rights everywhere.
- There is no guest/visitor role. Everyone in the DB is a club member.

## 3. Hierarchy

```
Workspace (singleton: "CyberSec Atria IT")
└── Team (Tech, Design, R&D)
    └── Project (e.g. "Club Website", "CTF Platform")
        ├── Issue  (the atomic unit of work)
        ├── Cycle  (time-boxed sprint, issues belong to 0-or-1)
        ├── Module (feature grouping / epic, issues belong to 0-or-many)
        ├── View   (saved filter + layout)
        └── Page   (rich-text doc scoped to the project)
```

## 4. MVP feature list

### 4.1 Authentication & membership — MUST
- OAuth sign-in with Google and GitHub only. No password auth anywhere in the codebase.
- Sign-in is gated: a user's email must have a pending or accepted invite, or they are rejected with "This workspace is invite-only."
- Admin invite flow: admin enters email + workspace role + optional team assignment → email sent via Resend with a signed link.
- Two-factor authentication: **TOTP is the only supported second factor.** Optional per user, **enforced** for `admin`/`president`/`co_president`.
- Profile: display name, avatar, bio, GitHub/LinkedIn handle.

### 4.2 Issues — MUST
Every issue has: auto-incrementing per-project ID (`WEB-142`), title, rich-text description, state, priority, assignees (many), labels (many), start date, target date, parent issue (sub-issues), sub-issue rollup counts, attachments, links, relations (blocks / blocked by / relates to / duplicate of), comments with reactions, and a full activity log.

Operations: create (quick-add inline + full modal), inline edit from any view, bulk select + bulk update, drag-to-reorder, archive, delete (admin/lead only), convert to sub-issue, duplicate.

### 4.3 Views — MUST
Four layouts per project, switchable, with per-user persisted preference:
1. **List** — grouped rows with collapsible group headers
2. **Kanban** — drag-and-drop columns
3. **Calendar** — issues placed by target date, drag to reschedule
4. **Spreadsheet** — dense table, sortable columns, inline cell edit

Every layout supports: group-by (state / priority / assignee / label / cycle / module / created-by / none), filters (same fields + date ranges + text search), sort, and display properties toggle (which chips show on a card/row).

Saved Views: name + persisted filter set, `private` or `public` (visible to all project members).

### 4.4 Cycles — MUST
Time-boxed sprints with start/end dates. States: upcoming / active / completed. An issue belongs to at most one cycle. Cycle detail page shows burndown chart, progress by state, and assignee distribution. Transferring incomplete issues to the next cycle on completion.

### 4.5 Modules — MUST
Named groupings (epics) with optional lead, start/target dates, and status. Progress bar based on child issue completion. An issue may belong to multiple modules.

### 4.6 Collaboration — MUST
- Comments on issues, rich text, `@mention` of project members, emoji reactions, edit/delete own comments.
- Activity feed per issue, auto-generated from field changes ("X changed state from Todo to In Progress").
- In-app notification inbox: mentions, assignments, state changes on subscribed issues. Read/unread, snooze, mark-all-read.
- Realtime: any change made by another user appears within ~1s without refresh, across all views.

### 4.7 Search — MUST
Global `Cmd+K` palette: fuzzy search across issues, projects, cycles, modules, pages, and members. Also acts as a command runner (create issue, go to project, toggle theme).

### 4.8 Pages — SHOULD
Rich-text documents scoped to a project or team. Used for meeting notes, writeups, CTF solutions. Block editor with headings, lists, checkboxes, code blocks, images. Access: public-to-project or private.

### 4.9 Admin panel — MUST
Workspace settings (name, logo), member list with role editing and deactivation, pending invites, team CRUD, audit log of privileged actions.

### 4.10 Analytics — SHOULD
Per-project dashboard: open vs closed over time, issues by state, issues by assignee, cycle velocity across last 5 cycles, overdue issue count.

## 5. Explicitly out of scope for v1

- Public/shared issue boards or guest links
- Time tracking / worklogs
- Intake / issue-submission forms
- Gantt timeline view
- Email notifications for anything other than invites
- Import from Jira/Linear/GitHub
- Webhooks and public API
- Mobile native app
- Light theme
- Cybersecurity visual theming (Phase 13, separate effort)
- Drafts (unsubmitted issue composition) — removed, never implemented

## 6. Non-functional requirements

| Requirement | Target |
|---|---|
| Concurrent users | 30 sustained, 50 burst |
| Initial page load (LCP) | < 2.0s on 4G |
| View switch / filter apply | < 150ms perceived (optimistic UI) |
| Realtime propagation | < 1s p95 |
| Uptime | Best-effort; Vercel + Supabase free/pro tiers |
| Data retention | Soft-delete for issues (archive), hard-delete admin-only |
| Accessibility | Keyboard navigable throughout; focus rings visible; WCAG AA contrast on all text |
| Browser support | Latest Chrome, Firefox, Safari, Edge. No IE. |

## 7. Key user stories

- As an **admin**, I invite 20 club members by email in one sitting and assign each to a team, so that onboarding takes minutes not days.
- As a **tech lead**, I create a "CTF Platform" project, define a cycle for the next two weeks, and drag 12 issues into it.
- As a **member**, I open `Cmd+K`, type "auth", and jump straight to the issue I was working on.
- As a **member**, I drag an issue from "In Progress" to "In Review" and the lead sees it move on their screen without refreshing.
- As a **president**, I open the analytics tab to see which team has the most overdue issues before the weekly meeting.
- As any **user**, I get a notification when someone `@mentions` me, and clicking it takes me to that exact comment.

## 8. Success criteria for v1

- [ ] 20 members onboarded and signed in via OAuth
- [ ] Three teams live with at least one project each
- [ ] One full cycle run end-to-end (created → issues assigned → completed → incomplete transferred)
- [ ] Zero instances of a user seeing data from a project they aren't a member of (verified by RLS tests)
- [ ] Someone who has used Linear or Jira uses it without being told how
