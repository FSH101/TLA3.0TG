import './style.css';

import type {
  DoorSnapshot,
  MapSnapshot,
  PlayerState,
  ServerMessage,
  StateMessage,
  WelcomeMessage,
  WorldState
} from '@tla/shared';

interface AssetManifest {
  [key: string]: string;
}

type RuntimeAssets = Record<string, CanvasImageSource>;

const canvas = document.createElement('canvas');
const context = canvas.getContext('2d');
if (!context) {
  throw new Error('Canvas API is not available');
}
const ctx = context;
document.body.appendChild(canvas);
canvas.className = 'game-canvas';

const statusEl = document.createElement('div');
statusEl.className = 'hud';
statusEl.textContent = 'Connecting…';
document.body.appendChild(statusEl);

const TILE_SIZE = 48;
const MOVE_COOLDOWN_MS = 175;
let lastMoveAt = 0;

let youId: string | null = null;
let mapSnapshot: MapSnapshot | null = null;
let doorSnapshots: DoorSnapshot[] = [];
let state: WorldState | null = null;
let assets: RuntimeAssets = {};
let manifest: AssetManifest = {};
let ws: WebSocket | null = null;
let reconnectTimer: number | null = null;

function resizeCanvas() {
  if (!mapSnapshot) {
    canvas.width = 800;
    canvas.height = 600;
    return;
  }
  canvas.width = mapSnapshot.width * mapSnapshot.tileSize;
  canvas.height = mapSnapshot.height * mapSnapshot.tileSize;
}

