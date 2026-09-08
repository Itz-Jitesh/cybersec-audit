PROMPT PACK — CYBERSEC ATRIA IT PROJECT TRACKER

Usage: one prompt per agent session. Paste the whole block. Before pasting, ensure the repo contains docs/02-PRD.md, docs/03-TRD.md, docs/04-DATA-MODEL.md, docs/05-DESIGN-SYSTEM.md, docs/06-UX-LAYOUT-SPEC.md, docs/tokens-raw.txt, docs/layout-raw.txt, CLAUDE.md, AGENTS.md. Each prompt assumes the agent can read those files.

Every prompt ends with a constraint block. Do not remove it. Do not edit prompts to be shorter; ambiguity is what produces rework.

=== PROMPT 1 — SCAFFOLD AND TOOLING ===

You are working in an empty repository. Read docs/03-TRD.md sections 1, 2, and 11, and docs/05-DESIGN-SYSTEM.md sections 1, 2, and 3, before writing anything.

Task: scaffold the project.

Create the Next.js 15 application at the repository root using the App Router, TypeScript with "strict": true, and pnpm as the package manager. Do not use the src/app + pages hybrid. Use src/ as the source root.

Install and configure exactly these dependencies and no others: next@15, react@19, react-dom@19, typescript, tailwindcss@4, @tailwindcss/postcss, drizzle-orm, drizzle-kit, postgres, @supabase/supabase-js, @supabase/ssr, @tanstack/react-query, zustand, zod, react-hook-form, @hookform/resolvers, date-fns, lucide-react, sonner, clsx, tailwind-merge, class-variance-authority. Dev dependencies: eslint, eslint-config-next, prettier, prettier-plugin-tailwindcss, eslint-plugin-simple-import-sort, @types/node, @types/react, @types/react-dom.

Create the exact directory structure listed in docs/03-TRD.md section 2. Where a directory would be empty, add a .gitkeep file. Do not invent additional directories.

Configure fonts in src/app/layout.tsx using next/font/google: Inter with weights 400, 500, 600 exposed as the CSS variable --font-sans, and JetBrains Mono with weights 400, 500 exposed as --font-mono. Both with display: "swap".

Create src/app/globals.css containing the complete CSS custom property block from docs/05-DESIGN-SYSTEM.md section 1. If docs/tokens-raw.txt exists, use the values from that file instead of the approximate values in the design system doc; tokens-raw.txt is the source of truth for colour values. Wire the tokens into Tailwind v4 using the @theme directive so that classes such as bg-bg-90, text-text-200, border-border-subtle, and rounded-md resolve to the variables. Define the font size scale from docs/05-DESIGN-SYSTEM.md section 2 exactly, including the 2xs size at 10px and sm at 13px with 20px line height. Set the document background to var(--bg-100) and default text to var(--text-100).

Initialise shadcn/ui with the "new-york" style, base colour "neutral", CSS variables enabled, and components path src/components/ui. Then install these components: button, input, textarea, select, checkbox, switch, radio-group, label, dialog, sheet, popover, dropdown-menu, context-menu, command, tooltip, tabs, avatar, badge, separator, scroll-area, skeleton, progress, calendar, alert-dialog, collapsible, toggle-group, sonner. After installation, edit the generated components only to make them consume the project's CSS variables. Do not change their prop APIs.

Create src/lib/env.ts that validates process.env with zod at module load and exports a typed object. Required variables: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, DATABASE_URL, NEXT_PUBLIC_APP_URL. Throw with a readable message listing every missing variable. Create .env.example listing all of them with empty values.

Create src/lib/supabase/client.ts exporting a browser client created with createBrowserClient from @supabase/ssr. Create src/lib/supabase/server.ts exporting an async createClient() using createServerClient with the Next.js cookies() adapter. Create src/lib/supabase/middleware.ts exporting updateSession(request) that refreshes the auth cookie and returns the response. Do not add route protection logic yet.

Create src/db/index.ts exporting a Drizzle client using the postgres driver against DATABASE_URL. Create drizzle.config.ts pointing at src/db/schema and outputting to ./drizzle with dialect "postgresql". Do not define any tables yet.

Configure ESLint with next/core-web-vitals plus simple-import-sort, and Prettier with prettier-plugin-tailwindcss. Add scripts to package.json: dev, build, start, lint, typecheck (tsc --noEmit), db:generate, db:migrate, db:push, db:studio.

Create a temporary route at src/app/dev/kitchen-sink/page.tsx that renders a heading and one of each shadcn button variant, so the token wiring is visually verifiable.

Verify before finishing: pnpm typecheck passes with zero errors, pnpm lint passes with zero errors, pnpm build succeeds.

Constraints. Do not add any dependency not listed above. Do not create database tables, authentication logic, or application routes beyond the kitchen-sink page. Do not write any component containing a hardcoded hex colour value; every colour must come from a CSS variable through a Tailwind token. Do not modify the prop signatures of generated shadcn components. Do not add a README. Do not initialise git or create commits.

=== PROMPT 2 — SHARED COMPONENT LIBRARY ===

Read docs/05-DESIGN-SYSTEM.md in full and docs/06-UX-LAYOUT-SPEC.md section 5 before writing anything. The design target is a visual replication of the Plane application UI. Do not apply any cybersecurity theming, do not add neon colours, do not add glow effects, do not add monospace to anything except issue identifiers, code blocks, and keyboard chips.

Task: build the shared component primitives.

Create these files in src/components/shared/, one component per file, kebab-case filenames, named exports:

priority-icon.tsx exports PriorityIcon with props { priority: "urgent" | "high" | "medium" | "low" | "none"; size?: 14 | 16 | 18; className?: string }. Renders a three-bar signal glyph as inline SVG where the number of filled bars maps to the level: low fills one bar, medium two, high three, none renders three empty bars in --text-400. Urgent renders a filled rounded square containing an exclamation mark. Colours come from the --priority-* variables.

