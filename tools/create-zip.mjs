#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import path from "node:path";

const rootUrl = new URL("..", import.meta.url);
const root = path.resolve(decodeURIComponent(rootUrl.pathname));
const outputDir = path.join(root, "artifacts");
const outputZip = path.join(outputDir, "project.zip");

function ensureZipAvailable() {
  const result = spawnSync("zip", ["--version"], { stdio: "ignore" });
  if (result.error || result.status !== 0) {
    throw new Error(
      "Утилита 'zip' недоступна. Установите zip (apt-get install zip) или используйте эквивалент."
    );
  }
}

function createZip() {
  if (existsSync(outputZip)) {
    rmSync(outputZip);
  }
  mkdirSync(outputDir, { recursive: true });

  const exclusions = [
    "artifacts/*",
    ".git/*",
    "node_modules/*",
    "client/node_modules/*",
    "server/node_modules/*",
    "shared/node_modules/*",
    "client/dist/*",
    "server/dist/*",
    "shared/dist/*",
    "dist/*",
    "*.zip",
    "*.log",
    "npm-debug.log*",
    ".DS_Store",
  ];

  const args = ["-r", outputZip, ".", "-x", ...exclusions];
  const result = spawnSync("zip", args, { stdio: "inherit", cwd: root });
  if (result.status !== 0) {
    throw new Error("Не удалось создать архив проекта.");
  }
}

try {
  ensureZipAvailable();
  createZip();
  console.log(`Архив создан: ${outputZip}`);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
