# Manual test walkthrough — CyberSec Atria IT Tracker

One end-to-end pass: create a sandbox, drive an issue through its whole life,
exercise cycles, modules and pages, then delete every trace of it.

Work top to bottom. Each step says what to click and what you should see. A step
marked **✗** describes something that must *not* happen — if it does, that is a
bug, note the step number.

The previous phase-by-phase guide is kept at `test.md.bak`.

**Time:** about 45 minutes for the full pass, 15 for the issue lifecycle alone
(§3–§5).

---

## Contents

- [0. Before you start](#0-before-you-start)
- [1. Sign in and the shell](#1-sign-in-and-the-shell)
- [2. Build the sandbox](#2-build-the-sandbox-team--project)
- [3. Create an issue](#3-create-an-issue)
- [4. Comment, mention, react](#4-comment-mention-react)
- [5. Edit the issue and finish it](#5-edit-the-issue-and-finish-it)
- [6. Cycles](#6-cycles)
- [7. Modules](#7-modules)
- [8. Pages](#8-pages)
- [9. Views, search, notifications, analytics](#9-views-search-notifications-analytics)
- [10. Permissions spot-check](#10-permissions-spot-check)
- [11. Tear down every test artefact](#11-tear-down-every-test-artefact)
- [12. Automated suites](#12-automated-suites)
- [Known gaps](#known-gaps)

---

## 0. Before you start

### Run it

```
pnpm install
pnpm dev            # http://localhost:3000
```

Against production instead, just use the deployed URL — every step below works
either way. Note that anything you create in production is real data for the
club, which is why §11 exists.

### Naming convention — makes cleanup safe

Prefix **everything** you create with `ZZTEST`. At the end you delete by that
prefix and cannot mistake a test row for real work.

| Artefact | Name to use |
|---|---|
| Team | `ZZTEST Team` |
| Project | `ZZTEST Project`, identifier `ZZT` |
| Issue | `ZZTEST issue one` … |
| Cycle | `ZZTEST Sprint` |
| Module | `ZZTEST Module` |
| Page | `ZZTEST Page` |

### Accounts

| Who | Used for |
|---|---|
| Your admin account (`itsjitesh.work@gmail.com`) | Everything in §2–§9 and all of §11 |
| A second account, plain **member** role | §10 only — the isolation checks |
| The **mentor** account (Deva Kumar) | §10 only — the whole-workspace read checks |

Only a workspace admin can delete a project or a team, so **do §11 as the
admin**.

---

## 1. Sign in and the shell

**1.1** Open the app signed out. ✓ You land on `/sign-in`. ✗ No other route
should render anything; they all bounce here.

**1.2** Sign in with Google. If your role is admin, president or co-president,
you are sent to `/mfa` to enrol TOTP before anything else. Complete it with
Google Authenticator or Authy. ✓ You land on `/home`.

**1.3** Look at the left sidebar. ✓ Three primary links — **Home**, **My
Issues**, **Notifications** (with an unread badge when you have any) — then
**Favorites**, then the team/project tree, then **Settings** at the bottom.

**1.4** Look at the header. ✓ Breadcrumbs, a **search** button showing `⌘K`, the
notification bell, your avatar. ✗ There is **no `+` / New issue button** in the
header — it was removed; issue creation lives on the issues screen.

**1.5** Press `Cmd+\`. ✓ Sidebar collapses to icons. Reload the page. ✓ It stays
collapsed — the preference is persisted.

**1.6** Press `?`. ✓ A shortcut cheat sheet dialog opens. Esc closes it.

---

## 2. Build the sandbox (team + project)

**2.1** Go to `/admin` → **Teams**. Create a team named `ZZTEST Team`.
✓ Toast, and the team appears in the list and in the sidebar tree.

**2.2** Create a project. Click the **`+`** next to your name in the sidebar
footer (that one is *New project* and stays).

| Field | Value |
|---|---|
| Name | `ZZTEST Project` |
| Identifier | `ZZT` |
| Team | `ZZTEST Team` |
| Lead | yourself |
| Icon | any emoji |

✓ The identifier field checks availability as you type — green when free, an
error when taken. ✓ On save you are a **project admin** and the project appears
in the tree under `ZZTEST Team`.

**2.3** Open `/projects/<id>/settings` → **States**. ✓ Six states exist,
created automatically:

| State | Group | Meaning for "done" |
|---|---|---|
| Backlog | backlog | open |
| **Todo** | unstarted | open — the default for new issues |
| In Progress | started | open |
| In Review | started | open |
| **Done** | completed | **counts as finished** |
| Cancelled | cancelled | closed, not finished |

✓ The **Labels** tab has seven default labels.

**2.4** Still in settings, note the five tabs: General, Members, States, Labels,
Danger zone. You will come back to Danger zone in §11.

---

## 3. Create an issue

**3.1** Open the project → **Issues**. Press `C` (or click **New issue** — the
button on this screen, top right of the list header).

**3.2** Fill the modal:

- **Title** — `ZZTEST issue one`
- **Description** — type a few lines in the rich editor; try **bold**, a bullet
  list and a code block
- **Assignee** — yourself
- **Priority** — `High`
- **Labels** — pick one
- **Cycle / Modules** — leave empty for now (you create them in §6 and §7)

Save. ✓ The row appears in the **Todo** group with identifier **`ZZT-1`**.

**3.3** Create two more (`ZZTEST issue two`, `ZZTEST issue three`). ✓ They get
`ZZT-2` and `ZZT-3` — the counter is per project and never reuses a number.

**3.4** Try the layouts: press `1` `2` `3` `4` for list, kanban, calendar,
spreadsheet. ✓ Each renders your three issues. ✓ On kanban, drag `ZZT-2` from
Todo to In Progress — the state changes and sticks after a reload.

**3.5** Press `/`. ✓ The filter search box focuses. Type `ZZTEST`. ✓ Only your
issues remain. Clear it.

---

## 4. Comment, mention, react

**4.1** Click the row `ZZT-1`. ✓ A **peek overlay** opens over the list — the
list is still behind it. ✗ It must not say "You do not have access to this
issue"; if it does, capture the server log, that was a real bug.

**4.2** Click the **maximise** icon in the overlay's top bar. ✓ You go to the
full page `/projects/<id>/issues/<issueId>`.

**4.3** Scroll to **Comments**. Write one with plain text and send.
✓ It appears immediately with your avatar and a relative timestamp.

**4.4** Write a second comment containing `@` and pick a project member.
✓ Autocomplete offers members; the mention renders as a chip. ✓ That person gets
a **notification** (check with their account, or see §9.3).

**4.5** Hover a comment → react. ✓ Seven emoji are offered: 👍 🎉 🚀 👀 😄 😕 ❤️.
Click 🚀. ✓ The count shows 1. Click it again. ✓ It toggles back off — a
reaction is per person per emoji.

**4.6** Open the **⋯** menu on your own comment. ✓ It offers **Delete** and
nothing else — there is no edit control in the UI today (see
[Known gaps](#known-gaps)). ✗ On someone else's comment the menu must not appear
at all, unless you are a project manager.

**4.7** Delete one comment. ✓ Gone. Author or project manager only, checked on
the server and not merely hidden.

**4.8** Open the **Activity** feed on the same page. ✓ Entries for the create
and for every field change so far, each naming who did it. These are written by
database triggers, never by the app.

---

## 5. Edit the issue and finish it

Everything here is editable at any time, in any state. There is no lock after
assigning and none after finishing.

**5.1 — Rename.** Edit the title inline on the full page. ✓ Saves on blur, and
the activity feed gains a rename entry.

**5.2 — Description.** Change the body. ✓ Autosaves. Reload to confirm.

**5.3 — Add a second assignee.** Open the assignee control in the right column
and add another member, keeping yourself. ✓ Both avatars show. Issues are
many-assignee; adding later is normal, not an edge case. ✓ Only the newly added
person is notified.

**5.4 — Remove an assignee**, then add them back. ✓ Two separate activity
entries, no duplicates.

**5.5 — Dates and estimate.** Set a start date, a target date and an estimate.
✓ All persist.

**5.6 — Sub-issues.** The full page shows a **Sub-issues** section with a
completion rollup *when the issue already has children*. There is no control to
create one, and no relations section at all — both are in
[Known gaps](#known-gaps). Skip this step.

**5.7 — Link.** Add an external URL in the **Links** section. ✓ It appears and
opens. Try `javascript:alert(1)` as the URL. ✗ It must be refused — unsafe
schemes are rejected server-side.

**5.8 — Attachments.** The section lists files when an issue has them, but there
is no upload control in the UI. Skip this step.

**5.9 — Subscribe.** Toggle **Subscribe** off and on. ✓ Governs whether later
changes notify you.

**5.10 — Finish it.** Set the state of `ZZT-1` to **Done** (state dropdown on the
page, or drag to the Done column on kanban, or select rows and bulk-update).

✓ The issue leaves the open groups. ✓ A completion timestamp is stamped by the
`set_completed_at` trigger — visible in analytics and cycle burndown.

**5.11 — Reopen it.** Set it back to **In Progress**. ✓ Allowed, and the
completion timestamp is cleared again, so it stops counting as finished. Set it
back to **Done** when you are satisfied.

**5.12 — Bulk update.** Select `ZZT-2` and `ZZT-3` with the checkboxes (or
Shift+↑/↓). ✓ A bulk bar appears offering state, priority, add-assignee,
add-label and archive. Set both to `Low` priority. ✓ Both rows update at once.

**5.13 — Archive.** Archive `ZZT-3` from its row menu. ✓ It disappears from the
list. Note there is **no restore path in the UI** and no archived view — once
archived, an issue is out of sight until the project is deleted. Archive only
`ZZT-3`, so the rest stay testable.

---

## 6. Cycles

A cycle is a time-boxed sprint. **An issue belongs to at most one cycle.**

**6.1** Project → **Cycles** → **New cycle**.

| Field | Value |
|---|---|
| Name | `ZZTEST Sprint` |
| Start date | today |
| End date | a week out |
| Description | optional |

✓ Created with status derived from the dates — `active` when today falls inside
them.

**6.2** Create a fourth issue, `ZZTEST issue four`, and **pick `ZZTEST Sprint` in
the Cycle dropdown of the create modal**. ✓ It is now in the cycle.

> The cycle can only be chosen **when the issue is created** — see
> [Known gaps](#known-gaps).

**6.3** Open the cycle. ✓ You get a **burndown chart**, progress by state and
assignee distribution. With one open issue the line is flat — that is correct,
not a broken chart.

**6.4** Set `ZZTEST issue four` to **Done**, reload the cycle. ✓ Progress moves
and the burndown reflects the completion.

**6.5** Create a second cycle, `ZZTEST Sprint 2`, starting after the first ends.

**6.6** Create `ZZTEST issue five` in `ZZTEST Sprint`, leave it in Todo, then
open `ZZTEST Sprint` → **Complete cycle**. Choose to transfer incomplete issues
to `ZZTEST Sprint 2`.

✓ The dialog reports how many moved. ✓ `ZZTEST issue five` is now in Sprint 2;
the Done one stayed behind as Sprint 1's record. ✓ Sprint 1 shows **completed**.

**6.7** Repeat on Sprint 2 but choose **move to backlog** instead. ✓ The issue's
cycle is cleared rather than reassigned.

**6.8** As a plain member (not lead, not project admin), ✗ **Complete cycle** and
**Delete cycle** must not work — they are project-manager operations.

---

## 7. Modules

A module is an epic-style grouping. **An issue may be in many modules** — this
is the difference from cycles.

**7.1** Project → **Modules** → **New module**.

| Field | Value |
|---|---|
| Name | `ZZTEST Module` |
| Lead | yourself |
| Status | `Planned` |
| Start / target date | anything |

**7.2** Open it → **Add issues**. Search `ZZTEST`. ✓ The project's issues are
offered. Add `ZZT-1` and `ZZT-2`.

**7.3** ✓ The progress bar reflects child completion — `ZZT-1` is Done, so it
should read one of two.

**7.4** Create `ZZTEST Module Two` and add `ZZT-1` to it as well. ✓ Allowed —
the same issue now sits in both modules. ✓ Both progress bars count it.

**7.5** Remove `ZZT-2` from `ZZTEST Module` with the row's remove control.
✓ Removed from the module. ✗ The issue itself must still exist in the project —
detaching is not deleting.

**7.6** Change the module status to `In progress`, then `Completed`. ✓ The status
chip follows.

**7.7** Back on the issues list, set **Group by → Module**. ✓ Issues group under
their modules, with an ungrouped bucket for the rest.

---

## 8. Pages

Pages are rich-text documents scoped to the project — meeting notes, writeups,
CTF solutions.

**8.1** Project → **Pages** → **New page**. Title `ZZTEST Page`. Leave it
**private**.

**8.2** In the editor, write headings, a bullet list, a checkbox list and a code
block. ✓ Content autosaves — the indicator shows *Saving…* then settles. Reload
to confirm it persisted.

**8.3** Toggle the page to **public**. ✓ Now every project member can open it.
Toggle back to private. ✓ Signed in as another project member, the private page
is not listed and not reachable — owner only.

**8.4** Create `ZZTEST Page Two`, public, and confirm a second project member can
read it but **not** edit it — editing is owner-gated.

---

## 9. Views, search, notifications, analytics

**9.1 — Views.** Project → **Views**. ✓ The screen lists saved views. ✗ There is
no *Save view* button on the issues screen any more — it was removed, so no new
views can be created from there. Existing views still open and apply.

**9.2 — Search.** Press `⌘K`. Type `ZZTEST`. ✓ Results span issues, cycles,
modules and pages. Enter jumps to the item. ✓ You only ever see rows from
projects you can read.

**9.3 — Notifications.** Open **Notifications** in the sidebar. ✓ The mention
from §4.4 and the assignment from §5.3 are listed. Mark one read, snooze
another, then **mark all read**. ✓ The sidebar badge clears.

**9.4 — My Issues.** Open **My Issues**. ✓ Every issue assigned to you across
every project you can see, with filters for state group and priority. ✓ The Done
one is hidden until you include closed issues.

**9.5 — Analytics.** Project → **Analytics**. ✓ Open vs closed over time, issues
by state, issues by assignee, cycle velocity, overdue count. With a handful of
test issues the charts are sparse — that is correct.

**9.6 — Realtime.** Open the same issues list in two browsers, signed in as two
different people. Change a state in one. ✓ The other updates within about a
second without a refresh.

---

## 10. Permissions spot-check

The part worth testing carefully, because a mistake here is a real hole.

**10.1 — Plain member, other team.** As the member account with no membership in
`ZZTEST Team`, open the project URL directly. ✓ You get "You do not have access
to this project", naming the team to ask. ✗ Never a blank page, a 500 or
"Something went wrong".

**10.2 — Plain member, same team.** Add the member to `ZZTEST Team` (team, not
project). Reopen the project. ✓ Now readable — team membership grants project
access. ✓ They can create and edit issues and comment. ✗ They cannot delete
issues, manage cycles or modules, or open project settings.

**10.3 — Mentor.** Sign in as the mentor (Deva Kumar), who belongs to **no**
team.

- ✓ The sidebar lists **every** team and its projects.
- ✓ They can open any project, read every issue, create issues, edit issues and
  comment.
- ✓ `⌘K` search returns results from projects they are not a member of.
- ✗ `/admin` refuses with "This area is for workspace admins".
- ✗ No invite control, no create-team control, no project settings, no delete.
- ✗ No **New project** `+` in the sidebar footer.

**10.4 — Admin.** ✓ Everything above plus `/admin` (members, invites, teams,
audit log), project settings, and deletion.

**10.5 — Audit log.** `/admin/audit`. ✓ Privileged actions you performed appear
— role changes, deletions. ✗ Nobody, admin included, can forge an entry; they
are trigger-written.

---

## 11. Tear down every test artefact

Delete in this order. Later steps are blocked until the earlier ones are done —
a team refuses to delete while it still owns projects.

Do this **as a workspace admin**: project and team deletion are admin-only, even
for a project you lead.

### 11.1 Pages

Project → **Pages** → delete `ZZTEST Page` and `ZZTEST Page Two` from the row
menu. ✓ Gone from the list.

### 11.2 Modules

Project → **Modules** → open each `ZZTEST` module → **Delete** → confirm.
✓ Deleted. ✓ The issues that were in them still exist — deleting a module never
deletes issues.

### 11.3 Cycles

Project → **Cycles** → open each `ZZTEST` cycle → **Delete cycle**.
A completed cycle offers Delete directly; an active one offers it as *Delete
instead* inside the complete dialog. ✓ Issues survive with their cycle cleared.

### 11.4 Issues

Either delete them one by one — row menu → **Delete**, which only appears if you
may delete — or skip straight to 11.5, since deleting the project removes every
issue with it.

✓ Deleting an issue that has labels, assignees and comments succeeds. ✗ No
foreign-key error.

### 11.5 Project

`/projects/<id>/settings` → **Danger zone** → **Delete project** → type
`ZZTEST Project` exactly → confirm.

✓ The project, its issues, states, labels, cycles, modules and pages all go.
✓ An audit entry `project.deleted` is written. ✗ The typed name must match
exactly — this is checked on the server, not only in the dialog.

### 11.6 Team

`/admin` → Teams → `ZZTEST Team` → **Delete** → type `ZZTEST Team` → confirm.

✓ Deleted. If it refuses with "Move or delete this team's projects first", you
missed a project — go back to 11.5.

### 11.7 Test member

If you invited a throwaway account, `/admin/members` → deactivate it, or
`/admin/invites` → revoke the invite if it was never accepted.

### 11.8 Verify nothing is left

```sql
select 'teams' as kind, name from teams where name ilike 'ZZTEST%'
union all select 'projects', name from projects where name ilike 'ZZTEST%'
union all select 'issues', name from issues where name ilike 'ZZTEST%'
union all select 'cycles', name from cycles where name ilike 'ZZTEST%'
union all select 'modules', name from modules where name ilike 'ZZTEST%'
union all select 'pages', title from pages where title ilike 'ZZTEST%';
```

✓ Zero rows. That is the end of the pass.

---

## 12. Automated suites

Run these before and after a manual pass. They do not need a browser and they
create and clean up their own fixtures.

| Command | Covers |
|---|---|
| `pnpm typecheck` | TypeScript, strict |
| `pnpm lint` | ESLint, zero warnings |
| `pnpm build:verify` | Production build into `.next-verify`, safe while `pnpm dev` runs |
| `pnpm db:test` | All seven SQL suites — RLS, auth, projects, views, modules, admin, my-issues |
| `pnpm test:sanitize` | 39 stored-XSS vectors against the rich-text sanitiser |
| `pnpm test:qr` | TOTP QR round-trip |
| `pnpm test:e2e` | Playwright |

✗ Never run plain `pnpm build` while a dev server is up — both own `.next` and
they will fight over it. Use `build:verify`.

---

## Known gaps

Not bugs to report — known, and recorded here so a tester does not spend time
hunting them.

1. **A cycle can only be set when an issue is created.** There is no cycle
   control on the issue detail page and none in the bulk bar, so an existing
   issue cannot be moved into a cycle from the UI. The server action for it
   exists and is unused.
2. **No way to create a saved view.** The *Save view* button was removed from
   the issues screen at the owner's request; the Views screen lists views but
   does not create them.
3. **Bulk edit adds, never removes.** The bulk bar can add assignees and labels
   to a selection but cannot strip them.
4. **No comment editing.** A comment can be deleted but not edited. The server
   action exists and has no caller, and the "· edited" marker it would set is
   already rendered.
5. **No sub-issue, parent or relation controls.** The detail page displays
   sub-issues if they exist, but nothing creates one, nothing sets a parent, and
   relations (blocks / blocked by / relates to / duplicate of) have no UI at all
   — display or otherwise. The actions exist and are unused.
6. **No attachment upload.** Attachments render when present; nothing in the UI
   uploads one.
7. **No way to unarchive.** Archiving hides an issue with no path back and no
   archived view to find it in.
8. **The mentor role can write.** Mentors may create and edit issues and comment
   everywhere by design, although `reference/02-PRD.md` §4.1 still describes the
   role as view-and-comment only. The code is the owner's intent; the document is
   out of date.
