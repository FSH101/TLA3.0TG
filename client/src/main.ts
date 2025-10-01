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

const INTERFACE_ASSET_PREFIX = '/interface-assets';

function assetUrl(name: string): string {
  const encoded = name
    .split('/')
    .map((part) => encodeURIComponent(part))
    .join('/');
  return `${INTERFACE_ASSET_PREFIX}/${encoded}`;
}

interface InterfaceButtonSpec {
  id: string;
  label: string;
  icon: string;
  iconDown?: string;
  group?: string;
  width?: number;
  height?: number;
  onActivate?: () => void;
}

const buttonMeta = new WeakMap<
  HTMLButtonElement,
  { icon: HTMLImageElement; iconUp: string; iconDown?: string }
>();
const radioGroups = new Map<string, HTMLButtonElement[]>();

const canvas = document.createElement('canvas');
const context = canvas.getContext('2d');
if (!context) {
  throw new Error('Canvas API is not available');
}
const ctx = context;
canvas.className = 'game-canvas';

const appRoot = document.createElement('div');
appRoot.className = 'app-root';
document.body.appendChild(appRoot);

const interfaceSurface = document.createElement('div');
interfaceSurface.className = 'interface-surface';
interfaceSurface.style.setProperty('--interface-bg', `url('${assetUrl('wm_iface1280x720.png')}')`);
appRoot.appendChild(interfaceSurface);

const overlay = document.createElement('div');
overlay.className = 'interface-overlay';
interfaceSurface.appendChild(overlay);

const topBar = document.createElement('div');
topBar.className = 'interface-top-bar';
overlay.appendChild(topBar);

const statusEl = document.createElement('div');
statusEl.className = 'status-indicator';
statusEl.textContent = 'Connecting…';
topBar.appendChild(statusEl);

const actionLogEl = document.createElement('div');
actionLogEl.className = 'action-log';
actionLogEl.textContent = 'Awaiting command';
topBar.appendChild(actionLogEl);

const clockEl = document.createElement('div');
clockEl.className = 'interface-clock';
clockEl.setAttribute('aria-label', 'In-world clock');
topBar.appendChild(clockEl);

function updateClock() {
  const now = new Date();
  const hours = now.getHours().toString().padStart(2, '0');
  const minutes = now.getMinutes().toString().padStart(2, '0');
  clockEl.textContent = `${hours}:${minutes}`;
}
updateClock();
window.setInterval(updateClock, 60_000);

const mainArea = document.createElement('div');
mainArea.className = 'interface-main';
overlay.appendChild(mainArea);

const leftColumn = document.createElement('div');
leftColumn.className = 'interface-column column-left';
mainArea.appendChild(leftColumn);

const centerColumn = document.createElement('div');
centerColumn.className = 'interface-column column-center';
mainArea.appendChild(centerColumn);

const rightColumn = document.createElement('div');
rightColumn.className = 'interface-column column-right';
mainArea.appendChild(rightColumn);

function logAction(text: string) {
  actionLogEl.textContent = text;
  actionLogEl.classList.remove('is-active');
  // Trigger reflow so the animation restarts each time.
  void actionLogEl.offsetWidth;
  actionLogEl.classList.add('is-active');
}

function applyButtonState(button: HTMLButtonElement, pressed: boolean) {
  const meta = buttonMeta.get(button);
  if (!meta) return;
  if (meta.iconDown) {
    meta.icon.src = pressed ? meta.iconDown : meta.iconUp;
  }
  button.classList.toggle('is-pressed', pressed);
}

function setButtonActive(button: HTMLButtonElement, active: boolean) {
  button.classList.toggle('is-active', active);
  applyButtonState(button, active);
}

function flashButton(button: HTMLButtonElement) {
  applyButtonState(button, true);
  window.setTimeout(() => {
    if (!button.classList.contains('is-active')) {
      applyButtonState(button, false);
    }
  }, 160);
}

