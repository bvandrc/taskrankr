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
npm run local:migrate

# 4. Start the dev server — visit http://localhost:5000
npm run dev
```

To stop Postgres: `npm run local:db:down`

#### Guest mode vs. Login mode

Both `npm run dev` and `npm run build && npm run local:start` run in **development mode**: the **Log In / Sign Up** button automatically bypasses Replit Auth and logs you in as the built-in test user, giving you full authenticated mode with real database sync. The only difference is that `npm run dev` uses the Vite dev server, while `local:start` serves the pre-built static files.

> `npm run build && npm run prod:start` runs in production mode — test login is disabled and only guest mode is available.

## License

MIT
