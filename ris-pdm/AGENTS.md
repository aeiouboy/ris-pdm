# Repository Guidelines

## Project Structure & Module Organization
- `backend/`: Node.js Express API (`server.js`, `src/`, `routes/`, `middleware/`, `utils/`, `tests/`). Env via `backend/.env` (see `backend/.env.example`).
- `frontend/`: React (Vite) app (`src/`, `public/`, `cypress/`, `dist/`). Env via `frontend/.env*`.
- `database/`, `deploy/`, `docker/`: infra and deployment assets. Compose files: `docker-compose*.yml`.
- `docs/`, `security/`, `monitoring/`: reference, security notes, and ops.

## Build, Test, and Development Commands
Backend (from `backend/`):
- `npm run dev`: start API with Nodemon (hot reload).
- `npm start`: start API (production-ish), typically on `3001`.
- `npm test` | `npm run test:coverage`: run Jest unit/integration tests.
- `npm run lint` | `npm run lint:fix`: lint/fix with ESLint.
- `npm run docker:build` | `npm run docker:run`: build/run container workflows.

Frontend (from `frontend/`):
- `npm run dev`: start Vite dev server.
- `npm run build` | `npm run preview`: build and preview production bundle.
- `npm test` | `npm run test:coverage`: run Vitest tests.
- `npm run lint`: lint React code. E2E: `npx cypress open`.

## Coding Style & Naming Conventions
- JavaScript/JSX, Node ≥ 18. Two-space indent; semicolons per ESLint config.
- Variables/functions: `camelCase`; React components: `PascalCase` in `src/components/`.
- Tests: `*.test.{js,jsx}` near code or in `backend/tests/` and `frontend/src/**/__tests__/`.
- Resolve all ESLint errors before PRs.

## Testing Guidelines
- Backend: Jest + Supertest + Nock; place route/service/integration tests in `backend/tests/`.
- Frontend: Vitest + Testing Library in `frontend/src/test/`; behavior-focused tests preferred.
- E2E: Cypress specs in `frontend/cypress/` for critical flows.
- Aim for meaningful coverage; include `test:coverage` in PR checks.

## Commit & Pull Request Guidelines
- Commits: Conventional Commits (e.g., `feat:`, `fix:`, `docs:`, `chore:`). Keep them small and scoped.
- Branches: `feat/<scope>`, `fix/<scope>`, `chore/<scope>`.
- PRs: clear description, linked issue, steps to verify, screenshots for UI, and risk/rollback notes. Ensure lint and tests pass.

## Security & Configuration
- Never commit secrets. Use `*.env.example` templates and local `.env` files.
- Review `security/` and `DEPLOYMENT.md` for auth, rate limits, and headers.
- Prefer `docker-compose.dev.yml` for local stacks; keep ports/env consistent across services.