state-icon.tsx exports StateIcon with props { group: "backlog" | "unstarted" | "started" | "completed" | "cancelled"; color?: string; size?: number }. Backlog renders a dashed circle, unstarted a solid-stroke empty circle, started a circle with a half-filled arc, completed a filled circle with a white check, cancelled a filled circle with a white cross. When color is supplied it overrides the group default colour.

member-avatar.tsx exports MemberAvatar with props { user: { id: string; displayName: string; avatarUrl?: string | null }; size?: 16 | 20 | 24 | 28 }. Renders the image if avatarUrl is present, otherwise the first letter of displayName uppercased on a background colour selected deterministically from a fixed eight-colour array indexed by a hash of user.id. The hash function must be pure and stable across server and client renders.

avatar-group.tsx exports AvatarGroup with props { users: MemberAvatarUser[]; max?: number; size?: 16 | 20 | 24 }. Overlaps avatars by -6px with a 1px ring in --bg-90. Beyond max, renders a "+N" chip using the same size and ring.

label-chip.tsx exports LabelChip with props { label: { id: string; name: string; color: string }; removable?: boolean; onRemove?: () => void }. Height 18px, fully rounded, 6px horizontal padding, 11px text, a 6px colour dot before the name, background is the label colour at 12 percent alpha, border 1px at 30 percent alpha, text in --text-200.

date-chip.tsx exports DateChip with props { date: Date | string; variant?: "start" | "target"; isCompleted?: boolean }. Formats as "MMM d" for the current year and "MMM d, yyyy" otherwise using date-fns. When variant is "target", the date is in the past, and isCompleted is false, render in --danger with a --danger at 12 percent alpha background.

issue-id-badge.tsx exports IssueIdBadge with props { identifier: string; sequenceId: number }. Renders identifier + "-" + sequenceId in font-mono, 11px, --text-300, non-selectable.

kbd.tsx exports Kbd with props { keys: string[] }. Renders each key in font-mono 10px on --bg-70 with 3px radius, 4px horizontal padding, joined by a 2px gap.

empty-state.tsx exports EmptyState with props { icon: LucideIcon; title: string; description?: string; action?: React.ReactNode }. Centred column, icon at 32px in --text-400, title 13px --text-200, description 12px --text-300 with max-width 320px, action below with 16px gap.

progress-ring.tsx exports ProgressRing with props { value: number; total: number; size?: 20 | 32 | 48; showLabel?: boolean }. SVG circle with stroke-dasharray progress in --success, track in --bg-70, stroke width proportional to size.

inline-editable-text.tsx exports InlineEditableText with props { value: string; onSave: (next: string) => void | Promise<void>; className?: string; multiline?: boolean; placeholder?: string }. Renders as static text until clicked, then becomes a borderless input or textarea with the same typography and no layout shift. Enter saves for single-line, Escape cancels and restores the original value, blur saves. While saving, the text is at 60 percent opacity and input is disabled. Empty values are rejected and revert.

All components must be server components unless they require state or event handlers, in which case add "use client" at the top of that file only.

Update src/app/dev/kitchen-sink/page.tsx to render every component above in every meaningful variant, grouped under plain text section labels, so all states can be visually checked in one place.

Verify before finishing: pnpm typecheck and pnpm lint pass. Run "grep -rEn '#[0-9a-fA-F]{3,8}' src/components/" and confirm zero results.

Constraints. Do not add any dependency. Do not create domain components such as issue rows, cards, or sidebars. Do not use inline style attributes except for dynamic colour values that originate from props, which is permitted only in label-chip.tsx and state-icon.tsx. Do not use font weights above 600. Do not add hover scale transforms or spring animations. Do not modify files in src/components/ui/. Do not modify globals.css.

=== PROMPT 3 — DATABASE SCHEMA ===

Read docs/04-DATA-MODEL.md in full before writing anything. It is the complete and authoritative specification. Implement it exactly; do not add, rename, or omit columns.

Task: define the database schema and migrations.

Create Drizzle schema files under src/db/schema/, one file per domain, and re-export all of them from src/db/schema/index.ts:
enums.ts, profiles.ts, workspace.ts (workspace_members, invites, audit_log), teams.ts (teams, team_members), projects.ts (projects, project_members, states, labels), issues.ts (issues, issue_assignees, issue_labels, issue_relations, issue_links, issue_attachments, issue_activity, issue_subscribers), cycles.ts (cycles, cycle_snapshots), modules.ts (modules, module_issues), collaboration.ts (comments, comment_reactions, notifications), workspace_content.ts (views, pages, favorites).

Use snake_case for all database column names and camelCase for the TypeScript property names. Every table gets id uuid primary key defaulting to gen_random_uuid(), createdAt and updatedAt as timestamptz not null defaulting to now(), except join tables which omit updatedAt.

Define all Drizzle relations() for every foreign key so that relational queries are typed.

Create every index listed in docs/04-DATA-MODEL.md section 7, including the generated tsvector column and its GIN index. The tsvector column and index must be written in a hand-authored SQL migration since Drizzle cannot express generated columns reliably.

Create hand-authored SQL migration files under supabase/migrations/ using the naming pattern NNNN_description.sql for everything Drizzle cannot express:
0001_extensions.sql enabling pgcrypto and citext.
0002_search_vector.sql adding the issues.search_vector generated column and its GIN index.
0003_triggers.sql containing set_updated_at, assign_issue_sequence, set_completed_at, log_issue_activity, log_assignee_activity, log_label_activity, auto_subscribe, and fanout_notifications, with the trigger bindings described in docs/04-DATA-MODEL.md section 8.

