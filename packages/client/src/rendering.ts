import type { HexGridInfo, HexPixelMetrics, ImageCache, MapData } from './types';

const ISO_DEFAULT_METRICS: HexPixelMetrics = { tileWidth: 80, tileHeight: 36, elevation: 96 };

export function getPixelMetrics(hex: HexGridInfo): HexPixelMetrics {
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

export function projectHex(q: number, r: number, hex: HexGridInfo, elev = 0): { x: number; y: number } {
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

export function buildImageUrl(art: string, dir: number, frame: number): string {
  const frameIndex = Math.max(0, frame);
  const frameName = frameIndex.toString().padStart(2, '0');
  return `/art/${art}/dir_${dir}/frame_${frameName}.png`;
}

export function collectImageUrls(map: MapData): Set<string> {
  const urls = new Set<string>();
  for (const tile of map.tiles) {
    urls.add(buildImageUrl(tile.art, 0, 0));
  }
  for (const object of map.objects) {
    const dir = object.dir ?? 0;
    urls.add(buildImageUrl(object.art, dir, 0));
    urls.add(buildImageUrl(object.art, 0, 0));
  }
  return urls;
}

export async function ensureImages(urls: Iterable<string>, cache: ImageCache): Promise<ImageCache> {
  const promises: Promise<void>[] = [];
  for (const url of urls) {
    if (cache.has(url)) {
      continue;
    }
    promises.push(
      new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
          cache.set(url, img);
          resolve();
        };
        img.onerror = () => {
          // eslint-disable-next-line no-console
          console.warn('Asset failed to load:', url);
          resolve();
        };
        img.src = url;
      }),
    );
  }
  if (promises.length > 0) {
    await Promise.all(promises);
  }
  return cache;
}

interface Drawable {
  layer: 'ground' | 'roof' | 'object';
  x: number;
  y: number;
  z: number;
  art: string;
  image: HTMLImageElement;
}

interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

function getAssetInfo(map: MapData, art: string) {
  return map.assets?.[art];
}

function computeDrawables(map: MapData, images: ImageCache): { drawables: Drawable[]; bounds: Bounds } {
  const drawables: Drawable[] = [];
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
    const rawX = base.x + anchorX - image.width / 2;
    const rawY = base.y + anchorY - image.height;
    const drawX = Math.round(rawX);
    const drawY = Math.round(rawY);
    minX = Math.min(minX, drawX);
    minY = Math.min(minY, drawY);
    maxX = Math.max(maxX, drawX + image.width);
    maxY = Math.max(maxY, drawY + image.height);
    const z = base.y;
    drawables.push({ layer, x: drawX, y: drawY, z, art, image });
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
    bounds: { minX, minY, maxX, maxY },
  };
}

export interface DrawResult {
  ctx: CanvasRenderingContext2D;
  dpr: number;
  width: number;
  height: number;
  offsetX: number;
  offsetY: number;
  bounds: Bounds;
  images: ImageCache;
}

export async function drawMap(
  canvas: HTMLCanvasElement,
  map: MapData,
  cache: ImageCache,
): Promise<DrawResult> {
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Canvas not supported');
  }

  const urls = collectImageUrls(map);
  await ensureImages(urls, cache);

  const { drawables, bounds } = computeDrawables(map, cache);

  const padding = 64;
  const hasContent = Number.isFinite(bounds.minX);
  const width = hasContent ? Math.ceil(bounds.maxX - bounds.minX + padding * 2) : 512;
  const height = hasContent ? Math.ceil(bounds.maxY - bounds.minY + padding * 2) : 512;

  const dpr = window.devicePixelRatio || 1;
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;

  ctx.resetTransform();
  ctx.scale(dpr, dpr);
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, width, height);

  if (!hasContent) {
    return { ctx, dpr, width, height, offsetX: padding, offsetY: padding, bounds, images: cache };
  }

  const offsetX = -bounds.minX + padding;
  const offsetY = -bounds.minY + padding;

  drawables
    .sort((a, b) => {
      if (a.layer === b.layer) {
        return a.z - b.z;
      }
      const order = { ground: 0, roof: 1, object: 2 } as const;
      return order[a.layer] - order[b.layer];
    })
    .forEach((drawable) => {
      ctx.drawImage(drawable.image, drawable.x + offsetX, drawable.y + offsetY);
    });

  return { ctx, dpr, width, height, offsetX, offsetY, bounds, images: cache };
}
