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

1. Fork the repl
2. Install dependencies: `npm install`
3. Start the development server: `npm run dev`

Database and auth are provisioned automatically by Replit.

### Locally (Docker)

> **Note:** Replit Auth (login) requires a live Replit repl and cannot be replicated locally. The app will run in guest mode only — all data is stored in the browser.

**Prerequisites:** Docker Desktop, Node.js 20+

```bash
# 1. Install dependencies
npm install

# 2. Start Postgres
npm run local:db:up

# 3. Build the app
npm run build

# 4. Run DB migrations (first time only, or after schema changes)
npm run local:migrate

# 5. Start the server — visit http://localhost:5000
npm run local:start
```

To stop Postgres: `npm run local:db:down`

## License

MIT