assign_issue_sequence must increment projects.sequence_counter and read the new value inside a single atomic UPDATE ... RETURNING statement to be safe under concurrent inserts. Do not implement it as a SELECT followed by an UPDATE.

log_issue_activity must compare OLD and NEW for the fields name, description_html, state_id, priority, parent_id, cycle_id, start_date, target_date, and estimate_point, and insert one issue_activity row per changed field, resolving state names and cycle names into the old_display and new_display columns at write time. The actor is auth.uid(); if auth.uid() is null, skip the insert rather than failing.

fanout_notifications must insert notification rows for every user in issue_subscribers for the affected issue, plus every user id parsed from data-mention-id attributes in a comment's HTML, excluding the actor, and must not create duplicate rows for a user who is both subscribed and mentioned on the same event.

Create src/db/seed.ts which is idempotent and inserts: one workspace row named "CyberSec Atria IT", three teams (Tech/tech, Design/design, R&D/rnd), and one invite for the email supplied via a SEED_ADMIN_EMAIL environment variable with role "admin". Add a pnpm script db:seed. Running it twice must not create duplicates.

Create src/lib/constants/defaults.ts exporting DEFAULT_STATES (Backlog/backlog, Todo/unstarted with isDefault true, In Progress/started, In Review/started, Done/completed, Cancelled/cancelled, each with the colours from docs/05-DESIGN-SYSTEM.md section 1) and DEFAULT_LABELS (bug, feature, documentation, research, ctf, blocked, good-first-issue with distinct colours). These are used when a project is created; do not insert them globally in the seed.

Generate the Drizzle migration and apply all migrations to Supabase in order: Drizzle migrations first, then the hand-authored SQL files in numeric order.

Verify before finishing: pnpm typecheck passes; re-running drizzle-kit generate produces no new migration; db:seed runs twice without error.

Constraints. Do not enable row level security or write any RLS policy in this phase. Do not write application code, routes, or components. Do not use the service role key anywhere outside src/db/seed.ts. Do not modify any file under src/components/ or src/app/. Do not add dependencies other than drizzle-orm, drizzle-kit, postgres, and dotenv if it is not already present.

=== PROMPT 4 — ROW LEVEL SECURITY AND PERMISSIONS ===

Read docs/04-DATA-MODEL.md sections 9 and 10 in full. The policy matrix in section 9 is the specification. Implement it exactly.

Task: implement authorization at both the database and application layers.

Create supabase/migrations/0004_rls_helpers.sql defining these functions as SECURITY DEFINER with "set search_path = public, pg_temp", each returning boolean and each written to avoid recursive policy evaluation by querying tables directly rather than through views:
is_active_member(uid uuid)
is_workspace_admin(uid uuid)
is_team_lead(uid uuid, tid uuid)
is_project_member(uid uuid, pid uuid)
can_manage_project(uid uuid, pid uuid)
Semantics are given in docs/04-DATA-MODEL.md section 9. Grant execute on all of them to the authenticated role.

Create supabase/migrations/0005_rls_policies.sql that enables row level security on every table in the public schema and creates policies implementing the matrix in docs/04-DATA-MODEL.md section 9. Write separate named policies per operation, named using the pattern tablename_operation_rolescope, for example issues_select_project_member. For tables marked "trigger only" for insert, create no insert policy at all so that only SECURITY DEFINER trigger code can write.

Explicit requirements that must hold and which you must verify:
issue_activity has no insert, update, or delete policy for the authenticated role.
notifications has no insert policy for the authenticated role.
workspace_members update is restricted to is_workspace_admin, and a user must not be able to update their own role row.
profiles update is restricted to id = auth.uid() and must not permit changing the id or email columns; enforce the column restriction with a BEFORE UPDATE trigger that raises an exception if either column changes.

Create src/lib/auth/permissions.ts exporting a Permission union type covering: workspace:manage, member:invite, member:manage, team:create, team:manage, project:create, project:manage, project:delete, issue:create, issue:update, issue:delete, cycle:manage, module:manage, comment:delete_any, view:manage_public. Export an async function can(userId, permission, scope?) and an async function assertCan(userId, permission, scope?) that throws a typed ForbiddenError. The scope argument is { teamId?: string; projectId?: string }. The logic must mirror the SQL helpers exactly; where they disagree, the SQL is correct and the TypeScript must be changed.

Create src/lib/auth/session.ts exporting getSession(), getCurrentUser() returning the profile joined with the workspace_members row, and requireUser() which redirects to /sign-in when there is no session. These are server-only; add "server-only" as the first import.

Create supabase/tests/rls.sql containing a pgTAP-style or plain assertion script that creates five test users (workspace admin, president, tech lead, tech member, design member), a team and project for Tech and one for Design, and asserts at minimum:
the tech member can select the Tech project
the tech member cannot select the Design project
the design member cannot select any Tech issue
a member cannot update their own workspace_members.role
a member cannot insert into issue_activity
a member cannot select another user's notifications
the tech lead can update the Tech project but not the Design project
Each assertion must produce a clear pass or fail line. Add a pnpm script db:test:rls that executes it.

Run the RLS test script and report the result. If any assertion fails, fix the policy rather than the test, unless the test itself is wrong.

Constraints. Do not disable row level security on any table for convenience. Do not use the service role key to work around a failing policy. Do not add a "bypass" or "admin override" policy that grants blanket access based on a claim other than the workspace_members role lookup. Do not modify the schema defined in phase 3 except to add the profiles column-guard trigger. Do not write UI code. Do not add dependencies.

=== PROMPT 5 — AUTHENTICATION ===

Read docs/03-TRD.md section 4, docs/06-UX-LAYOUT-SPEC.md sections 2, 3, and 4, and docs/02-PRD.md section 4.1 before writing anything.

Task: implement invite-gated OAuth authentication with TOTP two-factor for privileged roles.

