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

## 2024-05-11
- Реализован парсер `.fomap`, резолвер PID→art и CLI-скрипты импорта, автоматически собирающие JSON-карты в `assets/maps/` (проверено на `arroyo.fomap`).
- Добавлен workflow `import_maps.yml` для запуска импорта через GitHub Actions.
- Next: подключить рантайм-декодер FR/FRM и палитру Fallout на клиенте.

## 2024-05-12
- Подготовлен конфиг Render с Node.js-сервисом, подключённой базой данных и хелсчеком `/healthz` для автодеплоя предварительного превью.
- Настроен основной CI workflow (`ci.yml`) с `npm run lint`, `npm run typecheck` и `npm run build`, а также обновлён импорт карт под явный таргет-бранч.
- Next: добавить модульные тесты для инструментов импорта и реализовать клиентский декодер FRM.

## 2024-05-13
- Собран одностраничный клиент на Vite, который загружает JSON-карты и текстуры, рисует тайлы и объекты на канвасе, а также позволяет выбирать карту.
- Сервер теперь отдаёт список карт и их данные через `/api/maps`, дополнительно публикует метаданные ассетов и умеет раздавать предрендеренные PNG через `/art/**`.
- Next: дописать модульные тесты для инструментов импорта и расширить клиентский рендер анимациями и FRM-декодером.

## 2024-05-14
- Импортёр карт теперь сохраняет пиксельные `OffsetX/OffsetY` для объектов, чтобы совместить спрайты с тайлами на канвасе.
- Клиент и сервер передают и применяют оффсеты при проекции изометрических координат, благодаря чему декорации перестают «съезжать» и перекрываться.
- Next: реализовать загрузку FRM-анимаций и добавить модульные тесты для инструментов импорта.
