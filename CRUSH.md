# Dyad Development Guide

## Build & Test Commands

- `npm start` - Start development server
- `npm run ts` - Type check all files
- `npm run lint` - Run linter (oxlint)
- `npm run lint:fix` - Auto-fix lint issues
- `npm run prettier` - Format code with Prettier
- `npm test` - Run all tests
- `npm run test:watch` - Run tests in watch mode
- `npx vitest run src/__tests__/filename.test.ts` - Run specific test file
- `npm run e2e` - Run E2E tests (Playwright)

## Code Style Guidelines

### TypeScript & Imports

- Use TypeScript strict mode
- Import order: external libs → internal modules → relative imports
- Use `@/` alias for src imports (e.g., `@/lib/utils`)
- Prefer named exports over default exports
- Use `type` modifier for type-only imports

### React & TanStack Patterns

- Use TanStack Router (NOT Next.js/React Router)
- Follow IPC pattern: React hooks → IpcClient → main process handlers
- Use TanStack Query for async state management
- Throw errors from IPC handlers (don't return success objects)
- Use Jotai for local state when needed

### Error Handling

- Throw descriptive errors: `throw new Error("Descriptive message")`
- Handle errors in React hooks with TanStack Query error states
- Use locking for concurrent operations on shared resources

### Testing

- Use Vitest with happy-dom environment
- Mock dependencies with `vi.mock()`
- Test files use `.test.ts` or `.spec.ts` extension
- Follow patterns in existing test files

### Formatting & Linting

- Prettier for code formatting (empty config = defaults)
- oxlint for linting (configured in biome.json)
- No unused imports (oxlint error)
- Organize imports automatically enabled

### File Structure

- IPC handlers in `src/ipc/handlers/`
- React hooks in `src/hooks/`
- Components in `src/components/` with subdirectories
- Utils in `src/lib/` and `src/ipc/utils/`
- Tests in `src/__tests__/` mirroring source structure
