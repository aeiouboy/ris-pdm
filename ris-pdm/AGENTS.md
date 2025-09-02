# Repository Guidelines

## Project Structure & Module Organization
- `backend/`: Node.js Express API (`server.js`, `src/`, `routes/`, `middleware/`, `utils/`, `tests/`). Env at `backend/.env` (see `backend/.env.example`).
- `frontend/`: React (Vite) app (`src/`, `public/`, `cypress/`, `dist/`). Env at `frontend/.env*`.
- `database/`, `deploy/`, `docker/`: infra and deployment assets. Compose files: `docker-compose*.yml`.
- `docs/`, `security/`, `monitoring/`: reference, security notes, ops.

## Build, Test, and Development Commands
Backend (from `backend/`):
- `npm run dev`: start API with Nodemon (hot reload).
- `npm test` | `npm run test:coverage`: run Jest unit/integration tests.
- `npm run lint` | `npm run lint:fix`: lint JS with ESLint.
- `npm start`: start API (production-ish). Port typically `3001`.
- `npm run docker:build` | `npm run docker:run`: container workflows.

Frontend (from `frontend/`):
- `npm run dev`: start Vite dev server.
- `npm run build` | `npm run preview`: build and preview production bundle.
- `npm test` | `npm run test:coverage`: run Vitest unit/component tests.
- `npm run lint`: lint React code. E2E: `npx cypress open`.

## Coding Style & Naming Conventions
- JavaScript/JSX, Node ≥ 18. Two-space indentation, semicolons optional—follow ESLint.
- Variables/functions: `camelCase`; React components: `PascalCase` in `src/components/`.
- Tests: `*.test.js|jsx`; keep files close to code or in `backend/tests/` and `frontend/src/**/__tests__/`.
- Linting: ESLint (recommended configs, React Hooks rules). Fix lint errors before PRs.

## Testing Guidelines
- Backend: Jest with Supertest and Nock. Use `tests/` for services, routes, and integration.
- Frontend: Vitest + Testing Library setup in `src/test/`. Prefer behavior-focused tests.
- E2E: Cypress in `frontend/cypress/`. Gate critical flows.
- Aim for meaningful coverage; include `test:coverage` in PRs touching logic.

## Commit & Pull Request Guidelines
- Commits: Conventional Commits (e.g., `feat:`, `fix:`, `docs:`). Small, focused changes.
- Branches: `feat/<scope>`, `fix/<scope>`, `chore/<scope>`.
- PRs: clear description, linked issue, steps to verify, screenshots for UI, and notes on risk/rollback. Ensure lint/tests pass.

## Security & Configuration
- Never commit secrets. Use `*.env.example` as a template and local `.env` files.
- Review `security/` and `DEPLOYMENT.md` for auth, rate-limits, and headers.
- Prefer `docker-compose.dev.yml` for local stacks; keep ports/env consistent across services.

