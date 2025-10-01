import express from 'express';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { WebSocketServer, WebSocket } from 'ws';
import { nanoid } from 'nanoid';
import {
  ClientMessage,
  directionVectors,
  DoorSnapshot,
  MapSnapshot,
  PlayerState,
  ServerMessage,
  WorldState
} from '@tla/shared';

const PORT = Number(process.env.PORT ?? 3000);
const BROADCAST_INTERVAL_MS = 100;
const TILE_SIZE = 48;
const MAP_WIDTH = 50;
const MAP_HEIGHT = 50;
const LEVELS = 1;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const clientDistPath = path.resolve(__dirname, '../../client/dist');
const interfaceAssetPath = path.resolve(
  __dirname,
  '../../external/FOnline-TlaMk2/Client/data/art/intrface'
);

interface ClientContext {
  id: string;
  socket: WebSocket;
  playerId?: string;
  name?: string;
}

type DoorState = Pick<DoorSnapshot, 'id' | 'isOpen' | 'position' | 'textureClosed' | 'textureOpen'>;

const app = express();
app.use(express.static(clientDistPath));
app.use(
  '/interface-assets',
  express.static(interfaceAssetPath, {
    fallthrough: true,
    maxAge: '7d'
  })
);

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

const baseLayerTiles = new Array(MAP_WIDTH * MAP_HEIGHT).fill(1);

const doors: DoorState[] = [
  {
    id: 'd1',
    position: { x: 12, y: 12, level: 0 },
    isOpen: false,
    textureClosed: 'doorClosed',
    textureOpen: 'doorOpen'
  }
];

const doorById = new Map<string, DoorState>(doors.map((door) => [door.id, door]));
const doorByPosition = new Map<string, DoorState>(
  doors.map((door) => [`${door.position.level}:${door.position.x}:${door.position.y}`, door])
);

const mapSnapshot: MapSnapshot = {
  width: MAP_WIDTH,
  height: MAP_HEIGHT,
  tileSize: TILE_SIZE,
  levels: LEVELS,
  layers: [
    {
      id: 'floor',
      texture: 'floor',
      tiles: baseLayerTiles
    }
  ],
  doors
};

const players = new Map<string, PlayerState>();
const clients = new Map<WebSocket, ClientContext>();
let pendingBroadcast = false;

function getWorldState(): WorldState {
  return {
    players: Array.from(players.values()),
    doors: doors.map((door) => ({ id: door.id, isOpen: door.isOpen })),
    serverTime: Date.now()
  };
}

function broadcastState(): void {
  const message: ServerMessage = { type: 'state', state: getWorldState() };
  const raw = JSON.stringify(message);
  let sent = 0;
  for (const client of clients.values()) {
    if (client.socket.readyState === WebSocket.OPEN && client.playerId) {
      client.socket.send(raw);
      sent += 1;
    }
  }
  if (sent > 0) {
    console.log(`[ws] broadcast state to ${sent} clients`);
  }
}

function isPassable(level: number, x: number, y: number): boolean {
  if (level < 0 || level >= LEVELS) return false;
  if (x < 0 || x >= MAP_WIDTH) return false;
  if (y < 0 || y >= MAP_HEIGHT) return false;
  const doorKey = `${level}:${x}:${y}`;
  const doorAtCell = doorByPosition.get(doorKey);
  if (doorAtCell && !doorAtCell.isOpen) {
    return false;
  }
  return true;
}

function findSpawnPosition(): { x: number; y: number; level: number } {
  // Spawn near the top-left, but avoid collisions.
  const level = 0;
  for (let radius = 0; radius < Math.max(MAP_WIDTH, MAP_HEIGHT); radius += 1) {
    for (let dy = -radius; dy <= radius; dy += 1) {
      for (let dx = -radius; dx <= radius; dx += 1) {
        const x = 2 + dx;
        const y = 2 + dy;
        if (!isPassable(level, x, y)) continue;
        const occupied = Array.from(players.values()).some(
          (player) => player.position.level === level && player.position.x === x && player.position.y === y
        );
        if (!occupied) {
          return { level, x, y };
        }
      }
    }
  }
  return { level: 0, x: 1, y: 1 };
}

