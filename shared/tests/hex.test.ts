import { describe, expect, it } from "vitest";
import { hexDistance, hexToWorld, worldToHex } from "../src/hex";

describe("математика гексагональной сетки", () => {
  it("hexToWorld и worldToHex примерно взаимно обратны", () => {
    for (let q = -10; q <= 10; q += 2) {
      for (let r = -10; r <= 10; r += 2) {
        const world = hexToWorld({ q, r });
        const result = worldToHex(world.x, world.y);
        expect(result.q).toBe(q);
        expect(result.r).toBe(r);
      }
    }
  });

  it("worldToHex притягивает к ближайшему центру", () => {
    for (let i = 0; i < 100; i += 1) {
      const q = Math.floor(Math.random() * 20) - 10;
      const r = Math.floor(Math.random() * 20) - 10;
      const world = hexToWorld({ q, r });
      const offsetX = (Math.random() - 0.5) * 20;
      const offsetY = (Math.random() - 0.5) * 20;
      const snapped = worldToHex(world.x + offsetX, world.y + offsetY);
      expect(snapped.q).toBe(q);
      expect(snapped.r).toBe(r);
    }
  });

  it("hexDistance совпадает с кубической метрикой", () => {
    const randomHex = () => ({
      q: Math.floor(Math.random() * 40) - 20,
      r: Math.floor(Math.random() * 40) - 20,
    });

    for (let i = 0; i < 100; i += 1) {
      const a = randomHex();
      const b = randomHex();
      const expected =
        (Math.abs(a.q - b.q) + Math.abs(a.q + a.r - (b.q + b.r)) + Math.abs(a.r - b.r)) / 2;
      expect(hexDistance(a, b)).toBe(expected);
    }
  });
});