Create supabase/migrations/0006_handle_new_user.sql defining handle_new_user() as a SECURITY DEFINER trigger on auth.users AFTER INSERT which:
looks up an invite where lower(email) equals lower(NEW.email) and accepted_at is null and expires_at is greater than now(), ordered by created_at desc, limit 1
if no invite is found, raises an exception with the message 'NO_INVITE'
otherwise inserts a profiles row using NEW.id, NEW.email, the display name from NEW.raw_user_meta_data->>'full_name' falling back to the email local part, and the avatar from NEW.raw_user_meta_data->>'avatar_url'
inserts a workspace_members row with the invite's role and is_active true
inserts a team_members row when the invite carries team_id, using the invite's team_role or 'member'
sets the invite's accepted_at to now()

Create src/app/(auth)/sign-in/page.tsx implementing the layout in docs/06-UX-LAYOUT-SPEC.md section 2. Two buttons: Continue with Google and Continue with GitHub. Each calls supabase.auth.signInWithOAuth with redirectTo set to NEXT_PUBLIC_APP_URL + '/auth/callback' and, when an invite token is present in the query string, carries it through the redirectTo query string. Read an "error" query parameter and, when it equals "no_invite", render the rejection notice described in the spec instead of a generic error.

Create src/app/auth/callback/route.ts as a GET route handler that exchanges the code for a session with exchangeCodeForSession, and on error redirects to /sign-in?error=no_invite when the error message contains 'NO_INVITE', otherwise to /sign-in?error=auth_failed. On success redirect to /home, or to /mfa when the user's role requires an unmet second factor.

Create src/middleware.ts with a matcher excluding _next/static, _next/image, favicon.ico, and files with an extension. It must, in order: refresh the session via updateSession; allow unauthenticated access only to /sign-in, /auth/callback, and /invite/:token; redirect unauthenticated users elsewhere to /sign-in; look up the workspace_members row and redirect to /sign-in?error=deactivated when is_active is false; when the role is admin, president, or co_president and the session assurance level is not aal2, redirect to /mfa unless the request is already for /mfa. Cache the membership lookup for the duration of the request only; do not introduce an external cache.

Create src/app/(auth)/invite/[token]/page.tsx which server-side loads the invite by token and renders inviter display name, role, team name, and expiry per docs/06-UX-LAYOUT-SPEC.md section 3. Render distinct states for expired and already-accepted invites. The accept button routes to /sign-in?invite=TOKEN.

Create src/app/(auth)/mfa/page.tsx handling both enrolment and challenge. Enrolment calls supabase.auth.mfa.enroll with factorType 'totp', renders the returned QR code SVG and the plain secret with a copy button, and verifies with a six-digit code input. Challenge calls mfa.challenge then mfa.verify. The six-digit input is six separate boxes with auto-advance, backspace-to-previous, and full-code paste support. On success redirect to /home.

Create src/actions/auth.ts with "use server" exporting signOut(), which signs out and redirects to /sign-in.

Create src/app/(auth)/layout.tsx providing the centred full-viewport container for all auth routes.

In the Supabase dashboard configuration notes, add docs/supabase-config.md listing the required manual steps: enable Google and GitHub providers with the client IDs, disable the email provider, set the redirect allowlist, and enable MFA.

Verify before finishing: signing in with an email that has no invite results in the rejection screen and no rows in profiles or workspace_members; signing in with an invited email creates exactly one profiles row and one workspace_members row and marks the invite accepted; an admin without an enrolled factor is redirected to /mfa on every protected route.

Constraints. Do not implement email and password authentication, magic links, or anonymous sign-in anywhere in the codebase. Do not create a public sign-up route. Do not use the service role key in any file under src/app/ or src/components/. Do not bypass the invite check in development with an environment flag. Do not modify the RLS policies or schema from phases 3 and 4. Do not build the application shell, sidebar, or /home content; a placeholder /home page returning the user's display name is sufficient.

=== PROMPT 6 — APPLICATION SHELL ===

Read docs/06-UX-LAYOUT-SPEC.md sections 1, 5, and 16, and docs/05-DESIGN-SYSTEM.md sections 3, 4, and 5.

Task: build the authenticated application shell and the home dashboard.

Create src/app/(app)/layout.tsx as a server component that calls requireUser(), loads the user's teams and their projects in a single relational query, and renders AppSidebar and Header around the children. The layout element uses a fixed height of 100dvh with independent overflow on the sidebar and content regions; the document body must never scroll.

Create src/components/layout/app-sidebar.tsx as a client component receiving the tree data as props. Width var(--sidebar-w), background var(--bg-90), right border var(--border-subtle). Sections in order: workspace header with logo mark from /public/brand/logo-mark.svg and workspace name with a dropdown containing Settings, Invite members (rendered only when the user role is admin, president, or co_president), and Sign out; primary navigation with Home, My Issues, Notifications, Drafts; a Favorites collapsible section; one collapsible group per team, each expanding to its projects, each project expanding to Issues, Cycles, Modules, Views, Pages; and a footer with the user avatar, a new-project button, and the collapse toggle. Row height 28px, text-xs, 12px indentation per nesting level, maximum depth three. Active route detection uses usePathname and applies the active treatment from docs/06-UX-LAYOUT-SPEC.md section 5.

Collapsed state and per-group expansion state persist in localStorage under the key "sidebar-state" via a zustand store at src/stores/sidebar-store.ts using the persist middleware. When collapsed the sidebar is var(--sidebar-w-collapsed) wide and shows icons only, with tooltips on hover.

Create src/components/layout/header.tsx with height var(--header-h), a bottom border of var(--border-subtle), containing Breadcrumbs on the left and, on the right, a search trigger button showing a Kbd for Cmd K, a primary New issue button, a notification bell with an unread count badge, and the user avatar menu. The search trigger and command palette are stubs in this phase: clicking opens an empty dialog.

