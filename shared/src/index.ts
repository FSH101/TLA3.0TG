export type Direction = 'N' | 'S' | 'E' | 'W';

export interface HelloMessage {
  type: 'hello';
  name?: string;
}

export interface MoveMessage {
  type: 'move';
  direction: Direction;
}

export interface OpenDoorMessage {
  type: 'openDoor';
  doorId: string;
}

export type ClientMessage = HelloMessage | MoveMessage | OpenDoorMessage;

export interface TileLayerSnapshot {
  id: string;
  texture: string;
  tiles: number[];
}

export interface DoorSnapshot {
  id: string;
  position: { x: number; y: number; level: number };
  isOpen: boolean;
  textureClosed: string;
  textureOpen: string;
}

export interface MapSnapshot {
  width: number;
  height: number;
  tileSize: number;
  levels: number;
  layers: TileLayerSnapshot[];
  doors: DoorSnapshot[];
}

export interface PlayerState {
  id: string;
  position: { x: number; y: number; level: number };
  facing: Direction;
  name?: string;
}

export interface WorldState {
  players: PlayerState[];
  doors: Array<Pick<DoorSnapshot, 'id' | 'isOpen'>>;
  serverTime: number;
}

export interface WelcomeMessage {
  type: 'welcome';
  youId: string;
  map: MapSnapshot;
  state: WorldState;
}

export interface StateMessage {
  type: 'state';
  state: WorldState;
}

export interface ErrorMessage {
  type: 'error';
  message: string;
}

export type ServerMessage = WelcomeMessage | StateMessage | ErrorMessage;

export const DIRECTIONS: Direction[] = ['N', 'E', 'S', 'W'];

export const directionVectors: Record<Direction, { dx: number; dy: number }> = {
  N: { dx: 0, dy: -1 },
  E: { dx: 1, dy: 0 },
  S: { dx: 0, dy: 1 },
  W: { dx: -1, dy: 0 }
};
