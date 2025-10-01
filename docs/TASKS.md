# Project Task Checklist

This document tracks the mandatory deliverables for the Fallout-inspired web remake MVP, broken down into focused pull requests so the work can proceed incrementally while keeping CI green.

## Repository scaffolding
- [ ] Establish npm workspaces with packages for `server`, `client`, `shared`, and `tools`.
- [ ] Add strict TypeScript configs, ESLint, Prettier, and the shared `.gitignore` rules.
- [ ] Provide Render deployment config (`render.yaml`) and GitHub Actions workflows for CI and map importing.
- [ ] Populate `packages/server/.env.example` with all required environment variables.

## Tools: map and asset import
- [ ] Implement `.fomap` parser (`packages/tools/fomap-import.ts`) producing structured map data.
- [ ] Implement proto PID resolver (`packages/tools/proto-resolve.ts`).
- [ ] Build CLI importer (`packages/tools/import-map.ts`) that writes `assets/maps/<mapId>.json`.
- [ ] Provide `import-all` utility and npm scripts to batch-generate maps.
- [ ] Add unit tests for the import tooling.

## Client runtime FR/FRM decoding
- [ ] Add the canonical Fallout palette module.
- [ ] Implement FRM decoder returning cached atlases with canvases per frame.
- [ ] Integrate asset loading fallback chain (`.png|.gif` → `.frm|fr?`).
- [ ] Cover edge cases with decoder unit tests.

## Server platform
- [ ] Wire Express HTTP server with static asset routing (including `/art/**` fallbacks to original assets).
- [ ] Expose health, map list, and map detail REST endpoints.
- [ ] Implement authentication stack (register, login, refresh, logout, me) with Prisma, bcrypt, JWT, cookie refresh tokens, rate limiting, and Zod validation.
- [ ] Set up WebSocket endpoint `/ws` implementing the specified protocol and in-memory world state.
- [ ] Add shared networking types in `packages/shared/net.ts`.
- [ ] Provide map loader cache and hex math helpers with unit tests.

## Client gameplay loop
- [ ] Initialize Vite + PixiJS app rendering full-screen hex map with layers and Z-sorting.
- [ ] Fetch map data and render ground, roof, objects, and players.
- [ ] Implement FRM-driven character animations (idle/walk, 6 directions).
- [ ] Add input handling for movement, turning, chat, and mobile fullscreen toggle.
- [ ] Hook up WebSocket client to send/receive the defined protocol, including interpolation and ping overlay.
- [ ] Add minimal UI for authentication and map selection.

## Deployment & quality gates
- [ ] Ensure `npm run lint`, `npm run typecheck`, and `npm run build` succeed locally and in CI.
- [ ] Document `npm run dev` and testing instructions in `README.md`.
- [ ] Provide Render-ready start command and validate `/healthz`.
- [ ] Create optional FR→PNG/GIF conversion workflow (`packages/tools/fr2gif.ts`) and GitHub Action trigger.

## Post-MVP roadmap (for reference)
- [ ] Pathfinding (A*) with occupied cell awareness.
- [ ] Separate map instances/rooms and world persistence.
- [ ] Combat systems, inventories, and scripted interactions.
- [ ] Sprite atlases, batching, and FRM frame caching optimizations.
- [ ] Optional Telegram Mini App authentication provider.