Create src/components/layout/breadcrumbs.tsx deriving the trail from the pathname and the loaded tree data, rendering Team / Project / Section with slash separators in var(--text-400).

Create src/app/(app)/home/page.tsx implementing docs/06-UX-LAYOUT-SPEC.md section 5. The four stat cards query counts with SQL aggregates in a single round trip: issues assigned to the current user and not archived, of those the count whose state group is 'started', the count with target_date before today and state group not 'completed', and the count completed within the current active cycle. Your issues list shows the eight most recently updated issues assigned to the user. Recent activity reads the twenty newest issue_activity rows across projects the user can see. Active cycles shows every cycle with status 'active' in the user's projects with a ProgressRing.

Create placeholder route files for every remaining route in docs/03-TRD.md section 2 that renders an EmptyState with the route name, so navigation never 404s: my-issues, notifications, teams/[teamSlug], projects/[projectId]/issues, cycles, modules, views, pages, analytics, settings, and admin.

Create loading.tsx with layout-matching skeletons, error.tsx with the message plus Try again and Go home actions, and not-found.tsx, at the (app) segment root and at projects/[projectId].

Verify before finishing: every sidebar link navigates without a 404; the sidebar collapse state survives a page reload; the home page renders real numbers from the database; no horizontal scrollbar appears on the document at 1440px width.

Constraints. Do not implement the command palette search, notification contents, or issue creation in this phase; they are stubs. Do not fetch data in client components; all reads happen in server components and are passed down as props. Do not use useEffect to load data. Do not introduce a global state library beyond the sidebar zustand store. Do not modify anything under src/db/, supabase/, or src/components/shared/. Do not add dependencies.

=== PROMPT 7 — TEAMS AND PROJECTS ===

Read docs/02-PRD.md sections 2 and 3, docs/04-DATA-MODEL.md section 3, and docs/06-UX-LAYOUT-SPEC.md sections 1 and 14.

Task: implement team and project management.

Create src/actions/teams.ts with "use server" exporting createTeam, updateTeam, deleteTeam, addTeamMember, removeTeamMember, and setTeamRole. Each function must, in this order: validate input with a zod schema imported from src/lib/validators/team.ts, call assertCan with the appropriate permission, perform the mutation, write an audit_log row for deleteTeam and setTeamRole, and call revalidatePath. Every action returns the discriminated union { ok: true, data } or { ok: false, error, code } and never throws to the client.

Create src/actions/projects.ts with "use server" exporting createProject, updateProject, archiveProject, deleteProject, addProjectMember, removeProjectMember, setProjectRole, createState, updateState, deleteState, reorderState, createLabel, updateLabel, and deleteLabel, following the same structure.

createProject must run in a single transaction that inserts the project, inserts the six DEFAULT_STATES and seven DEFAULT_LABELS from src/lib/constants/defaults.ts scoped to that project, and inserts the creator as a project_members row with role 'admin'. If any step fails the whole transaction rolls back.

deleteState must refuse with the code 'STATE_IN_USE' when any issue references it, and must refuse to delete the last remaining state or the default state.

reorderState assigns a new fractional sequence value computed as the midpoint between the neighbouring states' sequence values, so that reordering never rewrites other rows.

Create src/components/projects/create-project-modal.tsx as a client component with react-hook-form and zod. Fields: name, identifier, team, lead, icon emoji. The identifier field auto-populates from the name as the first five characters of the uppercased name with non-letters stripped, until the user edits it manually, after which it stops auto-populating. Validate the identifier as 2 to 5 uppercase letters and check uniqueness with a debounced server action before submit.

Create src/app/(app)/teams/[teamSlug]/page.tsx showing team name, description, lead, member list, and a grid of project cards, with a create-project action visible only to users who pass project:create for that team.

Create src/app/(app)/projects/[projectId]/settings/page.tsx with sub-tabs General, Members, States, Labels, and Danger Zone. States tab supports drag reordering with dnd-kit, inline rename, colour picking from a fixed twelve-colour palette, and group reassignment. Labels tab supports create, rename, recolour, and delete. Danger Zone contains archive and delete, each behind an AlertDialog requiring the project name to be typed to confirm.

Create src/actions/favorites.ts with toggleFavorite(entityType, entityId) and wire the star control into project cards, project headers, and the sidebar favorites section built in phase 6.

Verify before finishing: creating a project produces exactly six states and seven labels and one project_members row; deleting a state that has issues is refused with a toast showing the reason; a member who is not a team lead cannot see the create-project control and, if the action is called directly, receives a forbidden error.

Constraints. Do not implement issues, cycles, or modules in this phase. Do not perform authorization checks only in the UI; every server action must call assertCan independently. Do not use the service role key. Do not modify RLS policies. Do not add dependencies other than @dnd-kit/core and @dnd-kit/sortable. Do not delete or repurpose any file created in phase 6.

=== PROMPT 8 — ISSUES CORE ===

Read docs/02-PRD.md section 4.2, docs/04-DATA-MODEL.md section 4, and docs/06-UX-LAYOUT-SPEC.md sections 7.1, 7.2, and 8. This is the largest phase; implement it in the order given below and do not begin a later step before the earlier one type-checks.

Task: implement the issue lifecycle and the list layout.

Step 1. Create src/lib/validators/issue.ts with zod schemas for create, update, and filter payloads. Create src/db/queries/issues.ts exporting getIssuesForProject(projectId, filters, groupBy, pagination) returning issues with their state, assignees, labels, sub-issue counts, cycle, and modules in a single query using Drizzle relational queries and a lateral count for sub-issues. Never issue one query per issue.

