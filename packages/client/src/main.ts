import './style.css';

interface HexPixelMetrics {
  tileWidth: number;
  tileHeight: number;
  elevation: number;
}

interface HexGridInfo {
  orientation: 'pointy' | 'flat' | 'isometric';
  size: number;
  pixel?: HexPixelMetrics;
}

interface MapTile {
  q: number;
  r: number;
  layer: 'ground' | 'roof';
  art: string;
}

interface MapObject {
  id: string;
  q: number;
  r: number;
  elev: number;
  dir: number;
  art: string;
}

interface MapData {
  id: string;
  hex: HexGridInfo;
  size: { w: number; h: number };
  tiles: MapTile[];
  objects: MapObject[];
  assets: Record<string, AssetDescriptor | undefined>;
}

interface AssetDescriptor {
  kind: string;
  category: string;
  outDir: string;
  dirs: number;
  framesPerDir: number;
  size: { maxW: number; maxH: number };
  anchorAvg: { xOff: number; yOff: number };
}

interface MapSummary {
  id: string;
  name: string;
  hex: HexGridInfo;
  tiles: number;
  objects: number;
}

type ImageCache = Map<string, HTMLImageElement>;

const app = document.getElementById('app')!;

const toolbar = document.createElement('div');
toolbar.className = 'toolbar';

const title = document.createElement('h1');
title.textContent = 'TLA 3.0 • Map Viewer';
toolbar.appendChild(title);

const select = document.createElement('select');
toolbar.appendChild(select);

const viewer = document.createElement('div');
viewer.className = 'viewer';

const status = document.createElement('div');
status.className = 'status';
viewer.appendChild(status);

const canvas = document.createElement('canvas');
viewer.appendChild(canvas);

app.append(toolbar, viewer);

