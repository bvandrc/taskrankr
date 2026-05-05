# TaskRankr

A multi-user, offline-first task manager featuring hierarchical tasks, a status workflow, and per-user rank fields.

## Run & Operate

- Run: `npm run dev`
- Build: `npm run build`
- Typecheck: `npm run typecheck`
- Codegen: `npm run codegen`
- DB Push: `npm run db:push`

Required Environment Variables:
- `VITE_REPLIT_APP_URL`
- `VITE_REPLIT_APP_NAME`

## Stack

- Frontend: React
- Styling: Tailwind CSS, shadcn/ui
- State Management: Custom React Context providers (offline-first)
- Backend: Node.js, Express
- Database: Drizzle ORM
- API: `ts-rest`
- Validation: Zod
- Build Tool: Vite
- Runtime: Node.js (latest LTS)

## Where things live

- React frontend: `client/`
- Node.js server: `server/`
- Shared code (schema, utils, API contract): `shared/`
- Database schema: `shared/schema/`
- API contracts: `shared/contract.ts`
- UI component primitives: `client/src/components/primitives/`
- DB migrations: `migrations/`
- Cypress E2E tests: `cypress/e2e/`
- Changelog data: `CHANGELOG.json`

## Architecture decisions

- **Local-first writes with background sync**: Task mutations update the UI immediately and are enqueued for background synchronization, eliminating `isPending` states in the UI.
- **Two-context provider pattern**: Providers expose separate contexts for reactive data and stable mutators to optimize re-renders.
- **Dialog-scoped draft sessions**: Task form draft state is isolated to the dialog subtree, preventing UI churn in the main task list during editing.
- **Stable React identity for tasks**: `clientKey` (UUID) ensures consistent React component identity for tasks across client-side state changes and syncs, avoiding remounts.
- **Coalesced settings sync**: Settings updates are batched into a single, idempotent pending sync operation rather than a queue, as they represent partial merges.

## Product

- Multi-user task management
- Offline-first capabilities with background sync
- Hierarchical task structure (subtasks)
- Task status workflow: `open`, `in_progress`, `pinned`, `completed`
- Customizable per-user rank fields: `priority`, `ease`, `enjoyment`, `time`
- Guest mode with local storage and demo data
- User authentication via Replit Auth
- Progressive Web App (PWA) support

## User preferences

- Preferred communication style: Simple, everyday language.
- File naming: kebab-case for utility/helper files (e.g., `auth-utils.ts`), PascalCase for component primitives (e.g., `DropdownMenu.tsx`, `AlertDialog.tsx`), camelCase for hooks (e.g., `useAuth.ts`, `useSettings.ts`)
- Icon helper: Use `Icon` component from `LucideIcon.tsx` only for conditional/dynamic icons (ternary cases), not for single static icons
- Code comments & JSDoc: Comments and docstrings describe a function/module from the perspective of its API — *what* it does for callers and *why*, when the design is unique or non-obvious. Trust the code to be self-explanatory for the *how*: do not restate the implementation, avoid pasting code snippets that mirror what's right below, and do not narrate steps a reader can see. Skip hedge prefixes ("Derived predicate:", "Translates X into Y:") and lead with the claim. Don't restate what the type signature already conveys (optionality, parameter types, return types). For multi-branch behavior, prefer a one-line summary plus a tight bullet list ("including: ...") over branch-by-branch prose. Keep descriptions concise (1-2 lines for most things; longer only when there's genuine "why" to explain). Prefer renaming a variable/prop to inserting an inline comment that explains what it *is*. Use exact package names as imported (e.g., `@radix-ui` not "Radix UI").
- Terminology: "Rank fields" refers to the 4 sortable fields with badges: priority, ease, enjoyment, time (distinct from text fields like name/description)
- Test IDs: Use `data-testid` as the prop name, not `testId`
- Icon Sizing: Use `size-X` tailwind class instead of `w-X h-X`
- es-toolkit: Use `es-toolkit` helper functions when we can greatly simplify something. For example, when copying many same-named properties from one object to another, use `omit` or `pick` from `es-toolkit` instead of enumerating every field by hand. Example: `createTask({ ...omit(draft, ['id', 'userId']), parentId: resolved })` rather than listing all 14 fields explicitly.
- Formatting: Run `npm run format` (biome) before every commit/checkpoint so the code in checkpoints is always formatted.
- Documentation: Keep `replit.md` focused on cross-cutting architecture and conventions. File-level mechanics, function signatures, and internal helpers belong in the relevant file's docstring, not here.

## Gotchas

- Always run `npm run format` before committing.
- Do not call `localStorage.*` directly; use `client/src/lib/storage.ts` for all per-user persistent state.
- For Cypress tests, add new test files to `cypress.config.ts`.
- When running E2E tests, default to `cy:run:user` unless explicitly asked for `cy:run:guest`.
- All `data-testid` selectors in Cypress must be defined in `cypress/support/constants/selectors.ts`.
- Do not re-add large multi-font `<link>` tags; only Inter and Outfit are supported.
- Before every publish, add a new changelog entry to `CHANGELOG.json`.

## Pointers

- PWA configuration: `vite.config.ts`
- Service Worker registration: `client/src/main.tsx`
- Virtual PWA module types: `client/src/vite-env.d.ts`
- Shared task utility functions: `shared/utils/task-utils.ts`
- Path aliases configuration: `tsconfig.json`
- Cypress E2E test selectors: `cypress/support/constants/selectors.ts`
- Cypress custom commands: `cypress/support/commands.ts`