function createButton(spec: InterfaceButtonSpec): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'interface-button';
  button.setAttribute('aria-label', spec.label);
  if (spec.width) {
    button.style.setProperty('--button-width', `${spec.width}px`);
  }
  if (spec.height) {
    button.style.setProperty('--button-height', `${spec.height}px`);
  }

  const icon = document.createElement('img');
  const iconUp = assetUrl(spec.icon);
  const iconDown = spec.iconDown ? assetUrl(spec.iconDown) : undefined;
  icon.src = iconUp;
  icon.alt = spec.label;
  icon.draggable = false;
  button.appendChild(icon);
  buttonMeta.set(button, { icon, iconUp, iconDown });

  const label = document.createElement('span');
  label.className = 'interface-button-label';
  label.textContent = spec.label;
  button.appendChild(label);

  button.addEventListener('pointerdown', () => {
    applyButtonState(button, true);
  });

  button.addEventListener('pointerleave', () => {
    if (!button.classList.contains('is-active')) {
      applyButtonState(button, false);
    }
  });

  button.addEventListener('pointerup', () => {
    if (!button.classList.contains('is-active')) {
      applyButtonState(button, false);
    }
  });

  button.addEventListener('click', () => {
    if (spec.group) {
      const groupButtons = radioGroups.get(spec.group) ?? [];
      groupButtons.forEach((groupButton) => {
        setButtonActive(groupButton, groupButton === button);
      });
    } else {
      flashButton(button);
    }
    spec.onActivate?.();
    logAction(`${spec.label} engaged`);
  });

  if (spec.group) {
    const existing = radioGroups.get(spec.group);
    if (existing) {
      existing.push(button);
    } else {
      radioGroups.set(spec.group, [button]);
    }
  }

  return button;
}

function createPanel(title: string, backgroundAsset: string, extraClass?: string): HTMLElement {
  const panel = document.createElement('section');
  panel.className = `interface-panel has-bg ${extraClass ?? ''}`.trim();
  panel.style.setProperty('--panel-bg', `url('${assetUrl(backgroundAsset)}')`);

  const header = document.createElement('header');
  header.className = 'panel-title';
  header.textContent = title;
  panel.appendChild(header);

  return panel;
}

const commandPanel = createPanel('Commands', 'panel.png', 'command-panel');
leftColumn.appendChild(commandPanel);

const commandGrid = document.createElement('div');
commandGrid.className = 'button-stack';
commandPanel.appendChild(commandGrid);

[
  { id: 'move', label: 'Move', icon: 'cmd_move.png' },
  { id: 'attack', label: 'Attack', icon: 'cmd_attack.png' },
  { id: 'stop', label: 'Stop', icon: 'cmd_stop.png' },
  { id: 'menu', label: 'Menu', icon: 'cmd_menu.png' },
  { id: 'queue', label: 'Queue', icon: 'cmd_up.png' }
].forEach((spec) => {
  commandGrid.appendChild(createButton(spec));
});

const movementPanel = createPanel('Movement', '3d_registration.png', 'movement-panel');
leftColumn.appendChild(movementPanel);

const dpad = document.createElement('div');
dpad.className = 'dpad-grid';
movementPanel.appendChild(dpad);

const northButton = createButton({
  id: 'move-n',
  label: 'Step North',
  icon: 'UpArrow_up.PNG',
  iconDown: 'UpArrow_dwn.PNG',
  onActivate: () => attemptMove('N')
});
northButton.classList.add('dpad-north');
dpad.appendChild(northButton);

const westButton = createButton({
  id: 'move-w',
  label: 'Step West',
  icon: 'switch2_x.png',
  iconDown: 'switch1_x.png',
  onActivate: () => attemptMove('W')
});
westButton.classList.add('dpad-west');
dpad.appendChild(westButton);

const centerSpacer = document.createElement('div');
centerSpacer.className = 'dpad-center';
centerSpacer.style.setProperty('background-image', `url('${assetUrl('3d_reg_arrow_up.png')}')`);
centerSpacer.setAttribute('aria-hidden', 'true');
dpad.appendChild(centerSpacer);

const eastButton = createButton({
  id: 'move-e',
  label: 'Step East',
  icon: 'switch3_x.png',
  iconDown: 'switch1_x.png',
  onActivate: () => attemptMove('E')
});
eastButton.classList.add('dpad-east');
dpad.appendChild(eastButton);

const southButton = createButton({
  id: 'move-s',
  label: 'Step South',
  icon: 'DwnArrow_up.PNG',
  iconDown: 'DwnArrow_dwn.PNG',
  onActivate: () => attemptMove('S')
});
southButton.classList.add('dpad-south');
dpad.appendChild(southButton);

const utilityPanel = createPanel('Utility', 'AutoRun.PNG', 'utility-panel');
leftColumn.appendChild(utilityPanel);

const utilityRow = document.createElement('div');
utilityRow.className = 'button-row';
utilityPanel.appendChild(utilityRow);

[
  { id: 'autorun', label: 'Auto-Run', icon: 'AutoRun.PNG', iconDown: 'AutoRunDwn.PNG' },
  { id: 'sneak', label: 'Sneak', icon: 'sd.png', iconDown: 'sd_dn.png' },
  { id: 'options', label: 'Options', icon: 'options.png', iconDown: 'options_x.png' }
].forEach((spec) => {
  utilityRow.appendChild(createButton(spec));
});

const interactionPanel = createPanel('Interaction', 'dialogbox_bottom.png', 'interaction-panel');
leftColumn.appendChild(interactionPanel);