function loadImage(name: string, src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load asset ${name}`));
    img.src = src;
  });
}

function createFallbackImage(color: string): HTMLCanvasElement {
  const fallbackCanvas = document.createElement('canvas');
  fallbackCanvas.width = TILE_SIZE;
  fallbackCanvas.height = TILE_SIZE;
  const context = fallbackCanvas.getContext('2d');
  if (context) {
    context.fillStyle = color;
    context.fillRect(0, 0, TILE_SIZE, TILE_SIZE);
  }
  return fallbackCanvas;
}

async function loadManifest(url: string): Promise<AssetManifest> {
  try {
    const response = await fetch(url, { cache: 'force-cache' });
    if (!response.ok) {
      throw new Error(`manifest ${response.status}`);
    }
    return (await response.json()) as AssetManifest;
  } catch (error) {
    console.warn('Failed to load manifest, using fallback assets', error);
    return {};
  }
}

async function loadAssets() {
  const manifestUrl = import.meta.env.VITE_ASSET_MANIFEST ?? '/assets/asset-manifest.json';
  manifest = await loadManifest(manifestUrl);
  const assetPromises = Object.entries(manifest).map(([key, value]) =>
    loadImage(key, value)
      .then((img) => {
        assets[key] = img;
      })
      .catch(() => {
        const fallback = createFallbackImage('#444');
        assets[key] = fallback;
      })
  );
  await Promise.all(assetPromises);
  if (!assets.floor) {
    const fallback = createFallbackImage('#333');
    assets.floor = fallback;
  }
  if (!assets.doorClosed) {
    const fallback = createFallbackImage('#6b1');
    assets.doorClosed = fallback;
  }
  if (!assets.doorOpen) {
    const fallback = createFallbackImage('#c93');
    assets.doorOpen = fallback;
  }
}

function drawFloor() {
  if (!mapSnapshot) return;
  const layer = mapSnapshot.layers[0];
  const image = assets[layer.texture] ?? assets.floor;
  const tileWidth = mapSnapshot.tileSize;
  for (let y = 0; y < mapSnapshot.height; y += 1) {
    for (let x = 0; x < mapSnapshot.width; x += 1) {
      ctx.drawImage(image, x * tileWidth, y * tileWidth, tileWidth, tileWidth);
    }
  }
}

function drawDoors() {
  const tileSize = mapSnapshot?.tileSize ?? TILE_SIZE;
  for (const door of doorSnapshots) {
    const assetKey = door.isOpen ? door.textureOpen : door.textureClosed;
    const x = door.position.x * tileSize;
    const y = door.position.y * tileSize;
    const image = assets[assetKey];
    if (image) {
      ctx.drawImage(image, x, y, tileSize, tileSize);
    } else {
      ctx.fillStyle = door.isOpen ? '#4caf50' : '#8d5524';
      ctx.fillRect(x, y, tileSize, tileSize);
    }
  }
}

function drawPlayers() {
  if (!state) return;
  const tileSize = mapSnapshot?.tileSize ?? TILE_SIZE;
  for (const player of state.players) {
    const x = player.position.x * tileSize + tileSize / 2;
    const y = player.position.y * tileSize + tileSize / 2;
    ctx.fillStyle = player.id === youId ? '#6cf' : '#f55';
    ctx.beginPath();
    ctx.arc(x, y, tileSize * 0.3, 0, Math.PI * 2);
    ctx.fill();
  }
}

function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (!mapSnapshot) {
    ctx.fillStyle = '#111';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    requestAnimationFrame(render);
    return;
  }
  drawFloor();
  drawDoors();
  drawPlayers();
  requestAnimationFrame(render);
}

function updateStatus(text: string, level: 'info' | 'error' = 'info') {
  statusEl.textContent = text;
  statusEl.dataset.level = level;
}

function handleStateUpdate(newState: WorldState) {
  state = newState;
  if (!mapSnapshot) return;
  doorSnapshots = mapSnapshot.doors.map((door) => ({
    ...door,
    isOpen: newState.doors.find((d) => d.id === door.id)?.isOpen ?? door.isOpen
  }));
  updateStatus(`Players online: ${newState.players.length}`);
}

function sendMessage(message: unknown) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(message));
  }
}

function attemptMove(direction: PlayerState['facing']) {
  const now = performance.now();
  if (now - lastMoveAt < MOVE_COOLDOWN_MS) {
    return;
  }
  lastMoveAt = now;
  sendMessage({ type: 'move', direction });
}

function tryToggleDoor(x: number, y: number) {
  const door = doorSnapshots.find((d) => d.position.x === x && d.position.y === y);
  if (door) {
    sendMessage({ type: 'openDoor', doorId: door.id });
  }
}

function setupInput() {
  window.addEventListener('keydown', (event) => {
    switch (event.key) {
      case 'ArrowUp':
      case 'w':
      case 'W':
        attemptMove('N');
        break;
      case 'ArrowDown':
      case 's':
      case 'S':
        attemptMove('S');
        break;
      case 'ArrowLeft':
      case 'a':
      case 'A':
        attemptMove('W');
        break;
      case 'ArrowRight':
      case 'd':
      case 'D':
        attemptMove('E');
        break;
      default:
        break;
    }
  });

  canvas.addEventListener('click', (event) => {
    const rect = canvas.getBoundingClientRect();
    const tileSize = mapSnapshot?.tileSize ?? TILE_SIZE;
    const tileX = Math.floor(((event.clientX - rect.left) / rect.width) * canvas.width / tileSize);
    const tileY = Math.floor(((event.clientY - rect.top) / rect.height) * canvas.height / tileSize);
    tryToggleDoor(tileX, tileY);
  });
}

function scheduleReconnect() {
  if (reconnectTimer) {
    window.clearTimeout(reconnectTimer);
  }
  reconnectTimer = window.setTimeout(connect, 1000);
}

function connect() {
  updateStatus('Connecting…');
  const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
  ws = new WebSocket(`${protocol}://${window.location.host}/ws`);

  ws.onopen = () => {
    updateStatus('Connected');
    sendMessage({ type: 'hello' });
  };

  ws.onmessage = (event) => {
    const payload = JSON.parse(event.data) as ServerMessage;
    switch (payload.type) {
      case 'welcome': {
        const welcome = payload as WelcomeMessage;
        youId = welcome.youId;
        mapSnapshot = welcome.map;
        doorSnapshots = welcome.map.doors;
        resizeCanvas();
        handleStateUpdate(welcome.state);
        break;
      }
      case 'state': {
        const stateMsg = payload as StateMessage;
        handleStateUpdate(stateMsg.state);
        break;
      }
      case 'error': {
        updateStatus(`Error: ${payload.message}`, 'error');
        break;
      }
      default:
        console.warn('Unknown server message', payload);
    }
  };

  ws.onclose = () => {
    updateStatus('Disconnected. Reconnecting…', 'error');
    scheduleReconnect();
  };

  ws.onerror = (event) => {
    console.error('WS error', event);
    updateStatus('Connection error', 'error');
  };
}

async function boot() {
  await loadAssets();
  setupInput();
  resizeCanvas();
  render();
  connect();
}

boot().catch((error) => {
  console.error('Failed to boot client', error);
  updateStatus('Failed to initialise client', 'error');
});
