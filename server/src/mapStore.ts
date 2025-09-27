import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { MapJSON } from "@tla/shared";

export class MapStore {
  constructor(private readonly basePath: string) {}

  async load(id: string): Promise<MapJSON> {
    const file = join(this.basePath, `${id}.json`);
    const raw = await readFile(file, "utf8");
    return JSON.parse(raw) as MapJSON;
  }
}