Step 2. Create src/actions/issues.ts with "use server" exporting createIssue, updateIssue, updateIssueOrder, archiveIssue, unarchiveIssue, deleteIssue, setAssignees, setLabels, setParent, addRelation, removeRelation, addLink, removeLink, addAttachment, and removeAttachment. Same validate then assertCan then mutate then revalidate structure as phase 7. updateIssueOrder computes a fractional sort_order midpoint between neighbours and must accept the target group so a single call can change both state and order.

Step 3. Create src/components/issues/issue-list-row.tsx matching docs/06-UX-LAYOUT-SPEC.md section 7.2 exactly, including the hover-revealed drag handle and overflow menu, and inline dropdown editing for state, priority, and assignees. Row height uses var(--row-h).

Step 4. Create src/components/views/list-layout.tsx rendering grouped rows with sticky collapsible group headers, each header showing the group icon, name, count, a quick-add button, and a collapse chevron. Group collapse state is per-user and stored in localStorage.

Step 5. Create src/components/issues/issue-quick-add.tsx, an inline single-line input appended to each group that creates an issue with the group's value pre-applied on Enter, keeps focus for rapid entry, and renders the new row optimistically.

Step 6. Create src/components/issues/issue-create-modal.tsx with the full field set: title, description via TipTap, state, priority, assignees, labels, cycle, modules, start date, target date, estimate, parent. Include a "Create more" switch that keeps the modal open and resets only the title and description.

Step 7. Create src/components/issues/issue-detail.tsx implementing the two-column layout in docs/06-UX-LAYOUT-SPEC.md section 8, and mount it in two places: src/components/issues/issue-peek-overlay.tsx as a Dialog, and src/app/(app)/projects/[projectId]/issues/[issueId]/page.tsx as a full page. Both render the same component; do not duplicate the implementation.

Step 8. Configure TipTap at src/components/editor/rich-editor.tsx with StarterKit, Link, Placeholder, TaskList, TaskItem, CodeBlock, and a Mention extension configured to query project members. Persist both description_json and description_html on save. Debounce autosave at 800ms.

Step 9. Create src/components/issues/sub-issue-list.tsx, issue-relations-list.tsx, attachment-list.tsx with drag-and-drop upload to the Supabase Storage bucket "attachments" using the path pattern in docs/04-DATA-MODEL.md, and link-list.tsx.

Step 10. Create src/components/issues/comment-editor.tsx and comment-item.tsx with mentions, emoji reactions, and edit and delete restricted to the author or a user passing comment:delete_any. Create src/actions/comments.ts.

Step 11. Create src/components/issues/issue-activity-feed.tsx rendering issue_activity rows as sentences, grouping consecutive entries by the same actor within five minutes.

Step 12. Implement multi-select in the list layout with Shift-click range selection and Cmd-click toggling, and a floating bulk action bar with set state, set priority, assign, add label, archive, and cancel. Bulk mutations go through a single bulkUpdateIssues server action, not a loop of individual calls from the client.

Every mutation that changes a visible row must apply an optimistic update through TanStack Query following the five-step contract in docs/03-TRD.md section 3.1.

Verify before finishing: creating twenty issues rapidly through quick-add produces sequential identifiers with no duplicates or gaps; every field change appears in the activity feed with correct old and new display values; archiving removes the issue from the list without a full page refetch; a non-member cannot load the issue detail page and sees the permission-denied state rather than a 404.

Constraints. Do not implement kanban, calendar, or spreadsheet layouts in this phase. Do not implement filtering or group-by controls; grouping is hardcoded to state for now. Do not implement realtime subscriptions. Do not add dependencies other than @tiptap/react, @tiptap/starter-kit, @tiptap/extension-link, @tiptap/extension-placeholder, @tiptap/extension-mention, @tiptap/extension-task-list, @tiptap/extension-task-item, @tanstack/react-query, and emoji-mart. Do not write to issue_activity from application code; it is trigger-populated. Do not change the schema.

=== PROMPT 9 — LAYOUTS AND FILTERING ===

Read docs/02-PRD.md section 4.3, docs/06-UX-LAYOUT-SPEC.md sections 7.1 and 7.3 through 7.5, and docs/04-DATA-MODEL.md section 6 for the views filter and display shapes.

Task: implement the remaining three layouts and the full filtering system.

Create src/lib/filters/types.ts defining the IssueFilters and DisplayProps types exactly matching the JSON shapes in docs/04-DATA-MODEL.md section 6. Create src/lib/filters/apply.ts exporting a function that converts an IssueFilters object into Drizzle where conditions. All filtering happens in SQL. Never fetch a project's issues and filter them in JavaScript.

Create src/stores/view-store.ts with zustand persisting, per project id, the active layout, filters, group-by, order-by, and display properties in localStorage under the key "view-state".

Create src/components/views/filter-bar.tsx containing the layout switcher (four icon toggles), a Filters dropdown, a Group by dropdown, a Display popover, and, on a second row rendered only when filters are active, removable applied-filter chips and a Clear all control. The Filters dropdown supports state, state group, priority, assignees, labels, cycle, module, created by, start date, target date, and a text search field, with multi-select where applicable.

Create src/components/views/kanban-layout.tsx using @dnd-kit. Columns are 280px with a 12px gap and horizontal scroll. Dragging between columns calls updateIssueOrder with the new group value and the computed sort order in one call. Dragging within a column reorders only. Both are optimistic. Columns are collapsible to a 40px vertical strip. Each column loads fifty cards with a Load more control. Keyboard drag support from dnd-kit must remain enabled.

Create src/components/issues/issue-kanban-card.tsx per docs/06-UX-LAYOUT-SPEC.md section 7.3.

Create src/components/views/calendar-layout.tsx as a month grid with weekday headers, out-of-month days dimmed, today's date marked with an accent circle, issues rendered as 20px chips limited to three per day with a "+N more" popover, drag to change target_date, and month navigation with a Today control.

