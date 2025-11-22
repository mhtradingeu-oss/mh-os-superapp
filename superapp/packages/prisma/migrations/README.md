# Prisma migrations

- Run `pnpm --filter @mh-superapp/prisma prisma:migrate` to create migrations from the current schema.
- Legacy SQL lives in `back-end/prisma/migrations/...` if you need to reference past work; do not apply it directly without alignment to the current schema.