const interactionGrid = document.createElement('div');
interactionGrid.className = 'button-grid';
interactionPanel.appendChild(interactionGrid);

[
  { id: 'talk', label: 'Talk', icon: 'talk.png', iconDown: 'talk_answ.png' },
  { id: 'barter', label: 'Barter', icon: 'barter.png', iconDown: 'barter_pushed2.png' },
  { id: 'give', label: 'Give', icon: 'give.png', iconDown: 'give_x.png' },
  { id: 'follow', label: 'Follow', icon: 'follow.png', iconDown: 'follow_to.png' }
].forEach((spec) => {
  interactionGrid.appendChild(createButton(spec));
});

const mapViewport = document.createElement('div');
mapViewport.className = 'map-viewport';
mapViewport.style.setProperty('--panel-bg', `url('${assetUrl('panel1280.png')}')`);
mapViewport.appendChild(canvas);
centerColumn.appendChild(mapViewport);

const aimPanel = createPanel('Targeting', 'skillpad.png', 'aim-panel');
centerColumn.appendChild(aimPanel);

const aimGrid = document.createElement('div');
aimGrid.className = 'aim-grid';
aimPanel.appendChild(aimGrid);

[
  { id: 'aim-head', label: 'Head', icon: 'AimHead.png', iconDown: 'AimHeadBt.png', group: 'aim' },
  { id: 'aim-torso', label: 'Torso', icon: 'AimTorso.png', iconDown: 'AimTorsoBt.png', group: 'aim' },
  { id: 'aim-groin', label: 'Groin', icon: 'AimGroin.png', iconDown: 'AimGroinBt.png', group: 'aim' },
  { id: 'aim-eyes', label: 'Eyes', icon: 'AimEye.png', iconDown: 'AimEyeBt.png', group: 'aim' },
  { id: 'aim-arms', label: 'Arms', icon: 'AimRArm.png', iconDown: 'AimRArmBt.png', group: 'aim' },
  { id: 'aim-legs', label: 'Legs', icon: 'AimRLeg.png', iconDown: 'AimRLegBt.png', group: 'aim' }
].forEach((spec) => {
  aimGrid.appendChild(createButton(spec));
});

const tabContentArea = document.createElement('div');
tabContentArea.className = 'tab-content-area';
centerColumn.appendChild(tabContentArea);

function createTabPanel(className: string): HTMLElement {
  const panel = document.createElement('div');
  panel.className = `tab-panel ${className}`;
  return panel;
}

const tabViews: Record<string, HTMLElement> = {
  inventory: createTabPanel('inventory-panel'),
  character: createTabPanel('character-panel'),
  map: createTabPanel('world-panel'),
  pipboy: createTabPanel('pip-panel'),
  fixboy: createTabPanel('fixboy-panel')
};

Object.entries(tabViews).forEach(([, view]) => {
  tabContentArea.appendChild(view);
});

tabViews.inventory.innerHTML = `
  <div class="inventory-grid">
    ${Array.from({ length: 6 })
      .map(
        (_, index) => `
          <div class="inventory-slot" style="--slot-bg: url('${assetUrl('3d_invbox.png')}')">
            <span class="slot-index">${index + 1}</span>
          </div>
        `
      )
      .join('')}
  </div>
`;

tabViews.character.innerHTML = `
  <div class="character-sheet">
    <div class="character-portrait" style="background-image: url('${assetUrl('character.png')}')"></div>
    <div class="character-stats">
      <h3>Status</h3>
      <ul>
        <li>HP: 100</li>
        <li>AP: 10</li>
        <li>XP: 2500</li>
        <li>Weight: 35 / 125</li>
      </ul>
    </div>
  </div>
`;

tabViews.map.innerHTML = `
  <div class="map-preview" style="background-image: url('${assetUrl('town_view.png')}')"></div>
`;

tabViews.pipboy.innerHTML = `
  <div class="pip-screen" style="background-image: url('${assetUrl('pip-high.png')}')">
    <p>Quests synchronised</p>
    <p>Radio: 103.5 MHz</p>
  </div>
`;

tabViews.fixboy.innerHTML = `
  <div class="fixboy-screen" style="background-image: url('${assetUrl('fixboy-high.png')}')">
    <p>Craft queue empty</p>
    <p>Workbench linked</p>
  </div>
`;

function setActiveTab(id: keyof typeof tabViews) {
  Object.entries(tabViews).forEach(([key, view]) => {
    if (key === id) {
      view.removeAttribute('hidden');
    } else {
      view.setAttribute('hidden', 'true');
    }
  });
}

const rightPanels = document.createElement('div');
rightPanels.className = 'right-panels';
rightColumn.appendChild(rightPanels);

const teslaPanel = createPanel('Power', 'teslapanel.PNG', 'tesla-panel');
rightPanels.appendChild(teslaPanel);

