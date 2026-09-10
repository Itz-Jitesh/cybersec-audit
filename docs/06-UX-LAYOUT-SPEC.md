# 06 — UX & Layout Specification

Desktop-first. Breakpoint work is Phase 12. All measurements reference tokens from [[05-DESIGN-SYSTEM]].

---

## 1. Application shell

```
┌────────────┬──────────────────────────────────────────────────┐
│            │  Header (48px)                                   │
│  Sidebar   ├──────────────────────────────────────────────────┤
│  250px     │  Filter bar (40px, only on issue-listing routes)  │
│            ├──────────────────────────────────────────────────┤
│            │                                                  │
│            │  Content region (scrolls independently)          │
│            │                                                  │
└────────────┴──────────────────────────────────────────────────┘
```

- Sidebar and content scroll independently. The page body never scrolls.
- Sidebar collapses to 60px (icons only) via a toggle at its bottom or `Cmd+\`. State persisted in localStorage.
- Right-hand detail panel (348px) slides in over the content region on issue selection, pushing nothing.

### 1.1 Sidebar contents, top to bottom
1. **Workspace header** — logo mark (24px) + "CyberSec Atria IT" + chevron. Click opens dropdown: Settings, Invite members (admin only), Sign out.
2. **Primary nav** — Home, My Issues, Notifications (with unread count badge). `text-xs`, 28px row height.
3. **Favorites** — collapsible section, drag-reorderable, shows starred projects/cycles/views.
4. **Teams** — one collapsible group per team (Tech / Design / R&D). Each expands to its project list. Each project expands to: Issues, Cycles, Modules, Views, Pages.
5. **Footer** — user avatar + name, `+` new-project button, sidebar collapse toggle.

Nesting indentation: 12px per level. Max depth 3.

### 1.2 Header contents
`[Breadcrumbs: Team / Project / Section] ......... [Search icon] [+ New issue] [Notification bell] [Avatar]`

- Breadcrumbs are clickable, `text-sm`, `--text-200`, with `/` separators in `--text-400`.
- The `+ New issue` button is the primary accent button, `sm` size.

---

## 2. Route: `/sign-in`

Full-viewport, `--bg-100`. Centred card, max-width 400px, no border, no card background — just content on the canvas.

Vertical order: logo lockup (120px wide) → `text-2xl` "Sign in to CyberSec Atria IT" → `text-sm` `--text-300` "This workspace is invite-only" → 12px gap → "Continue with Google" button (full width, secondary style, Google mark left) → "Continue with GitHub" → 24px gap → `text-xs` footer "Need access? Contact a club admin."

Rejection state (no valid invite): replace buttons with an inline `--danger`-bordered notice, plus a "Back" link. Do not silently redirect — the user must understand why.

## 3. Route: `/invite/[token]`

Shows inviter name, assigned role, assigned team, expiry. Single primary button "Accept & sign in" which routes into the OAuth flow with the token in state. Expired/used token → dedicated message, not a 404.

## 4. Route: `/mfa`

TOTP challenge. 6-digit input (six separate boxes, auto-advance, paste-aware), "Verify" primary button, "Use recovery code" text link. Enrolment variant shows QR + secret text + confirmation input.

---

## 5. Route: `/home`

Grid, max-width 1200px, centred, 24px gutters.

- Greeting row: "Good evening, {first name}" `text-xl` + today's date `text-sm --text-300`.
- Row of 4 stat cards: Assigned to me · In progress · Overdue · Completed this cycle. Each: `text-2xs` uppercase label, `text-2xl` number, delta vs last week in `text-xs`.
- Two-column below: left = "Your issues" (compact list, 8 rows, click → peek overlay); right = "Recent activity" feed + "Active cycles" progress rings.
- Empty state if the user has no assignments: illustration-free `EmptyState` with "Nothing assigned yet" + "Browse projects" action.

## 6. Route: `/my-issues`

Identical machinery to the project issue view (filter bar, four layouts, group-by) but scoped to `issue_assignees.user_id = me` across every project the user can see. Adds a "Project" column/chip since issues span projects.

## 7. Route: `/projects/[projectId]/issues`

The core screen. Get this right and 60% of the app is done.

### 7.1 Filter bar (40px, sticky under header)
`[Layout switcher: 4 icon toggles] [Filters ▾] [Group by ▾] [Display ▾] ....... [applied filter chips] [Clear all]`

Applied filters render as removable chips **below** the bar on a second 32px row, only when filters exist.

### 7.2 List layout
- Grouped by the active group-by. Each group renders a header row: `StateIcon` + group name + count badge + `+` quick-add + collapse chevron. Header is sticky within the scroll container.
- Row (38px): `[drag handle (on hover)] [IssueIdBadge] [PriorityIcon] [title, truncated] .... [labels] [DateChip] [AvatarGroup] [state dropdown]`
- Every right-side chip is an inline dropdown trigger — changing priority, assignee, or state never requires opening the issue.
- Click on the title area opens the peek overlay. Click on a chip does not.
- Hover reveals: drag handle, and a `MoreHorizontal` menu at the far right (Copy link, Copy ID, Make sub-issue of…, Duplicate, Archive, Delete).
- Multi-select: `Shift+click` range, `Cmd+click` toggle. When ≥1 selected, a floating action bar appears bottom-centre: "N selected · Set state · Set priority · Assign · Add label · Archive · Cancel".

### 7.3 Kanban layout
- Horizontal scroll, columns 280px wide, 12px gap. Column header: `StateIcon` + name + count + `+` + `…`.
- Card: title (max 2 lines) → meta row (`IssueIdBadge`, `PriorityIcon`, labels) → footer row (`DateChip`, sub-issue count, `AvatarGroup` right-aligned).
- Drag between columns changes state; drag within column changes `sort_order`. Both optimistic.
- Columns are collapsible to a 40px vertical strip showing rotated name + count.
- Load 50 cards per column, then a "Load more" row.

### 7.4 Calendar layout
- Month grid, 7 columns. Header row with weekday names `text-2xs` uppercase `--text-300`.
- Day cell shows date number top-left; today's number is an accent-filled circle. Cells outside the current month are `--text-400`.
- Issues render as 20px chips (priority dot + truncated title). Max 3 chips, then "+N more" opens a popover.
- Drag a chip to another day → updates `target_date`.
- Month navigation `‹ ›` + "Today" button in the filter bar row.

### 7.5 Spreadsheet layout
- Sticky first column (ID + title). Remaining columns: State, Priority, Assignees, Labels, Start date, Target date, Estimate, Cycle, Module, Created by, Created at.
- Column headers clickable to sort (chevron indicator), draggable to reorder, resizable.
- Every cell is inline-editable via dropdown/popover on click.
- Row height 36px, 1px `--border-subtle` between rows, no vertical borders except after the sticky column.
- Virtualise above 100 rows.

## 8. Issue detail

Two presentations of the same component:
- **Peek overlay** — centred modal, 860px wide, 80vh, backdrop `rgb(0 0 0 / .5)`. Opened by clicking a row/card. `Esc` closes.
- **Full page** (`/issues/[issueId]`) — same content, no backdrop, breadcrumbs in header. Reached via "Open in full" or direct link.

Internal layout: main column (flexible) + right sidebar (280px, `--border-subtle` left border).

**Main column:** `IssueIdBadge` + `…` menu → `InlineEditableText` title (`text-xl`) → TipTap description (placeholder "Add a description…") → Sub-issues section (collapsible, progress "3/7", inline add) → Links → Attachments (drag-drop zone) → Relations → tabbed footer `Comments | Activity | All`.

**Right sidebar** — vertical stack of `[16px label, --text-300]  [value dropdown]` rows: State, Priority, Assignees, Labels, Cycle, Modules, Start date, Target date, Estimate, Parent. Below a separator: Created by + relative time, Updated relative time, "Subscribe" toggle, "Copy link".

**Comments:** avatar left (24px), name + relative time, body, reaction row. Editor at the bottom is collapsed to a single-line input until focused. `@` triggers member mention autocomplete.

**Activity:** one line per entry, 24px rows, `--text-300`, format "**Name** changed state from *Todo* to *In Progress* · 2h ago". Group consecutive entries by the same actor within 5 minutes.

## 9. Cycles

**List** (`/cycles`): three sections — Active, Upcoming, Completed. Active cycle gets a wide card: name, date range, `ProgressRing`, state distribution bar, assignee avatars, "View" button. Others get compact rows.

**Detail** (`/cycles/[cycleId]`): header with name, dates, days-remaining chip → tabs `Issues | Analytics`. Issues tab = the full four-layout view scoped to the cycle. Analytics tab = burndown line chart (ideal vs actual, from `cycle_snapshots`), donut of state distribution, horizontal bar of issues per assignee.

Completing a cycle opens a dialog listing incomplete issues with options: move to next cycle / move to backlog / leave as-is.

## 10. Modules

**List**: card grid, 3 columns. Card shows name, status chip, lead avatar, target date, progress bar with completed/total.
**Detail**: same structure as cycle detail, plus an editable description block at the top.

## 11. Views & Pages

**Views list**: rows with name, owner avatar, access chip (Private/Public), filter summary as chips, `…` menu (Duplicate, Edit, Delete). "Create view" captures the *current* filter state from wherever you were.

**Pages list**: rows with title, owner, updated-at, access chip. Detail is a full-width TipTap editor, max-width 800px centred, with a title input at top. Autosave with a `--text-300` "Saved" indicator.

## 12. Notifications

Bell in header opens a 400px popover with tabs `Inbox | Unread | Snoozed`. Item: actor avatar, bold actor name + action text, issue title in `--text-300`, relative time, unread dot on the left. Hover reveals per-item actions (mark read, snooze). Header has "Mark all read". Clicking navigates to the issue and scrolls to the relevant comment. Full page at `/notifications` shows the same list at full width.

## 13. Command palette (`Cmd+K`)

Centred, 640px, top-anchored at 20vh. Sections: Recent · Issues · Projects · Cycles · Modules · Pages · Members · Actions. Typing `>` switches to command-only mode. Actions include: Create issue, Create project, Go to my issues, Toggle sidebar, Sign out. Arrow keys navigate, `Enter` selects, `Esc` closes. Debounce search at 200ms.

## 14. Admin panel (`/admin`)

Left sub-nav within the content area: General · Members · Invites · Teams · Audit log.

- **Members**: table (avatar+name, email, workspace role dropdown, teams, last seen, status, `…`). Row actions: change role, deactivate, remove from team.
- **Invites**: pending list + "Invite members" modal supporting multiple emails at once (comma/newline separated), one role and team applied to the batch. Shows sent status per address.
- **Teams**: CRUD + membership management with lead designation.
- **Audit log**: reverse-chronological table, filterable by actor and action.

## 15. Keyboard shortcuts (implement in Phase 10)

| Key | Action |
|---|---|
| `Cmd+K` | Command palette |
| `C` | Create issue |
| `Cmd+\` | Toggle sidebar |
| `/` | Focus filter search |
| `1`–`4` | Switch layout |
| `Esc` | Close peek/modal, clear selection |
| `E` | Edit focused issue title inline |
| `Shift+↑/↓` | Extend selection |
| `?` | Shortcut cheat sheet |

## 16. Loading, empty, and error states — required for every route

- **Loading**: skeletons matching final layout geometry. `loading.tsx` per route segment.
- **Empty**: `EmptyState` with a specific action. Never a bare "No data".
- **Error**: `error.tsx` with the message, a "Try again" button, and a "Go home" link.
- **Permission denied**: distinct from 404. "You don't have access to this project" + "Request access" mailto to the team lead.
