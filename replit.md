# TaskRankr

Multi-user, offline-first task manager with hierarchical tasks, a status workflow (open/in_progress/pinned/completed), and per-user rank fields (priority, ease, enjoyment, time). Auth via Replit Auth, with a guest mode that uses local storage + demo data.

## User Preferences
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

## State Management
Offline-first architecture split across focused providers, each owning one slice so consumers re-render only when their slice changes. Provider order in `App.tsx` (outer → inner): `BannersProvider > GuestModeProvider > SettingsProvider > TaskSyncQueueProvider > TasksProvider > SyncProvider > ExpandedTasksProvider > TaskFormDialogProvider`. `TaskFormDialogProvider` internally mounts `DraftSessionProvider` so draft state is scoped to the dialog subtree. See each provider's file docstring for its contract.

### Cross-Cutting Architecture Notes
Load-bearing facts that span multiple files. Anything more specific lives in the file docstring of the named module.
- **Local-first writes + background sync**: Task mutations write to `TasksProvider` synchronously and push an op onto the append-only queue in `TaskSyncQueueProvider`. `SyncProvider` drains the queue in the background. There is no `useMutation` / `isPending` anywhere in app code.
- **Coalesced settings sync**: Settings updates use a single coalesced `pendingSettingsSync` pointer (not the queue) since they're idempotent partial merges. `SyncProvider` drains it alongside the task queue. Both the queue and the pending pointer are persisted to localStorage so unsynced changes survive a tab close.
- **Two-context provider pattern**: `TasksProvider` and `DraftSessionProvider` each expose two contexts — a reactive view (`useTasks` / `useDraftSession`) and stable mutators (`useTaskMutations` / `useDraftSessionMutations`). Components that only fire mutations subscribe to the mutators context and never re-render on data changes.
- **Draft sessions are dialog-scoped**: The TaskForm dialog runs an in-memory draft session (drafts, parent reassignments, order overrides) in `DraftSessionProvider`, which is mounted inside `TaskFormDialogProvider` so draft churn never re-renders top-level task-list consumers. On Save, drafts are promoted in dependency order through real `TasksProvider` mutators; on Cancel, all draft layers are dropped. `TasksProvider` itself is strictly real-only.
- **localStorage namespacing**: All per-user persistent state goes through `client/src/lib/storage.ts`. Providers should never call `localStorage.*` directly.
- **Stable React identity for tasks (`LocalTask`)**: Client task state uses `LocalTask = Task & { clientKey: string }` (`client/src/types/index.ts`). The `clientKey` UUID is the React `key` for every task card / subtask row, so a card's identity survives the temp-id → real-id swap performed by `replaceTaskId` after a sync round-trip (no remount, no entrance animation re-fire). Keys are minted at every entry boundary into client state — fresh local mints, demo seed, server fetch, storage load — via `buildLocalTask` / `withClientKeys` in `client/src/lib/task-provider-utils.ts`. `setTasksFromServer` reuses existing keys by id so re-fetches don't churn identity. `clientKey` is never persisted to the DB or sent over the wire; it lives only in client state and is mirrored to localStorage for a stable identity across reloads.

## Changelog
"What's New" dialog appears when users open the app after an update with new entries (new users without a last-seen version skip the dialog). Entries live in `CHANGELOG.json` at the project root. **Before every publish, add a new changelog entry**: bump the version, set today's date, give it a title, and list the changes. The entry at index 0 is always treated as the current version.