const teslaDisplay = document.createElement('div');
teslaDisplay.className = 'tesla-display';
teslaDisplay.style.setProperty('--display-bg', `url('${assetUrl('tesladisplay.PNG')}')`);
teslaDisplay.textContent = 'Online';
teslaPanel.appendChild(teslaDisplay);

const teslaButtonRow = document.createElement('div');
teslaButtonRow.className = 'button-row';
teslaPanel.appendChild(teslaButtonRow);
teslaButtonRow.appendChild(
  createButton({
    id: 'tesla-toggle',
    label: 'Toggle',
    icon: 'teslabutton_up.PNG',
    iconDown: 'teslabutton_dwn.PNG',
    onActivate: () => {
      teslaDisplay.textContent = teslaDisplay.textContent === 'Online' ? 'Offline' : 'Online';
    }
  })
);

const radioPanel = createPanel('Radio', 'radio.png', 'radio-panel');
rightPanels.appendChild(radioPanel);

const radioDialRow = document.createElement('div');
radioDialRow.className = 'button-row';
radioPanel.appendChild(radioDialRow);

[
  { id: 'dial-1', label: 'Dial 1', icon: 'radio_dial1.png', group: 'radio-dial' },
  { id: 'dial-2', label: 'Dial 2', icon: 'radio_dial2.png', group: 'radio-dial' },
  { id: 'dial-3', label: 'Dial 3', icon: 'radio_dial3.png', group: 'radio-dial' }
].forEach((spec) => {
  radioDialRow.appendChild(createButton(spec));
});

radioPanel.appendChild(
  createButton({
    id: 'radio-power',
    label: 'Power',
    icon: 'radio_off.png',
    iconDown: 'radio.png'
  })
);

const socialPanel = createPanel('Social', 'dialogbox_top.png', 'social-panel');
rightPanels.appendChild(socialPanel);

const socialRow = document.createElement('div');
socialRow.className = 'button-grid';
socialPanel.appendChild(socialRow);

[
  { id: 'manage', label: 'Manage', icon: 'FrScreen.PNG', iconDown: 'FrScreen_x.png' },
  { id: 'team', label: 'Team', icon: 'follow_me.png', iconDown: 'follow_me_x.png' },
  { id: 'logs', label: 'Logs', icon: 'log_dn.png', iconDown: 'log_dn.png' },
  { id: 'help', label: 'Help', icon: 'HLREDMK2.png', iconDown: 'HLYELMK2.png' }
].forEach((spec) => {
  socialRow.appendChild(createButton(spec));
});

const bottomBar = document.createElement('div');
bottomBar.className = 'interface-bottom';
overlay.appendChild(bottomBar);

const tabButtonsRow = document.createElement('div');
tabButtonsRow.className = 'tab-button-row';
bottomBar.appendChild(tabButtonsRow);

[
  {
    id: 'tab-inventory',
    label: 'Inventory',
    icon: 'INVMK2.png',
    iconDown: 'INVMK2.png',
    group: 'main-tabs',
    onActivate: () => setActiveTab('inventory')
  },
  {
    id: 'tab-character',
    label: 'Character',
    icon: 'CHAMK2.png',
    iconDown: 'CHAMK2.png',
    group: 'main-tabs',
    onActivate: () => setActiveTab('character')
  },
  {
    id: 'tab-map',
    label: 'Map',
    icon: 'MAPMK2.png',
    iconDown: 'MAPMK2.png',
    group: 'main-tabs',
    onActivate: () => setActiveTab('map')
  },
  {
    id: 'tab-pip',
    label: 'Pip-Boy',
    icon: 'PIPMK2.png',
    iconDown: 'PIPMK2.png',
    group: 'main-tabs',
    onActivate: () => setActiveTab('pipboy')
  },
  {
    id: 'tab-fix',
    label: 'FixBoy',
    icon: 'FIXMK2.png',
    iconDown: 'FIXMK2.png',
    group: 'main-tabs',
    onActivate: () => setActiveTab('fixboy')
  }
].forEach((spec) => {
  tabButtonsRow.appendChild(createButton(spec));
});

setActiveTab('map');

const secondaryControls = document.createElement('div');
secondaryControls.className = 'secondary-controls';
bottomBar.appendChild(secondaryControls);

[
  { id: 'saveload', label: 'Save/Load', icon: 'save_load.png', iconDown: 'save_load.png' },
  { id: 'prefs', label: 'Preferences', icon: 'options.png', iconDown: 'options_singleplayer.png' },
  { id: 'exit', label: 'Exit', icon: 'cancelbig.png', iconDown: 'ccancel.png' }
].forEach((spec) => {
  secondaryControls.appendChild(createButton(spec));
});

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