Create src/components/views/spreadsheet-layout.tsx with a sticky first column containing the identifier and title, the remaining columns from docs/06-UX-LAYOUT-SPEC.md section 7.5, sortable and resizable and reorderable headers, and inline cell editing through the same dropdown components used by the list row.

Create src/components/views/virtualised-list.tsx wrapping @tanstack/react-virtual, and apply it in the list and spreadsheet layouts when the rendered row count exceeds one hundred.

All four layouts consume the same data hook and the same filter state. Switching layout must not refetch if the filter set is unchanged.

Create src/actions/views.ts with createView, updateView, deleteView, and duplicateView, and src/app/(app)/projects/[projectId]/views/page.tsx listing saved views per docs/06-UX-LAYOUT-SPEC.md section 11. Creating a view captures the current filter, group-by, layout, and display state. Opening a view applies them.

Implement src/app/(app)/my-issues/page.tsx reusing the same layout components with a cross-project scope and an added project chip on each row and card.

Verify before finishing: applying a filter in list layout and switching to kanban shows the identically filtered set; a project with five hundred issues scrolls smoothly in list and spreadsheet; dragging a card between columns updates the state and persists after a reload; a saved public view is visible to another project member and a private one is not.

Constraints. Do not implement cycles, modules, realtime, or search in this phase. Do not filter or sort in JavaScript over a full result set. Do not create a second data-fetching path; all four layouts use the same query hook. Do not add dependencies other than @tanstack/react-virtual. Do not modify server actions from phase 8 except to add the group parameter to updateIssueOrder if it is missing.

=== PROMPT 10 — CYCLES, MODULES, REALTIME, SEARCH ===

Read docs/02-PRD.md sections 4.4 through 4.7, docs/03-TRD.md sections 3 and 7, and docs/06-UX-LAYOUT-SPEC.md sections 9, 10, 12, and 13.

Task: implement cycles, modules, realtime synchronisation, notifications, and the command palette.

Cycles. Create src/actions/cycles.ts with createCycle, updateCycle, deleteCycle, addIssuesToCycle, removeIssueFromCycle, and completeCycle. createCycle and updateCycle must reject overlapping date ranges with a non-completed cycle in the same project, returning the code 'CYCLE_OVERLAP'. completeCycle accepts a disposition for incomplete issues of 'next_cycle', 'backlog', or 'leave' and applies it in one transaction. Build the cycles list and detail pages per docs/06-UX-LAYOUT-SPEC.md section 9, with the issues tab reusing the phase 9 layout components scoped by cycle_id and the analytics tab rendering a Recharts burndown from cycle_snapshots plus a state distribution donut and a per-assignee bar chart.

Create src/app/api/cron/cycle-snapshots/route.ts which, for every active cycle, upserts today's cycle_snapshots row and updates cycle status values based on the current date. Protect it by comparing a CRON_SECRET header. Register it in vercel.json with a daily schedule.

Modules. Create src/actions/modules.ts with createModule, updateModule, deleteModule, addIssuesToModule, and removeIssueFromModule, and the list and detail pages per docs/06-UX-LAYOUT-SPEC.md section 10.

Realtime. Create src/lib/realtime/use-project-channel.ts, a hook that subscribes to a single Supabase Realtime channel named project:PROJECTID with postgres_changes listeners on issues filtered by project_id, on comments filtered by the project's issues, and on notifications filtered by the current user id. On each event, patch the TanStack Query cache with setQueryData for the affected row; fall back to invalidateQueries only when the payload is insufficient to patch. The channel is created on mount of a project route and removed on unmount. Do not open a channel per issue or per card. Skip applying events whose actor is the current user when a local optimistic update already reflects them.

Notifications. Create src/components/layout/notification-popover.tsx and src/app/(app)/notifications/page.tsx per docs/06-UX-LAYOUT-SPEC.md section 12, plus src/actions/notifications.ts with markRead, markAllRead, snooze, and unsnooze. Unread counts update in realtime.

Search. Create src/components/layout/command-palette.tsx replacing the phase 6 stub. It queries a new server action searchWorkspace(query) which runs a single SQL query using the issues.search_vector GIN index for issues plus ILIKE matches for projects, cycles, modules, pages, and members, returning at most five results per category. Debounce input at 200ms. Typing ">" switches to command mode listing Create issue, Create project, Go to my issues, Toggle sidebar, and Sign out. Arrow keys navigate, Enter selects, Escape closes.

Shortcuts. Create src/hooks/use-keyboard-shortcuts.ts implementing the table in docs/06-UX-LAYOUT-SPEC.md section 15, ignoring all shortcuts while focus is inside an input, textarea, or contenteditable element. Add a "?" cheat sheet dialog.

Verify before finishing: with two browser sessions signed in as different users open on the same project, a state change in one appears in the other within one second without a refresh; a comment mention creates a notification for the mentioned user only; the command palette finds an issue by a word from its description; completing a cycle with the 'next_cycle' disposition moves every incomplete issue.

Constraints. Do not add a WebSocket server, Redis, or any external queue. Do not poll on an interval as a substitute for realtime. Do not subscribe to table changes without a filter. Do not add dependencies other than recharts and cmdk if it is not already present via shadcn. Do not modify the RLS policies; if realtime does not deliver a row, the cause is a policy that correctly denies it and the fix is in the subscription filter, not the policy.

=== PROMPT 11 — ADMIN, PAGES, ANALYTICS ===

Read docs/02-PRD.md sections 4.8 through 4.10 and docs/06-UX-LAYOUT-SPEC.md sections 11 and 14.

Task: implement the admin panel, invite emails, pages, analytics, and passkey enrolment.

