# 05 — Design System

**Directive for v1: replicate Plane's app UI.** No cybersecurity theming. Every colour, radius, and spacing value is a CSS variable so the reskin later is a single-file edit.

---

## 1. Theming architecture

All tokens live in `src/app/globals.css` under `@layer base` on `:root`. Tailwind v4 consumes them via `@theme`. **Components never reference a hex value.**

```css
:root {
  /* surfaces — 100 is deepest, ascending = lighter/raised */
  --bg-100: #191b1b;
  --bg-90:  #1f2121;
  --bg-80:  #242626;
  --bg-70:  #2e3030;
  --bg-60:  #383a3a;

  /* text */
  --text-100: #e6e6e6;
  --text-200: #b9bbbb;
  --text-300: #878888;
  --text-400: #5c5e5e;

  /* borders */
  --border-subtle: #2e3030;
  --border-strong: #3f4141;
  --border-focus:  #3f76ff;

  /* accent */
  --accent:        #3f76ff;
  --accent-hover:  #3568e5;
  --accent-subtle: #3f76ff1a;
  --on-accent:     #ffffff;

  /* semantic */
  --success: #16a34a;  --warning: #f59e0b;
  --danger:  #ef4444;  --info:    #3b82f6;

  /* priority */
  --priority-urgent: #ef4444; --priority-high: #f97316;
  --priority-medium: #eab308; --priority-low: #3b82f6;
  --priority-none:   #6b7280;

  /* state groups */
  --state-backlog: #6b7280;  --state-unstarted: #9ca3af;
  --state-started: #f59e0b;  --state-completed: #16a34a;
  --state-cancelled: #ef4444;

  /* radii */
  --radius-sm: 4px;  --radius-md: 6px;
  --radius-lg: 8px;  --radius-full: 9999px;

  /* elevation */
  --shadow-sm: 0 1px 2px rgb(0 0 0 / .3);
  --shadow-md: 0 4px 12px rgb(0 0 0 / .35);
  --shadow-lg: 0 12px 32px rgb(0 0 0 / .45);

  /* layout */
  --sidebar-w: 250px;
  --sidebar-w-collapsed: 60px;
  --header-h: 48px;
  --detail-panel-w: 348px;
  --row-h: 38px;
}
```

> **Replace these hexes with the values you extracted from `app.plane.so` in [[01-PRE-BUILD-CHECKLIST]] step E.** These are approximations. The structure is what matters; the values are yours to correct.

Later reskin = rewrite this block only. Zero component changes.

---

## 2. Typography

| Role | Family | Where |
|---|---|---|
| UI | `Inter` (`next/font/google`, weights 400/500/600, `--font-sans`) | Everything |
| Mono | `JetBrains Mono` (weights 400/500, `--font-mono`) | Issue IDs, code blocks, kbd chips |

Scale (matches Tailwind config exactly):

| Class | Size/LH | Weight | Usage |
|---|---|---|---|
| `text-2xs` | 10/14 | 500 | Counts, tiny badges |
| `text-xs` | 11/16 | 400–500 | Metadata, breadcrumbs, sidebar |
| `text-sm` | 13/20 | 400–500 | **Default body** |
| `text-base` | 14/20 | 500 | Issue titles in rows |
| `text-lg` | 16/24 | 500 | Section/modal headings |
| `text-xl` | 20/28 | 600 | Issue detail title |
| `text-2xl` | 24/32 | 600 | Page titles |

Rules:
- `letter-spacing: -0.01em` on `text-lg` and above.
- Never use font weights 700+. Plane's density comes from weight restraint.
- Never centre body text. Left-align everything except empty states.

---

## 3. Spacing

4px base grid. Only use multiples: `4, 8, 12, 16, 20, 24, 32, 40, 48, 64`.

| Context | Padding |
|---|---|
| Sidebar item | `6px 10px` |
| List row | `8px 12px` |
| Card (kanban) | `10px 12px` |
| Modal | `20px 24px` |
| Dropdown item | `6px 8px` |
| Page container | `24px` horizontal, `16px` top |
| Button (default) | `6px 12px`, height 32px |
| Button (sm) | `4px 8px`, height 26px |
| Input | `6px 10px`, height 32px |

---

## 4. Component inventory

### 4.1 shadcn/ui primitives to install (unmodified)
`button` `input` `textarea` `select` `checkbox` `switch` `radio-group` `label` `dialog` `sheet` `popover` `dropdown-menu` `context-menu` `command` `tooltip` `tabs` `avatar` `badge` `separator` `scroll-area` `skeleton` `progress` `calendar` `alert-dialog` `collapsible` `toggle-group` `sonner`

### 4.2 Shared custom components (`components/shared/`)

