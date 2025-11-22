# API / BFF

NestJS backend-for-frontend layer for the SuperApp. Provides health checks, Prisma access, and domain wiring.

## Commands

- `pnpm --filter @mh-superapp/api dev` — start dev server with ts-node.
- `pnpm --filter @mh-superapp/api build` — compile to `dist/`.
- `pnpm --filter @mh-superapp/api start` — run compiled server.
- `pnpm --filter @mh-superapp/api typecheck` — TS type check.

## Endpoints

- `GET /api/health` — returns service, domain, and database health (DB ping is best-effort; configure `DATABASE_URL`).