Admin. Build src/app/(app)/admin/ with sub-navigation for General, Members, Invites, Teams, and Audit log, per docs/06-UX-LAYOUT-SPEC.md section 14. Every page and every action in this area must call assertCan with workspace:manage or member:manage as appropriate. Create src/actions/admin.ts with updateWorkspace, setWorkspaceRole, deactivateMember, reactivateMember, createInvites, revokeInvite, and resendInvite. setWorkspaceRole must refuse to demote the last remaining admin, returning the code 'LAST_ADMIN'. Every privileged action writes an audit_log row.

createInvites accepts a batch: an array of emails parsed from comma or newline separated input, one role, and one optional team plus team role. It validates each email, skips addresses that already have an active membership or an open invite while reporting them per-address, inserts the remainder, and sends one email per address. It returns a per-address result array so the UI can show which succeeded.

Email. Add resend and react-email. Create src/emails/invite-email.tsx as a react-email template using the brand logo from the public URL, plain dark styling consistent with the app, the inviter's name, the assigned role and team, and a single call-to-action button pointing at NEXT_PUBLIC_APP_URL + '/invite/' + token. Create src/lib/email/send.ts wrapping the Resend client. Email sending failures must not roll back the invite row; report them per-address instead.

Pages. Create src/actions/pages.ts and the list and editor routes per docs/06-UX-LAYOUT-SPEC.md section 11, reusing the TipTap editor from phase 8 with a wider extension set including headings, task lists, code blocks, and image upload to Supabase Storage. Autosave with a debounce of 1000ms and a saved indicator. Access is private or public-to-project, enforced by RLS and by assertCan.

Analytics. Create src/app/(app)/projects/[projectId]/analytics/page.tsx with four Recharts visualisations computed by SQL aggregates in src/db/queries/analytics.ts: created versus completed issues per week for the last twelve weeks, current issue count by state, issue count by assignee, and an overdue count with a list of the ten most overdue issues. All aggregation happens in SQL; do not fetch rows and reduce them in TypeScript.

Passkeys. Add WebAuthn enrolment as an alternative second factor on the profile settings page, using the Supabase MFA API. If the installed Supabase version does not support WebAuthn factors, do not implement a custom WebAuthn flow: stop, leave TOTP as the only second factor, and write a short note in docs/supabase-config.md explaining what is blocked and what version would be required.

Verify before finishing: inviting five addresses at once, where two are already members, reports two skips and three sends and produces exactly three invite rows and three emails; demoting the last admin is refused; a private page is invisible to another project member both in the UI and when its URL is requested directly.

Constraints. Do not expose the service role key to any client component or any file with "use client". Do not send email from a client component. Do not implement a custom WebAuthn implementation. Do not add dependencies other than resend, react-email, and @react-email/components. Do not modify the phase 4 permission helpers except to add missing permission strings.

=== PROMPT 12 — HARDENING, RESPONSIVE, AND RELEASE ===

Read docs/07-BUILD-PHASES.md phase 12 and docs/03-TRD.md sections 8, 9, and 10.

Task: prepare the application for production use by real club members.

Cleanup. Delete src/app/dev/ entirely, remove any seed, debug, or impersonation route, and remove every console.log outside of error handlers. Run a repository-wide grep for TODO and FIXME and either resolve each or convert it to a GitHub issue reference in a comment.

Responsive pass, desktop-first with these breakpoints. Below 1024px the sidebar becomes a Sheet drawer opened by a hamburger button in the header, and the issue detail panel becomes a full-screen Sheet. Below 768px the kanban keeps horizontal scroll with columns narrowed to 260px, the spreadsheet is wrapped in a horizontally scrolling container with the sticky first column preserved, the calendar switches to a single-column agenda list grouped by day, the filter bar collapses its controls into a single Filters button opening a Sheet, and every interactive target is at least 40px in its smallest dimension. Do not change any desktop layout in the process; verify each screen at 1440px after each change.

Performance. Apply virtualisation wherever a list can exceed one hundred rows. Audit every server component for sequential awaits that can be parallelised with Promise.all. Confirm all runtime database access uses the Supabase transaction pooler connection string on port 6543 and that only migration scripts use port 5432. Add explicit limits to every query that lacks one.

Security. Grep the built output with "grep -r SUPABASE_SERVICE_ROLE .next/static" and confirm zero matches. Confirm no file containing "use client" imports from src/db/ or src/lib/auth/. Add rate limiting to createInvites and searchWorkspace using an in-memory limiter keyed by user id, sized for thirty users. Set security headers in next.config: X-Frame-Options DENY, X-Content-Type-Options nosniff, Referrer-Policy strict-origin-when-cross-origin, and a Permissions-Policy disabling camera, microphone, and geolocation.

Testing. Add Playwright with a smoke suite covering: sign in as a seeded user, create a project, create an issue, move it across kanban columns, add a comment with a mention, and assert with a second browser context that the state change appears without a reload. Add Vitest unit tests for src/lib/filters/apply.ts, src/lib/auth/permissions.ts, and the fractional sort-order helper. Re-run supabase/tests/rls.sql and confirm all assertions still pass.

Accessibility. Verify visible focus rings on every interactive element, aria-labels on every icon-only button, and that the kanban keyboard drag path works end to end. Run Lighthouse on /home and on a project issues page and report the scores; performance must be at least 85 and accessibility at least 95, and if either falls short, list the specific failing audits and fix them.

Deployment. Create vercel.json with the cron entry from phase 10. Document in docs/09-DEPLOYMENT.md the exact production environment variable list and the Supabase dashboard settings to apply. Confirm the production build succeeds and that the preview deployment works with production environment variables against a separate Supabase project if one exists.

Verify before finishing: report the Lighthouse scores, the Playwright results, the RLS test results, and the grep results for the service role key, as plain text output.

Constraints. Do not refactor architecture, rename files, or restructure directories in this phase. Do not upgrade any dependency to a new major version. Do not add features. Do not change the visual design at desktop widths. Do not disable any lint rule to make the build pass; fix the underlying code instead.
