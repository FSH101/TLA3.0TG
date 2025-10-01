# TLA3.0TG

This repository hosts the Fallout-inspired tactical lobby alpha 3.0 tech groundwork. All new implementation follows the detailed MVP specification captured in [`docs/TASKS.md`](docs/TASKS.md) and the running progress notes in [`docs/LOG.md`](docs/LOG.md).

The project is being developed as a TypeScript-first monorepo with the following high-level goals:

- Automated tooling to import original FOnline maps (`.fomap`) and proto definitions into structured JSON files under `assets/maps/`.
- Runtime and pre-conversion support for Fallout FR/FRM art assets stored in `assets_1/art/**`.
- A Node.js server providing REST + WebSocket APIs with authentication, map data, and game-state synchronization.
- A Vite + PixiJS client that renders hex-based maps, handles FRM animations, and communicates via the shared WebSocket protocol.
- CI/CD coverage (lint, typecheck, build) and Render deployment for an always-on preview environment.

Refer to the task checklist to see the planned implementation order (import tooling and runtime FRM decoder come first), and consult the development log for status updates and next steps.