let maps: MapSummary[] = [];
let currentMap: MapData | null = null;

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`);
  }
  return (await response.json()) as T;
}

async function loadMapsList(): Promise<void> {
  status.textContent = 'Загружаем карты…';
  status.classList.remove('error');
  try {
    maps = await fetchJson<MapSummary[]>('/api/maps');
    select.innerHTML = '';
    for (const entry of maps) {
      const option = document.createElement('option');
      option.value = entry.id;
      option.textContent = `${entry.name} (${entry.tiles} плиток, ${entry.objects} объектов)`;
      select.appendChild(option);
    }
    if (maps.length > 0) {
      await loadMap(maps[0].id);
    } else {
      status.textContent = 'Не найдено ни одной карты';
    }
  } catch (error) {
    console.error(error);
    status.textContent = 'Ошибка загрузки списка карт';
    status.classList.add('error');
  }
}

async function loadMap(mapId: string): Promise<void> {
  status.textContent = 'Загружаем карту…';
  status.classList.remove('error');
  try {
    currentMap = await fetchJson<MapData>(`/api/maps/${encodeURIComponent(mapId)}`);
    await renderCurrentMap();
    status.textContent = '';
  } catch (error) {
    console.error(error);
    status.textContent = 'Не удалось загрузить карту';
    status.classList.add('error');
  }
}

select.addEventListener('change', (event: Event) => {
  const target = event.target as HTMLSelectElement | null;
  if (target && target.value) {
    loadMap(target.value).catch((error) => console.error('Map load failed', error));
  }
});

const ISO_DEFAULT_METRICS: HexPixelMetrics = { tileWidth: 80, tileHeight: 36, elevation: 96 };

function getPixelMetrics(hex: HexGridInfo): HexPixelMetrics {
  if (hex.pixel) {
    return hex.pixel;
  }
  if (hex.orientation === 'isometric') {
    return ISO_DEFAULT_METRICS;
  }
  const baseSize = Math.max(1, hex.size);
  const tileWidth = Math.sqrt(3) * baseSize;
  const tileHeight = 2 * baseSize;
  const elevation = tileHeight * 1.5;
  return { tileWidth, tileHeight, elevation };
}

function projectHex(q: number, r: number, hex: HexGridInfo, elev = 0): { x: number; y: number } {
  const metrics = getPixelMetrics(hex);
  if (hex.orientation === 'isometric') {
    const x = (q - r) * (metrics.tileWidth / 2);
    const y = (q + r) * (metrics.tileHeight / 2) - elev * metrics.elevation;
    return { x, y };
  }

  const size = Math.max(1, hex.size);
  if (hex.orientation === 'flat') {
    const x = size * (3 / 2) * q;
    const y = size * Math.sqrt(3) * (r + q / 2) - elev * metrics.elevation;
    return { x, y };
  }

  const x = size * Math.sqrt(3) * (q + r / 2);
  const y = size * (3 / 2) * r - elev * metrics.elevation;
  return { x, y };
}

function buildImageUrl(art: string, dir: number, frame: number): string {
  const frameIndex = Math.max(0, frame);
  const frameName = frameIndex.toString().padStart(2, '0');
  return `/art/${art}/dir_${dir}/frame_${frameName}.png`;
}

async function loadImages(map: MapData): Promise<ImageCache> {
  const cache: ImageCache = new Map();
  const promises: Promise<void>[] = [];

  const queue = new Set<string>();

  for (const tile of map.tiles) {
    queue.add(buildImageUrl(tile.art, 0, 0));
  }
  for (const object of map.objects) {
    const dir = object.dir ?? 0;
    queue.add(buildImageUrl(object.art, dir, 0));
  }

  for (const url of queue) {
    promises.push(
      new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
          cache.set(url, img);
          resolve();
        };
        img.onerror = () => {
          console.warn('Asset failed to load:', url);
          resolve();
        };
        img.src = url;
      }),
    );
  }

  await Promise.all(promises);
  return cache;
}

function getAssetInfo(map: MapData, art: string): AssetDescriptor | null {
  const direct = map.assets[art];
  if (direct) {
    return direct;
  }
  const lower = map.assets[art.toLowerCase()];
  if (lower) {
    return lower;
  }
  const upper = map.assets[art.toUpperCase()];
  if (upper) {
    return upper;
  }
  return null;
}

function computeDrawMetrics(
  map: MapData,
  images: ImageCache,
): {
  drawables: {
    layer: 'ground' | 'roof' | 'object';
    x: number;
    y: number;
    z: number;
    image: HTMLImageElement;
    art: string;
  }[];
  bounds: { minX: number; minY: number; maxX: number; maxY: number };
} {
  const drawables: {
    layer: 'ground' | 'roof' | 'object';
    x: number;
    y: number;
    z: number;
    image: HTMLImageElement;
    art: string;
  }[] = [];

  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  const pushDrawable = (
    layer: 'ground' | 'roof' | 'object',
    q: number,
    r: number,
    image: HTMLImageElement,
    art: string,
    elev = 0,
  ) => {
    const asset = getAssetInfo(map, art);
    const base = projectHex(q, r, map.hex, elev);
    const anchorX = asset?.anchorAvg.xOff ?? 0;
    const anchorY = asset?.anchorAvg.yOff ?? 0;
    const drawX = base.x + anchorX - image.width / 2;
    const drawY = base.y + anchorY - image.height;
    minX = Math.min(minX, drawX);
    minY = Math.min(minY, drawY);
    maxX = Math.max(maxX, drawX + image.width);
    maxY = Math.max(maxY, drawY + image.height);
    const z = base.y;
    drawables.push({ layer, x: drawX, y: drawY, z, image, art });
  };

  for (const tile of map.tiles) {
    const url = buildImageUrl(tile.art, 0, 0);
    const img = images.get(url);
    if (!img) {
      continue;
    }
    pushDrawable(tile.layer, tile.q, tile.r, img, tile.art);
  }

  for (const object of map.objects) {
    const dir = object.dir ?? 0;
    const url = buildImageUrl(object.art, dir, 0);
    const fallbackUrl = buildImageUrl(object.art, 0, 0);
    const img = images.get(url) ?? images.get(fallbackUrl);
    if (!img) {
      continue;
    }
    pushDrawable('object', object.q, object.r, img, object.art, object.elev ?? 0);
  }

  return {
    drawables,
    bounds: {
      minX,
      minY,
      maxX,
      maxY,
    },
  };
}

async function renderCurrentMap(): Promise<void> {
  const map = currentMap;
  if (!map) {
    return;
  }

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Canvas not supported');
  }

  const images = await loadImages(map);
  const { drawables, bounds } = computeDrawMetrics(map, images);

  if (!Number.isFinite(bounds.minX)) {
    status.textContent = 'Карта пустая';
    return;
  }

  const padding = 64;
  const width = Math.ceil(bounds.maxX - bounds.minX + padding * 2);
  const height = Math.ceil(bounds.maxY - bounds.minY + padding * 2);

  const dpr = window.devicePixelRatio || 1;
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;

  ctx.resetTransform();
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, width, height);

  const offsetX = -bounds.minX + padding;
  const offsetY = -bounds.minY + padding;

  drawables
    .sort((a, b) => {
      if (a.layer === b.layer) {
        return a.z - b.z;
      }
      const order = { ground: 0, roof: 1, object: 2 };
      return order[a.layer] - order[b.layer];
    })
    .forEach((drawable) => {
      ctx.drawImage(drawable.image, drawable.x + offsetX, drawable.y + offsetY);
    });
}

loadMapsList().catch((error) => {
  console.error(error);
  status.textContent = 'Ошибка инициализации клиента';
  status.classList.add('error');
});
