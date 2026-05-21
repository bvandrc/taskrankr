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

`npm run dev` runs in **development mode**, which enables a dev-only bypass for Replit Auth. The **Log In / Sign Up** button on the landing page will automatically detect that Replit Auth is unavailable and log you in as the built-in test user instead, giving you full authenticated mode with real database sync.

> **Production build:** `npm run build && npm run start` does not register the test login endpoint, so only guest mode is available. Use `npm run build && npm run local:start` to run the built app in dev mode (test login enabled).

## License

MIT
