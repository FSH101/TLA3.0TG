import { createServer, IncomingMessage, ServerResponse } from "node:http";
import { fileURLToPath } from "node:url";
import { dirname, isAbsolute, join, normalize, sep } from "node:path";
import { readFile, stat } from "node:fs/promises";
import { WebSocketServer, type RawData, type WebSocket } from "ws";
import type { ClientMsg } from "@tla/shared";
import { MapStore } from "./mapStore.js";
import { Room } from "./room.js";

const PORT = Number(process.env.PORT ?? 3001);
const server = createServer((req, res) => {
  void handleHttp(req, res);
});

const __dirname = dirname(fileURLToPath(import.meta.url));
const mapStore = new MapStore(join(__dirname, "maps"));
const rooms = new Map<string, Room>();
const staticDirEnv = process.env.STATIC_DIR;
const staticRoot = staticDirEnv
  ? normalize(isAbsolute(staticDirEnv) ? staticDirEnv : join(__dirname, staticDirEnv))
  : normalize(join(__dirname, "../../client/dist"));
const staticRootWithSep = staticRoot.endsWith(sep) ? staticRoot : `${staticRoot}${sep}`;

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

async function handleHttp(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (!req.url || !req.method) {
    res.statusCode = 400;
    res.end("Bad Request");
    return;
  }

  if (req.method !== "GET" && req.method !== "HEAD") {
    res.statusCode = 405;
    res.setHeader("Allow", "GET, HEAD");
    res.end("Method Not Allowed");
    return;
  }

  try {
    const url = new URL(req.url, `http://${req.headers.host ?? "localhost"}`);
    const pathname = decodeURIComponent(url.pathname);
    const target = resolveStaticPath(pathname);
    const file = await loadFile(target);

    if (req.method === "HEAD") {
      res.statusCode = 200;
      res.setHeader("Content-Type", file.contentType);
      res.setHeader("Content-Length", file.buffer.length);
      res.end();
      return;
    }

    res.statusCode = 200;
    res.setHeader("Content-Type", file.contentType);
    res.end(file.buffer);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      await serveIndex(req, res);
      return;
    }

    console.error("ошибка при отдаче статического файла", err);
    res.statusCode = 500;
    res.end("Internal Server Error");
  }
}

async function serveIndex(req: IncomingMessage, res: ServerResponse): Promise<void> {
  try {
    const indexPath = resolveStaticPath("/index.html");
    const file = await loadFile(indexPath);
    if (req.method === "HEAD") {
      res.statusCode = 200;
      res.setHeader("Content-Type", file.contentType);
      res.setHeader("Content-Length", file.buffer.length);
      res.end();
      return;
    }
    res.statusCode = 200;
    res.setHeader("Content-Type", file.contentType);
    res.end(file.buffer);
  } catch (err) {
    console.error("не удалось отдать index.html", err);
    res.statusCode = 404;
    res.end("Not Found");
  }
}

function resolveStaticPath(pathname: string): string {
  if (!pathname || pathname === "/") {
    return join(staticRoot, "index.html");
  }

  const trimmed = pathname.startsWith("/") ? pathname.slice(1) : pathname;
  const normalized = normalize(trimmed);
  if (normalized.startsWith("..")) {
    throw Object.assign(new Error("Недопустимый путь"), { code: "ENOENT" });
  }

  const fullPath = normalize(join(staticRoot, normalized));
  if (fullPath !== staticRoot && !fullPath.startsWith(staticRootWithSep)) {
    throw Object.assign(new Error("Недопустимый путь"), { code: "ENOENT" });
  }
  return fullPath;
}

async function loadFile(filePath: string): Promise<{ buffer: Buffer; contentType: string }> {
  const fileStat = await stat(filePath);
  if (fileStat.isDirectory()) {
    throw Object.assign(new Error("Папка"), { code: "ENOENT" });
  }

  const buffer = await readFile(filePath);
  const contentType = getContentType(filePath);
  return { buffer, contentType };
}

function getContentType(filePath: string): string {
  const extension = filePath.split(".").pop()?.toLowerCase();
  switch (extension) {
    case "html":
      return "text/html; charset=utf-8";
    case "js":
      return "application/javascript; charset=utf-8";
    case "css":
      return "text/css; charset=utf-8";
    case "json":
      return "application/json; charset=utf-8";
    case "svg":
      return "image/svg+xml";
    case "png":
      return "image/png";
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "ico":
      return "image/x-icon";
    case "txt":
      return "text/plain; charset=utf-8";
    case "webmanifest":
      return "application/manifest+json; charset=utf-8";
    default:
      return "application/octet-stream";
  }
}
