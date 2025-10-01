# Development Log

## 2024-05-08
- Captured the full technical specification for the Fallout web remake MVP and broke it into actionable checklist items in `docs/TASKS.md`.
- Established documentation process to track progress and unblock future PR-based workflow.
- Next: scaffold npm workspace structure and begin implementing the map importer tooling as outlined in the spec.

## 2024-05-09
- Created the npm workspace monorepo skeleton with shared tooling (TypeScript configs, ESLint/Prettier) and populated the required server `.env.example` values.
- Implemented the Express server entrypoint with `/healthz`, `/api/auth/*` stub routes, and the `/art/**` asset proxy that falls back to the original Fallout art when no pre-converted file exists.
- Introduced Prisma schema for `User` and `Session`, along with a placeholder WebSocket server registration.
- Next: Build the `.fomap`/proto import tooling to generate `assets/maps/*.json` and flesh out Prisma migrations plus real auth handlers.

## 2024-05-10
- Настроен репозиторный «санитайзер» для тяжёлых ассетов: расширенный `.gitignore`, запрет диффов для бинарников через `.gitattributes` и workflow `fetch_assets` для загрузки архивов без коммита.
- Next: запустить работу над импортёром карт (`feat/tools-import-fomap`).