## Project Structure
```
├── client/               # React frontend
│   └── src/
│       ├── components/   # UI components
│       │   ├── primitives/       # Base UI components (shadcn/ui)
│       │   │   ├── forms/        # Form controls (Calendar, Checkbox, Form, Input, Label, Select, Switch, Textarea, TimeInput)
│       │   │   ├── overlays/     # AlertDialog, Dialog, Popover, Toast, Toaster, Tooltip
│       │   │   ├── Badge.tsx, Button.tsx, Card.tsx, CollapsibleCard.tsx, Toggle.tsx
│       │   │   ├── DropdownMenu.tsx, TagChain.tsx
│       │   │   ├── ScrollablePage.tsx
│       │   │   └── LucideIcon.tsx  # Dynamic icon helper
│       │   ├── appInfo/            # Informational/status components
│       │   │   ├── ContactCard.tsx       # Contact/email card with optional debug download
│       │   │   ├── HowToUseBanner.tsx    # Dismissible banner linking to How To Use page
│       │   │   ├── InstallBanner.tsx     # PWA install prompt banner
│       │   │   ├── SortInfo.tsx          # Reusable sort explanation component
│       │   │   ├── StatusBanner.tsx      # Auth/guest status banner
│       │   │   └── WhatsNewDialog.tsx    # Changelog dialog (auto-shows on new version) + settings button
│       │   ├── TaskForm/           # Task form and related components
│       │   │   ├── RankFieldSelect.tsx       # Select component for rank fields in task form
│       │   │   ├── TaskForm.tsx              # Full-screen task create/edit form
│       │   │   ├── TaskFormDialogProvider.tsx # Dialog state + nav stack; owns draft-session lifecycle
│       │   │   ├── useTaskFormParentChain.ts  # Breadcrumb-style parent chain walker (dialog-scoped)
│       │   │   └── SubtasksCard/
│       │   │       ├── index.ts              # Barrel export
│       │   │       ├── SubtasksCard.tsx      # Main subtask list with DnD and hierarchy
│       │   │       ├── SubtasksSettings.tsx  # Subtask settings panel (sort, hide, etc.)
│       │   │       ├── SubtaskRowItem.tsx    # Individual subtask row with actions
│       │   │       ├── AssignSubtaskDialog.tsx  # Dialog to assign existing task as subtask
│       │   │       └── SubtaskActionDialog.tsx  # Cancel/Delete/Remove as Subtask dialog
│       │   ├── BackButton.tsx        # Back navigation button to home
│       │   ├── ErrorBoundary.tsx     # Global error boundary with red crash dialog
│       │   ├── DropdownMenuHeader.tsx # Page header with hamburger menu, title + search
│       │   ├── PageStates.tsx        # Shared PageLoading, PageError, EmptyState
│       │   ├── SortButton.tsx        # Sort option toggle button
│       │   ├── TaskCard.tsx          # Task display with status indicators
│       │   ├── TaskListPage.tsx      # TaskListPageWrapper, TaskListPageHeader, TaskListTreeLayout
│       │   ├── ChangeStatusDialog.tsx # Task status change modal
│       │   ├── ConfirmDeleteDialog.tsx # Permanent delete confirmation dialog
│       │   └── SearchInput.tsx       # Reusable search input with icon
│       ├── hooks/
│       │   ├── useAuth.ts            # Authentication state hook
│       │   ├── useExpandedTasks.ts   # Task expansion state (persists in localStorage)
│       │   ├── useMobile.tsx         # Mobile detection hook
│       │   └── useToast.ts           # Toast notifications
│       ├── pages/
│       │   ├── Home.tsx              # Main task list with sorting
│       │   ├── Settings.tsx          # User preferences & attribute visibility
│       │   ├── Completed.tsx         # Completed tasks view
│       │   ├── HowToUse.tsx          # Instructional page (tap-to-edit, hold-for-status)
│       │   ├── HowToInstall.tsx      # PWA install instructions (iOS, Android, Desktop)
│       │   ├── Landing.tsx           # Unauthenticated landing page
│       │   └── NotFound.tsx
│       ├── providers/              # See "State Management" above
│       │   ├── SettingsProvider.tsx       # User settings + coalesced pending settings sync
│       │   ├── TaskSyncQueueProvider.tsx  # Task sync queue (owns SyncOperation types)
│       │   ├── TasksProvider.tsx          # Local-first task state; enqueues onto TaskSyncQueueProvider
│       │   ├── SyncProvider.tsx           # Background sync orchestrator (drains task queue + settings pending)
│       │   ├── GuestModeProvider.tsx      # Guest mode flag (isGuestMode)
│       │   ├── BannersProvider.tsx        # Cross-cutting banner-suppression set
│       │   └── ExpandedTasksProvider.tsx  # Task expansion state persistence
│       ├── lib/
│       │   ├── task-tree-utils.ts  # Tree-walking, sort/filter; re-exports shared/utils/task-utils
│       │   ├── columns.ts          # Rank-column UI metadata
│       │   ├── rank-field-styles.ts # Rank field color mappings
│       │   ├── ts-rest.ts          # ts-rest client + QueryKeys
│       │   ├── query-client.ts     # @tanstack/react-query client
│       │   ├── utils.ts            # cn, time conversions, etc.
│       │   ├── auth-utils.ts       # Authentication helpers
│       │   ├── changelog.ts        # Changelog entries, version tracking, unseen detection
│       │   ├── constants.ts        # App-wide constants (Routes, date formats, rank-field enums)
│       │   ├── storage.ts          # localStorage namespacing + JSON helper
│       │   ├── demo-tasks.ts       # Demo task data for guest mode
│       │   └── migrate-guest-tasks.ts  # Guest→auth task migration
│       ├── App.tsx               # Main app with routing and providers
│       └── main.tsx              # React entry point
├── server/
│   ├── index.ts          # Server entry point
│   ├── routes.ts         # API route handlers (ts-rest)
│   ├── storage.ts        # Database access layer
│   ├── db.ts             # Database connection
│   ├── static.ts         # Static file serving
│   ├── vite.ts           # Vite dev server integration
│   └── replit_integrations/auth/  # Replit Auth (OIDC)
├── shared/
│   ├── schema/           # Drizzle tables + Zod schemas (tasks, settings, auth) — source of truth for the data model
│   ├── utils/            # Shared task utilities (used by client + server)
│   ├── contract.ts       # ts-rest API contract
│   ├── constants.ts      # Auth path constants
│   └── models/auth.ts    # Auth model utilities
└── migrations/           # Database migrations
```

