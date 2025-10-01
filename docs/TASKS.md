TASKS.md — Браузерная онлайн-игра (веб-порт с нуля)

Правила для Codex:

Прочитай TASKS.md. 2) Выполни только первый невыполненный шаг. 3) Проверь «Done when». 4) Если не выполнено — заполни STATE.last_error и остановись без коммита. 5) Если выполнено — один коммит по шаблону, отметь чекбокс, обнови STATE, остановись.

STATE

last_completed_step: none

next_step_hint: TASK-000

last_error:

Цели проекта

Веб-клиент (TypeScript + Vite + PixiJS/Phaser) с изометрическим/топ-даун 2D-рендером, UI, управлением.

Онлайн-синхронизация через WebSocket (Node.js + ws/Express), авторитарный сервер для честной симуляции.

Ядро механик: карта (тайлсет/слои), спавны, лут/инвентарь, статы персонажа, стрельба/урон/броня, простейший ИИ, триггеры и зоны (safe/quest), чат.

Минимальная персистентность (SQLite/Prisma): аккаунт/профиль, базовые прогрессы.

Инструменты: конвертация ассетов (FR→GIF/PNG + meta.json; при необходимости FOMAP→map.json), JSON-схемы данных.

Технологии (зафиксировано)

Client: TypeScript, Vite, PixiJS (или Phaser — см. TASK-012), Zustand (состояние), Zod (валидация), Playwright (smoke E2E).

Server: Node 20+, Express, ws, Prisma (SQLite dev → Postgres prod).

