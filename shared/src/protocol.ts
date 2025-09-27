import type { Hex } from "./hex";
import type { MapJSON } from "./map";

export type ClientMsg =
  | { type: "join"; room: "demo"; nick: string; build: string }
  | { type: "move"; to: Hex };

export type ServerMsg =
  | { type: "hello"; you: string; room: string; map: MapJSON; players: Record<string, Hex> }
  | { type: "player-joined"; id: string; pos: Hex }
  | { type: "player-moved"; id: string; to: Hex }
  | { type: "player-left"; id: string };