## PWA / Service Worker
`vite-plugin-pwa` generates a Workbox-powered service worker that precaches the app shell and provides runtime caching for Google Fonts. Configured in `vite.config.ts` with `generateSW` strategy. Registration happens in `client/src/main.tsx` via `virtual:pwa-register`. The service worker checks for updates hourly. Type declarations for the virtual module are in `client/src/vite-env.d.ts`.

## Load-Time Optimizations
- **Inline pre-React spinner**: `client/index.html` includes a pure-CSS spinner inside `#root` that renders immediately (before any JS loads). It's removed by `App.tsx` on mount via `document.getElementById('app-loader').remove()`.
- **Route-level code splitting**: Secondary pages (`Completed`, `Settings`, `HowToUse`, `HowToInstall`, `NotFound`) use `React.lazy` + `Suspense` in `App.tsx`. Primary routes (`Home`, `Landing`) are eagerly imported to avoid cold-start chunk latency.
- **Font loading**: Only Inter and Outfit are loaded (via CSS `@import` in `index.css`). The HTML has `preconnect` hints for Google Fonts domains. All other font families were removed — do not re-add the massive multi-font `<link>` tag.


## Coding Conventions

### Shared task utilities
Tree-walking, sort/filter, and id-list helpers live in `shared/utils/task-utils.ts` (re-exported from `client/src/lib/task-tree-utils.ts`). Always prefer these over inline implementations. Read the file directly for the available helpers and their JSDoc.

### Path aliases
Resolved via `vite-tsconfig-paths` from `tsconfig.json`. `@/` → `client/src/`, `~/shared/` → `shared/`.

## Cypress E2E Tests

- Tests live in `cypress/e2e/`. Support code is in `cypress/support/`:

```
cypress/
├── e2e/                        # Test files (*.cy.ts)
└── support/
    ├── constants/
    │   ├── index.ts            # DefaultTask, FieldConfig presets, re-exports selectors
    │   └── selectors.ts        # All CSS selector strings — always add new ones here
    ├── utils/
    │   ├── api.ts              # checks local state and backend
    │   ├── intercepts.ts       # intercept helpers (cy.intercept)
    │   ├── navigation.ts       # page navigation helpers
    │   ├── task-form.ts        # UI actions on the Task Form
    │   ├── task-tree.ts        # UI actions on the Task Tree
    │   ├── settings.ts         # helpers for setting settings
    │   └── test-runner.ts      # isLoggedIn
    └── commands.ts             # Custom Cypress commands (cy.selectOption, cy.escapeWithin, etc.)
```

- Must manually add new test files to `cypress.config.ts`.
- When asked to run E2E tests, run `cy:run:user` by default unless asked to do `cy:run:guest`.

### Selectors
All `data-testid` (and other) selectors live in `cypress/support/constants/selectors.ts` under the `Selectors` object. Never use raw `[data-testid="..."]` or other selector strings in test files — always add to `Selectors` first and import from there. Groups mirror the component that owns the testids (e.g. `Selectors.Menu`, `Selectors.TaskForm`, `Selectors.ChangeStatusDialog`).

### DRY pattern for New vs. Edit variants
When a feature works the same way from both a create form and an edit form, use a `for...of` loop over an array of `{ contextName, ...hooks }` objects and call `context(contextName, () => { ... })` inside. See `cancel-task-form.cy.ts` and `completed-tasks.cy.ts` for examples.

