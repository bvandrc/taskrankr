# TaskRankr

A multi-user task management app with priority, ease, enjoyment, and time ratings. Sort by any attribute at a glance.

## Features

- **Task Attributes**: Set priority, ease, enjoyment, and time for each task
- **Configurable Visibility**: Show/hide any attribute column; set attributes as required or optional
- **Flexible Sorting**: Sort your task list by any visible attribute
- **Hierarchical Tasks**: Create subtasks nested under parent tasks
- **Status Workflow**: Tasks flow through open, in_progress, pinned, and completed states
- **Single Focus**: Only one task can be "in progress" at a time
- **Time Tracking**: Automatically track time spent on in-progress tasks
- **Auto-Pin**: New tasks can be automatically pinned to the top
- **Multi-User**: Per-user task isolation with Replit Auth

## Tech Stack

- **Frontend**: React 18, TypeScript, Tailwind CSS, Framer Motion
- **Backend**: Node.js, Express, TypeScript
- **API**: ts-rest for end-to-end type safety
- **Database**: PostgreSQL with Drizzle ORM
- **Auth**: Replit Auth (OpenID Connect)
- **UI Components**: shadcn/ui (Radix UI primitives)

## Getting Started

### On Replit

```bash
# 1. Fork the repl, then install dependencies
npm install

# 2. Start the development server — visit the preview URL
npm run dev
```

Database and auth are provisioned automatically by Replit.

### Locally (Docker)

**Prerequisites:** Docker Desktop, Node.js 20+

```bash
# 1. Install dependencies
npm install

# 2. Start Postgres
npm run local:db:up

# 3. Run DB migrations (first time only, or after schema changes)
npm run db:migrate

# 4. Start the dev server — visit http://localhost:5000
npm run dev
```

To stop Postgres: `npm run local:db:down`

#### Database commands

| Command | What it does | When to use |
|---|---|---|
| `npm run db:generate -- --name <desc>` | Diffs your schema against the last snapshot and writes a new `.sql` migration file | After changing `shared/schema/tasks.zod.ts` (or other schema files) — commits the migration alongside the schema change |
| `npm run db:migrate` | Applies any pending migration files to the database | After pulling changes that include new migrations, or after running `db:generate` locally |
| `npm run db:push` | Pushes the current schema directly to the DB without generating a migration file | Quick local iteration when you don't need a migration history (e.g. experimenting with a column change you haven't committed yet) |

Always pass `--name` with a descriptive slug when generating — e.g. `npm run db:generate -- --name add_task_schedule`. Without it, Drizzle uses a random adjective-noun name that conveys nothing about the change.

**Rule of thumb**: use `db:generate` + `db:migrate` for real changes (they leave a traceable migration file). Use `db:push` only for throwaway local experiments — it bypasses the migration history and can leave your local DB out of sync with the tracked migrations.

#### Which script to use

Three scripts serve distinct purposes and can't be collapsed further:

| Script | Frontend | Test login | Use when |
|---|---|---|---|
| `npm run dev` | Vite dev server (HMR) | ✓ auto-bypass | Active development |
| `npm run build && npm run local:preview` | Compiled `dist/` | ✓ auto-bypass | E2E tests against the compiled artifact |
| `npm run build && npm run prod:preview` | Compiled `dist/` | ✗ | Production / prod simulation |

**`dev`** runs TypeScript directly via `tsx` and uses the Vite dev server with hot module replacement. The Log In button auto-logs you in as the built-in test user (Replit Auth is bypassed). Use this for day-to-day development.

**`local:preview`** serves the pre-built static files and also keeps test routes enabled — which is what Playwright relies on for session setup. Use this to run E2E tests against the real compiled artifact (`npm run pw:run:user` / `npm run pw:run:guest`).

**`prod:preview`** runs the compiled bundle with test routes stripped. The Log In button triggers real Replit Auth (requires `REPL_ID` in env). Use this to simulate or run a production deployment.

## License

MIT
