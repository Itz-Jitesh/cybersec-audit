# CyberSec Atria IT — Project Tracker

A private, invite-only project management application built for the **CyberSec Atria IT** club, functionally equivalent to [Plane](https://plane.so). Built with Next.js 15 App Router, Supabase (Postgres, Auth, Realtime, Storage), Drizzle ORM, and Tailwind CSS v4.

---

## 🚀 Overview

CyberSec Atria IT Tracker provides a streamlined, desktop-first workspace for managing club teams, projects, issues, cycles (sprints), modules (epics), pages, and real-time collaboration.

### Key Features

- **Workspace & Team Hierarchy**: Single-workspace structure (`CyberSec Atria IT`) containing multiple teams (e.g., Tech, Design, R&D) and projects.
- **Invite-Gated Auth & RBAC**: OAuth sign-in via Google and GitHub with invite validation, role-based access control (`admin`, `president`, `co_president`, `lead`, `member`), and enforced TOTP MFA for privileged roles.
- **Rich Issue Management**:
  - Per-project sequence IDs (e.g., `WEB-142`).
  - Rich-text descriptions (TipTap), sub-issues, relations, labels, priorities, and assignees.
  - Activity logs, comments with `@mentions` and emoji reactions.
- **Multiple Board Views**:
  - **List**: Grouped collapsible rows with sticky headers.
  - **Kanban**: Drag-and-drop columns via `@dnd-kit`.
  - **Calendar**: Target-date scheduling and drag-to-reschedule.
  - **Spreadsheet**: Dense sortable table with inline editing.
- **Cycles & Modules**: Time-boxed sprints with burndown charts and feature groupings with progress tracking.
- **Real-Time Collaboration**: Real-time project updates and in-app notifications powered by Supabase Realtime channels.
- **Command Palette (`Cmd + K`)**: Global fuzzy search across issues, projects, cycles, modules, pages, and members.
- **Admin Panel & Analytics**: Member role management, bulk invites, audit logs, and project progress trends.

---

## 🛠️ Tech Stack

- **Framework**: [Next.js 15](https://nextjs.org/) (App Router, React 19)
- **Language**: [TypeScript](https://www.typescriptlang.org/) (`strict: true`)
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/) & [shadcn/ui](https://ui.shadcn.com/)
- **Database & ORM**: [Supabase Postgres](https://supabase.com/) & [Drizzle ORM](https://orm.drizzle.team/)
- **Auth & Realtime**: Supabase Auth (OAuth + TOTP MFA) & Supabase Realtime
- **State Management**: [TanStack Query v5](https://tanstack.com/query/v5) (Server state) & [Zustand](https://zustand-demo.pmnd.rs/) (Client UI state)
- **Rich Text**: [TipTap](https://tiptap.dev/)
- **Drag & Drop**: [@dnd-kit](https://dndkit.com/)
- **Forms & Validation**: `react-hook-form` + `zod`

---

## 📁 Repository Structure

```
├── docs/                 # Authoritative specs (PRD, TRD, Data Model, Design System, etc.)
├── drizzle/              # Generated SQL migrations
├── supabase/             # Hand-authored SQL migrations, RLS policies, & triggers
├── src/
│   ├── actions/          # Server Actions for mutations ('use server')
│   ├── app/              # Next.js App Router routes ((auth), (app), admin, api, etc.)
│   ├── components/       # React components (ui/, layout/, issues/, views/, shared/)
│   ├── db/               # Drizzle schemas, client instance, and typed queries
│   ├── hooks/            # Custom React hooks
│   ├── lib/              # Supabase clients, auth helpers, validators, utils
│   ├── stores/           # Zustand stores for ephemeral UI state
│   └── types/            # TypeScript type definitions
├── AGENTS.md / CLAUDE.md # Guidelines and requirements for AI coding assistants
└── package.json
```

---

## 🏁 Getting Started

### Prerequisites

- **Node.js**: v20 LTS or higher
- **Package Manager**: `pnpm` v9 or higher (`corepack enable` or `npm i -g pnpm`)
- **Supabase**: A Supabase project with Postgres database, Auth, and Storage enabled.

### 1. Clone & Install Dependencies

```bash
git clone https://github.com/Itz-Jitesh/sih.git
cd sih
pnpm install
```

### 2. Environment Setup

Create a `.env.local` file in the root directory based on required variables:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
DATABASE_URL=postgresql://postgres.xxxx:password@aws-0-region.pooler.supabase.com:6543/postgres
```

### 3. Database Migration & Seeding

```bash
# Push schema to database
pnpm db:push

# Run seed script
pnpm db:seed
```

### 4. Run Development Server

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 📜 Available Scripts

| Command | Purpose |
|---|---|
| `pnpm dev` | Starts the Next.js development server with Turbopack |
| `pnpm build` | Production build |
| `pnpm build:verify` | Production build to `.next-verify` directory (safe alongside dev server) |
| `pnpm typecheck` | Runs TypeScript type checking (`tsc --noEmit`) |
| `pnpm lint` | Runs ESLint checks |
| `pnpm format` | Formats code with Prettier |
| `pnpm db:generate` | Generates Drizzle migration files |
| `pnpm db:migrate` | Applies Drizzle migrations |
| `pnpm db:push` | Directly pushes schema changes to database |
| `pnpm db:seed` | Runs idempotent seed script |
| `pnpm db:test` | Runs full suite of database & permission test runner scripts |

---

## 🔒 Security & Architecture Rules

- **Server Actions Only for Mutations**: All writes pass through Server Actions in `src/actions/` adhering to strict validation (`zod`) and authorization checks (`assertCan`).
- **Dual Layer Authorization**: Security enforced both at Postgres RLS policies and application-level `assertCan()` permissions.
- **Design Tokens**: All styling uses CSS variable tokens in Tailwind v4; no hardcoded hex color values in component files.
- **Strict Typing**: No `any`, `@ts-ignore`, or non-null assertions without preceding explicit checks.

---

## 📄 License

This repository is built for internal use by the CyberSec Atria IT club.
