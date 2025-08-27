# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Prerequisites and setup
- Node.js: engines require Node >= 20 (see package.json)
- Install dependencies: `npm install`
- Optional: copy `.env.example` to `.env` if you want to use cloud providers or local model hosts

## Common commands
- Start the Electron app (dev): `npm start`
  - With local engine URL: `npm run dev:engine`
- Type-check
  - All: `npm run ts`
  - Main: `npm run ts:main`
  - Workers: `npm run ts:workers`
- Lint
  - Standard: `npm run lint`
  - Aggressive fix (suggestions + dangerous fixes): `npm run lint:fix`
- Format
  - Check: `npm run prettier:check`
  - Write: `npm run prettier`
- Database (Drizzle ORM)
  - Generate SQL from schema: `npm run db:generate`
  - Apply migrations: `npm run db:push`
  - UI: `npm run db:studio`

## Unit tests (Vitest)
- Run all: `npm test`
- Watch mode: `npm run test:watch`
- UI: `npm run test:ui`
- Run a single file: `npx vitest run src/path/to/file.test.ts`
- Run a single test by name: `npx vitest -t "test name substring"`
- Notes
  - Tests run in `happy-dom` (see vitest.config.ts)
  - Path alias: `@` => `./src`

## End-to-end tests (Playwright + Electron)
- One-time local setup
  - Install browsers: `npx playwright install`
  - Install fake LLM server deps: `cd testing/fake-llm-server && npm install`
- Build for E2E: `npm run pre:e2e` (packs the app for test; only needed when app code changes)
- Run all: `npm run e2e`
- Run one spec: `npx playwright test e2e-tests/<file>.spec.ts`
- Update snapshots: `npx playwright test e2e-tests/<file>.spec.ts --update-snapshots`
- Shard locally (example shard 1 of 4): `npm run e2e:shard -- 1/4`
- The E2E config launches a fake OpenAI-compatible server from `testing/fake-llm-server` (see `playwright.config.ts`); ensure its deps are installed once.

## High-level architecture
- Electron application with main, preload, and renderer processes
  - Main (src/main.ts)
    - Registers all IPC handlers before app ready (see `src/ipc/ipc_host.ts`)
    - Initializes SQLite database via Drizzle; auto-runs migrations from `/drizzle`
    - Creates BrowserWindow and loads Vite dev server in dev or built HTML in prod
    - Handles deep-link flows (supabase, neon, dyad-pro) and posts events to renderer
  - Preload (src/preload.ts)
    - Exposes a safelist of IPC channels to the renderer (contextIsolation enabled)
  - Renderer (src/renderer.tsx)
    - React + TanStack Router + TanStack Query
    - UI and state live under `src/pages`, `src/components`, and `src/atoms`

- IPC
  - Handlers are centralized in `src/ipc/ipc_host.ts` and implemented per domain in `src/ipc/handlers/*`
  - Renderer calls go through `src/ipc/ipc_client.ts` (wrapper around `ipcRenderer.invoke` and event listeners)

- Dyad tag workflow (core AI flow)
  - System prompt: `src/prompts/system_prompt.ts` defines Dyad’s rules and XML-like tags (e.g., `dyad-write`, `dyad-rename`, `dyad-delete`, `dyad-add-dependency`, `dyad-execute-sql`, `dyad-mcp-call`, `think`)
  - Renderer displays streamed responses with `src/components/chat/DyadMarkdownParser.tsx`, which parses Dyad tags into UI blocks using `src/components/chat/*` components
  - Main applies approved changes via `src/ipc/processors/response_processor.ts`:
    - Executes file ops, dependency installs, optional SQL against Supabase
    - Commits changes with isomorphic-git and annotates the message with commit hash

- Database
  - SQLite (Better-SQLite3 + Drizzle ORM)
  - Schema: `src/db/schema.ts`; DB initialization and migrations: `src/db/index.ts`
  - Drizzle config: `drizzle.config.ts` stores DB file under user-data path; migrations in `/drizzle`

- Build system
  - electron-forge + `@electron-forge/plugin-vite`
  - Vite configs:
    - Main: `vite.main.config.mts`
    - Preload: `vite.preload.config.mts`
    - Worker: `vite.worker.config.mts`
    - Renderer: `vite.renderer.config.mts`
  - Path alias: `@` => `./src` in Vite configs

## Tool- and rule-specific notes
- Cursor rules (`.cursor/rules/ipc.mdc`)
  - IPC architecture: use `IpcClient.getInstance()` in the renderer; only call allowlisted channels exposed by `preload.ts`
  - Error propagation: main-process handlers should throw errors; TanStack Query in the renderer handles rejections (avoid returning `{ success: false }`-style objects)
  - Router and data: app uses TanStack Router (not React Router); Query/Mutation meta can be used to trigger toasts for errors

## Key references
- docs/architecture.md — high-level product architecture overview
- CONTRIBUTING.md — quick-start commands for dev, DB setup, and tests
- package.json — scripts for dev, type-checking, linting, formatting, tests, e2e, packaging
- vitest.config.ts — unit test environment and globs
- playwright.config.ts — E2E setup (fake LLM server, reporters, timeouts)
- .eslintrc.json and .prettierrc — lint/format configuration
- .github/workflows/ci.yml — CI flow (Mac/Windows matrix, presubmit, type-check, unit + e2e)