Статика: /assets/** — единственный источник ассетов.

Архитектура: модульная, ECS-лайт (Entity + компоненты), авторитарный сервер, клиент — предикт/интерполяция.

ФАЗА A — Чистый старт и каркас
TASK-000: Чистый старт репозитория

Действия

Создать ветку chore/web-online-boot.

Оставить в корне: /assets/**, README.md, .gitignore, LICENSE (если есть), TASKS.md. Всё остальное удалить через git rm -r.
Done when

В репо только перечисленное.
Коммит

chore(repo): clean start keeping only /assets and docs — Refs: TASK-000

TASK-001: Bootstrap клиента

Действия

Создать Client/ (Vite + TS), страницу / с заглушкой «Online build ok».

В vite.config.ts добавить алиас @assets → /assets.

Скрипты в корне: dev:client, build:client.
Done when

pnpm dev:client поднимает страницу, импорт из @assets работает.
Коммит

feat(client): bootstrap Vite+TS with @assets alias — Refs: TASK-001

TASK-002: Bootstrap сервера

Действия

Создать Server/ (Node+Express+ws), /healthz → ok, WS /ws отдает echo.

Скрипты в корне: dev:server, dev (параллельно клиент+сервер).
Done when

curl /healthz ok, WS echo отвечает.
Коммит

feat(server): bootstrap express+ws with healthz/echo — Refs: TASK-002

ФАЗА B — Спеки и конвертация ассетов
TASK-010: JSON-схемы данных (v1)

Действия

Client/spec/map.schema.json: meta, grid, tilesets, layers, objects, triggers, spawn, collisions.

Client/spec/sprite.schema.json: анимации (кадры, направления, длительности).

Примеры в assets/examples/**.
Done when

Примеры валидируются Zod/AJV в отдельном скрипте.
Коммит

feat(spec): add map & sprite schemas v1 with examples — Refs: TASK-010

TASK-011: Конвертер FR → GIF/PNG (+meta.json)

Действия

scripts/convert-fr-to-gif.mjs: на вход FR-файлы из /assets/**, на выход спрайт-листы (GIF/PNG) + meta.json по sprite.schema.json в assets/sprites/<entity>/**.
Done when

На 2–3 примерах конверсия успешна, мета читается клиентом.
Коммит

feat(tooling): FR→GIF/PNG converter with sprite meta — Refs: TASK-011

TASK-012: (Опция) Переключатель PixiJS↔Phaser

Действия

Подготовить минимальный абстрактный слой рендера с одним Renderer интерфейсом и двумя имплементациями (Pixi/Phaser), выбор через env.
Done when

Стартовая сцена рендерится в обоих режимах.
Коммит

chore(render): add renderer abstraction (pixi|phaser) — Refs: TASK-012

ФАЗА C — Клиентский движок
TASK-020: Игровой цикл и сцены

Действия

Client/src/engine/core/{loop,scene}.ts: fixed update 60fps, delta, пауза, менеджер сцен.
Done when

Переключение boot → loading → gameplay.
Коммит

feat(engine): loop and scene manager — Refs: TASK-020

TASK-021: Загрузчик ресурсов

Действия

Унифицированный лоадер json/images/audio, прогресс-бар. Регистрация ассетов из /assets.
Done when

Ассеты карт и спрайтов грузятся через единый API.
Коммит

feat(engine): resource loader with progress — Refs: TASK-021

TASK-022: Рендер карты (изо/топ-даун)

Действия

engine/map/tilemap.ts: слои, порядки, оффсеты; камера (pan/zoom), границы, выбор клетки.
Done when

Карта-пример рендерится стабильно.
Коммит

feat(map): tile renderer with camera & hover — Refs: TASK-022

TASK-023: Коллизии и A*

Действия

Маска коллизий по слою; A* по grid; клик-to-move.
Done when

Персонаж строит и проходит маршрут по клику.
Коммит

feat(nav): grid collisions and pathfinding — Refs: TASK-023

TASK-024: Сущности и анимации

Действия

База Entity + компоненты: Transform, SpriteAnim (читает meta.json), Stats(HP/Armor).
Done when

Игрок анимируется в idle/walk с направлениями.
Коммит

feat(entities): base entity & sprite animation — Refs: TASK-024

TASK-025: Инвентарь и лут

Действия

Модель предмета, слоты, drag&drop UI, экипировка (модификаторы статов).
Done when

DnD работает, статы меняются от экипировки.
Коммит

feat(inventory): items, slots, drag-and-drop — Refs: TASK-025

TASK-026: Бой (минимум)

Действия

Луч/пули, урон, КД, точность, броня; визуальные эффекты (muzzle/hit, хп-бар).
Done when

Игрок наносит урон манекену; КД и броня учитываются.
Коммит

feat(combat): realtime-lite combat loop — Refs: TASK-026

ФАЗА D — Сеть и серверная логика
TASK-030: Протокол WS (v0)

Действия

Определить типы сообщений: join, state, input, hit, loot, chat.

Клиент: предикт ввода, интерполяция; Сервер: авторитарная позиция/урон.
Done when

Два клиента в одной комнате видят друг друга корректно.
Коммит

feat(net): ws protocol v0 (authoritative server) — Refs: TASK-030

TASK-031: Синхронизация состояния

Действия

Серверные тики (20–30 т/с), снапшоты, delta-компрессия (простая).
Done when

Стабильная позиционная синхронизация без «телепортов».
Коммит

feat(net): snapshot sync & client interpolation — Refs: TASK-031

TASK-032: Спавны, зоны, триггеры

Действия

Серверные зоны (safe/PvP), триггеры enter/leave; спавн-поинты.
Done when

Вход/выход из зоны меняет правила урона/агрессии.
Коммит

feat(server): zones and triggers — Refs: TASK-032

TASK-033: Персистентность (минимум)

Действия

Prisma + SQLite: таблицы users, profiles. Эндпоинт гостевого входа.
Done when

Профиль создаётся и читается, базовые поля сохраняются.
Коммит

feat(db): prisma sqlite bootstrap (users/profiles) — Refs: TASK-033

ФАЗА E — UI/UX и мета
TASK-040: HUD и инвентарь-UI

Действия

HP/Armor/Ammo, мини-карта, горячие слоты, чат, лог событий.
Done when

Все элементы обновляются в реальном времени.
Коммит

feat(ui): hud, hotbar, chat, event log — Refs: TASK-040

TASK-041: Меню и настройка управления

Действия

Ремап клавиш/сенсорных жестов; чувствительность; режимы камеры.
Done when

Настройки сохраняются в localStorage, применяются без перезапуска.
Коммит

feat(ui): settings (bindings/sensitivity) — Refs: TASK-041

ФАЗА F — E2E, деплой, защита от очевидного читерства
TASK-050: E2E-smoke (Playwright)

Действия

Тест: два клиента подключаются, перемещаются, видят состояние.
Done when

Тест зелёный в CI.
Коммит

test(e2e): two-clients movement & visibility — Refs: TASK-050

TASK-051: Деплой превью

Действия

Client → Vercel/Netlify, Server → Render/Fly.io; env-vars; CORS/WS.
Done when

Публичные URLs для клиента и сервера, игра запускается.
Коммит

chore(deploy): preview hosting for client/server — Refs: TASK-051

TASK-052: Базовая защита

Действия

Сервер валидирует вход (скорость, через стены, урон вне зоны); простая rate-limit по IP/сессии.
Done when

Нелегитимные действия отклоняются сервером.
Коммит

feat(anticheat): sanity checks and rate limits — Refs: TASK-052

Чеклист (Codex отмечает)

 TASK-000 — clean start

 TASK-001 — client bootstrap

 TASK-002 — server bootstrap

 TASK-010 — schemas v1

 TASK-011 — FR→GIF/PNG converter

 TASK-012 — renderer abstraction (opt)

 TASK-020 — loop & scenes

 TASK-021 — resource loader

 TASK-022 — tile renderer

 TASK-023 — collisions & A*

 TASK-024 — entities & anim

 TASK-025 — inventory

 TASK-026 — combat

 TASK-030 — ws protocol v0

 TASK-031 — snapshot sync

 TASK-032 — zones & triggers

 TASK-033 — persistence

 TASK-040 — HUD & UI

 TASK-041 — settings

 TASK-050 — e2e smoke

 TASK-051 — deploy

 TASK-052 — anticheat sanity

Примечания

Если ассеты в экзотических форматах — сначала добавь/запусти конвертеры (TASK-011 и при необходимости FOMAP→JSON, можно вставить как TASK-013).

Сервер всегда «истина»: клиент лишь предсказывает и интерполирует.

Любая ошибка в шаге — сразу STATE.last_error и остановка без коммита.
