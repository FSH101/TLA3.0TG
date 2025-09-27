import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { WebSocketServer, type RawData, type WebSocket } from "ws";
import type { ClientMsg } from "@tla/shared";
import { MapStore } from "./mapStore.js";
import { Room } from "./room.js";

const PORT = Number(process.env.PORT ?? 3001);
const server = createServer();

const __dirname = dirname(fileURLToPath(import.meta.url));
const mapStore = new MapStore(join(__dirname, "maps"));
const rooms = new Map<string, Room>();

async function getRoom(id: string): Promise<Room> {
  const existing = rooms.get(id);
  if (existing) return existing;
  const map = await mapStore.load(id);
  const room = new Room(id, map);
  rooms.set(id, room);
  return room;
}

const wss = new WebSocketServer({ server });

wss.on("connection", (socket: WebSocket) => {
  let joinedRoom: Room | null = null;
  let playerId: string | null = null;

  socket.on("message", async (data: RawData) => {
    let parsed: ClientMsg;
    try {
      parsed = JSON.parse(data.toString()) as ClientMsg;
    } catch (err) {
      console.warn("не удалось разобрать сообщение", err);
      return;
    }

    if (parsed.type === "join") {
      try {
        joinedRoom = await getRoom(parsed.room);
        const player = joinedRoom.addPlayer(socket, parsed.nick);
        playerId = player.id;
        joinedRoom.sendTo(player.id, {
          type: "hello",
          you: player.id,
          room: joinedRoom.id,
          map: joinedRoom.getMap(),
          players: joinedRoom.getPlayerSnapshot(),
        });
        joinedRoom.broadcast(
          { type: "player-joined", id: player.id, pos: player.pos },
          player.id,
        );
      } catch (err) {
        console.error("ошибка подключения к комнате", err);
        socket.close(1008, (err as Error).message);
      }
      return;
    }

    if (parsed.type === "move") {
      if (!joinedRoom || !playerId) {
        return;
      }
      try {
        const pos = joinedRoom.movePlayer(playerId, parsed.to);
        joinedRoom.broadcast({ type: "player-moved", id: playerId, to: pos });
      } catch (err) {
        console.warn("не удалось обработать перемещение", err);
      }
    }
  });

  socket.on("close", () => {
    if (!joinedRoom) return;
    const player = joinedRoom.removeSocket(socket);
    if (player) {
      joinedRoom.broadcast({ type: "player-left", id: player.id });
    }
  });
});

server.listen(PORT, () => {
  console.log(`WS-сервер запущен на ws://localhost:${PORT}`);
});
