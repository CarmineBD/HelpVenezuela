# Help Venezuela

Monorepo para una web de ayuda voluntaria tras los terremotos en Venezuela.

## Stack

- `apps/web`: React + Vite + TypeScript
- `apps/api`: Node.js + Fastify + TypeScript
- `packages/shared`: tipos y validaciones compartidas
- `prisma`: modelo de datos PostgreSQL

## Puesta en marcha

```bash
corepack enable
pnpm install
cp .env.example .env
docker compose up -d
pnpm db:generate
pnpm db:migrate
pnpm dev
```

Si `corepack enable` falla por permisos en Windows, puedes usar:

```bash
npx pnpm@9.15.4 install
npx pnpm@9.15.4 db:generate
npx pnpm@9.15.4 db:migrate
npx pnpm@9.15.4 dev
```

URLs locales:

- Web: `http://localhost:5173`
- API: `http://localhost:3000`
- Healthcheck: `http://localhost:3000/health`