| Component | Props | Notes |
|---|---|---|
| `PriorityIcon` | `priority`, `size` | Signal-bar icon, colour from token. Urgent = filled square with `!`. |
| `StateIcon` | `group`, `color`, `size` | Circle with partial fill by group. Backlog = dashed, completed = filled check. |
| `MemberAvatar` | `user`, `size` (16/20/24/28) | Initials fallback on deterministic colour from user id hash. |
| `AvatarGroup` | `users`, `max` | Overlapping −6px, `+N` chip beyond max. |
| `LabelChip` | `label`, `removable` | 11px, dot + name, `--radius-full`, 1px border of label colour at 30% alpha. |
| `DateChip` | `date`, `variant` | Red when overdue and issue not completed. |
| `IssueIdBadge` | `identifier`, `sequenceId` | Mono, `text-xs`, `--text-300`. |
| `Kbd` | `keys[]` | Mono 10px, `--bg-70` bg, 3px radius. |
| `EmptyState` | `icon`, `title`, `description`, `action` | Centred, max-width 320px, `--text-300` body. |
| `ProgressRing` | `value`, `size` | Cycle/module completion. |
| `InlineEditableText` | `value`, `onSave` | Click-to-edit, Enter saves, Esc cancels. Used for titles everywhere. |

### 4.3 Domain components

**Issues**: `IssueListRow`, `IssueKanbanCard`, `IssueSpreadsheetRow`, `IssueCalendarChip`, `IssueDetailPanel`, `IssueQuickAdd`, `IssueCreateModal`, `IssuePeekOverlay`, `SubIssueList`, `IssueRelationsList`, `IssueActivityFeed`, `CommentEditor`, `CommentItem`, `AttachmentList`

**Filtering**: `FilterBar`, `FilterDropdown`, `AppliedFilterChips`, `GroupByDropdown`, `DisplayPropsPopover`, `LayoutSwitcher`, `SortDropdown`

**Views**: `ListLayout`, `KanbanLayout`, `CalendarLayout`, `SpreadsheetLayout`, `GroupHeader`, `VirtualisedList`

**Layout**: `AppSidebar`, `SidebarProjectTree`, `SidebarFavorites`, `WorkspaceSwitcher`, `Header`, `Breadcrumbs`, `CommandPalette`, `NotificationPopover`, `UserMenu`

---

## 5. Interaction specification

| Element | Default | Hover | Active/Selected | Focus |
|---|---|---|---|---|
| Sidebar item | transparent | `--bg-80` | `--bg-70` + `--text-100` | ring 1px `--border-focus` |
| List row | transparent | `--bg-90` | `--bg-80` + left 2px `--accent` bar | ring inset |
| Kanban card | `--bg-80`, border `--border-subtle` | border `--border-strong`, `--shadow-sm` | — | ring |
| Button primary | `--accent` | `--accent-hover` | translateY(0), no scale | ring offset 2px |
| Button secondary | `--bg-80`, border subtle | `--bg-70` | — | ring |
| Dropdown item | transparent | `--bg-70` | check icon on left | — |

Motion:
- Transitions: `120ms ease-out` for colour/background, `160ms ease-out` for transform/opacity.
- Modals/sheets: fade + 4px translate, 180ms.
- **No spring physics, no bounce, no scale-on-hover.** Expensive software feels immediate, not animated.
- Drag: card gets `--shadow-lg`, `opacity: .9`, `rotate(1.5deg)`. Drop placeholder is a 2px dashed `--border-strong` outline.
- Skeletons pulse at 1.6s; never show a spinner for anything under 400ms.

---

## 6. Icons

`lucide-react` only, stroke width **1.5**, sizes 14/16/18. Never mix stroke widths in one row.

Canonical mappings: Issues `CircleDot` · Cycles `RefreshCw` · Modules `Layers` · Views `Bookmark` · Pages `FileText` · Analytics `BarChart3` · Settings `Settings` · Team `Users` · Project `Box` · Search `Search` · Notifications `Bell` · Add `Plus` · Filter `ListFilter` · Display `SlidersHorizontal` · More `MoreHorizontal`.

---

## 7. Accessibility floor

- All interactive elements reachable by Tab, with a visible 1px `--border-focus` ring at 2px offset.
- Every icon-only button has `aria-label`.
- Kanban drag has a keyboard fallback: focus card → `Space` to lift → arrows to move → `Space` to drop (dnd-kit provides this; do not disable it).
- Body text contrast ≥ 4.5:1 against its surface. `--text-400` is for disabled states only, never for readable content.
- `prefers-reduced-motion` disables all transforms and reduces transitions to 0ms.

---

## 8. Reskin hook (for later, do not build now)

When the cybersec theme arrives, the change surface is:
1. `globals.css` token block — new palette
2. `next/font` declaration — if the display font changes
3. `public/brand/*` — already yours
4. Optionally a `--font-display` token applied only to page titles

Anything that would require touching component files to reskin is a design-system bug. Fix it at the token layer instead.
