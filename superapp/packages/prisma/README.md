# Prisma Package

Shared Prisma schema, client, and migrations for the SuperApp monorepo.

## Commands

- `pnpm --filter @mh-superapp/prisma prisma:validate` — validate schema against env.
- `pnpm --filter @mh-superapp/prisma prisma:generate` — generate client.
- `pnpm --filter @mh-superapp/prisma prisma:migrate` — create/apply migrations (requires `DATABASE_URL`).

## Environment

Set `DATABASE_URL` (see `.env.example` at repo root). Use a separate shadow database when running migrations in CI.