function markDirty() {
  pendingBroadcast = true;
}

wss.on('connection', (socket) => {
  const client: ClientContext = { id: nanoid(), socket };
  clients.set(socket, client);
  console.log(`[ws] client connected, total=${clients.size}`);

  socket.on('message', (data) => {
    let payload: ClientMessage | undefined;
    try {
      payload = JSON.parse(String(data));
    } catch (error) {
      console.warn('[ws] failed to parse message', error);
      socket.send(JSON.stringify({ type: 'error', message: 'invalid json payload' } satisfies ServerMessage));
      return;
    }

    if (!payload || typeof (payload as { type?: string }).type !== 'string') {
      socket.send(JSON.stringify({ type: 'error', message: 'unknown command' } satisfies ServerMessage));
      return;
    }

    if (payload.type === 'hello') {
      if (client.playerId) {
        socket.send(JSON.stringify({ type: 'error', message: 'already joined' } satisfies ServerMessage));
        return;
      }
      const spawn = findSpawnPosition();
      const playerId = client.id;
      const player: PlayerState = {
        id: playerId,
        position: spawn,
        facing: 'S',
        name: payload.name?.slice(0, 24)
      };
      players.set(playerId, player);
      client.playerId = playerId;
      client.name = player.name;
      const welcome: ServerMessage = {
        type: 'welcome',
        youId: playerId,
        map: mapSnapshot,
        state: getWorldState()
      };
      socket.send(JSON.stringify(welcome));
      markDirty();
      return;
    }

    if (!client.playerId) {
      socket.send(JSON.stringify({ type: 'error', message: 'join first' } satisfies ServerMessage));
      return;
    }

    if (payload.type === 'move') {
      const player = players.get(client.playerId);
      if (!player) return;
      const vector = directionVectors[payload.direction];
      if (!vector) {
        socket.send(JSON.stringify({ type: 'error', message: 'unknown direction' } satisfies ServerMessage));
        return;
      }
      const target = {
        level: player.position.level,
        x: player.position.x + vector.dx,
        y: player.position.y + vector.dy
      };
      player.facing = payload.direction;
      if (!isPassable(target.level, target.x, target.y)) {
        socket.send(JSON.stringify({ type: 'error', message: 'tile blocked' } satisfies ServerMessage));
        markDirty();
        return;
      }
      player.position = target;
      players.set(player.id, player);
      markDirty();
      return;
    }

    if (payload.type === 'openDoor') {
      const player = players.get(client.playerId);
      if (!player) return;
      const door = doorById.get(payload.doorId);
      if (!door) {
        socket.send(JSON.stringify({ type: 'error', message: 'unknown door' } satisfies ServerMessage));
        return;
      }
      const distance = Math.abs(player.position.x - door.position.x) + Math.abs(player.position.y - door.position.y);
      if (player.position.level !== door.position.level || distance > 1) {
        socket.send(JSON.stringify({ type: 'error', message: 'door too far away' } satisfies ServerMessage));
        return;
      }
      door.isOpen = !door.isOpen;
      markDirty();
      return;
    }

    socket.send(JSON.stringify({ type: 'error', message: 'unknown command' } satisfies ServerMessage));
  });

  socket.on('close', () => {
    clients.delete(socket);
    if (client.playerId) {
      players.delete(client.playerId);
      markDirty();
    }
    console.log(`[ws] client disconnected, total=${clients.size}`);
  });

  socket.on('error', (error) => {
    console.error('[ws] connection error', error);
  });
});

setInterval(() => {
  if (!pendingBroadcast) {
    return;
  }
  pendingBroadcast = false;
  broadcastState();
}, BROADCAST_INTERVAL_MS);

server.listen(PORT, () => {
  console.log(`listening on PORT ${PORT}`);
  console.log(`serving client bundle from ${clientDistPath}`);
});
