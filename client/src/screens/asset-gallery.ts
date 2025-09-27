import { FALLOUT_GIMP_PALETTE, normalizePalette, parseFr, type FrFrame } from "@tla/shared";
import { GIFEncoder } from "gifenc";
import type { RouteContext } from "../router";
import { getSession, saveSession } from "../state/storage";
import "../styles/asset-gallery.css";

interface AssetSource {
  name: string;
  url: string;
}

interface AssetDetail {
  gifUrl: string;
  fps: number;
  frameCount: number;
  framesPerDirection: number;
  directions: number;
  actionFrame: number;
  sizeRange: {
    width: [number, number];
    height: [number, number];
  };
  composedSize: {
    width: number;
    height: number;
  };
}

const assetModules = import.meta.glob("../assets/**/*", {
  import: "default",
  query: "?url",
  eager: true,
}) as Record<string, string>;

const paletteBytes = normalizePalette(FALLOUT_GIMP_PALETTE);
const gifPalette = buildGifPalette(paletteBytes);

export function renderAssetGallery({ container, navigate }: RouteContext): () => void {
  const assets = collectAssets();
  const session = getSession();

  const screen = document.createElement("div");
  screen.className = "asset-gallery";

  const toolbar = document.createElement("header");
  toolbar.className = "asset-gallery__toolbar";

  const title = document.createElement("h1");
  title.className = "asset-gallery__title";
  title.textContent = "Галерея ассетов";
  toolbar.appendChild(title);

  const actions = document.createElement("div");
  actions.className = "asset-gallery__actions";

  const backButton = document.createElement("button");
  backButton.type = "button";
  backButton.className = "secondary";
  backButton.textContent = "Вернуться к авторизации";
  backButton.addEventListener("click", () => {
    navigate("/auth/login");
  });
  actions.appendChild(backButton);

  const logoutButton = document.createElement("button");
  logoutButton.type = "button";
  logoutButton.textContent = session ? "Выйти из аккаунта" : "Очистить сессию";
  logoutButton.addEventListener("click", () => {
    saveSession(null);
    navigate("/auth/login");
  });
  actions.appendChild(logoutButton);

  toolbar.appendChild(actions);
  screen.appendChild(toolbar);

  const content = document.createElement("main");
  content.className = "asset-gallery__content";

  const info = document.createElement("p");
  info.className = "asset-gallery__hint";
  info.innerHTML =
    "Сканируем каталог <code>client/src/assets</code> и строим GIF-анимацию из первого доступного направления с палитрой !Fallout.";
  content.appendChild(info);

  const layout = document.createElement("div");
  layout.className = "asset-gallery__layout";
  content.appendChild(layout);

  const sidebar = document.createElement("aside");
  sidebar.className = "asset-gallery__sidebar";
  layout.appendChild(sidebar);

  const list = document.createElement("ul");
  list.className = "asset-gallery__list";
  sidebar.appendChild(list);

  const preview = document.createElement("section");
  preview.className = "asset-gallery__preview";
  layout.appendChild(preview);

  screen.appendChild(content);
  container.appendChild(screen);

  const assetCache = new Map<string, Promise<AssetDetail>>();
  const gifUrls = new Set<string>();
  let activeItem: HTMLLIElement | null = null;
  let currentAssetKey: string | null = null;

  function showPlaceholder(message: string): void {
    preview.innerHTML = "";
    const placeholder = document.createElement("p");
    placeholder.className = "asset-gallery__placeholder";
    placeholder.textContent = message;
    preview.appendChild(placeholder);
  }

  if (assets.length === 0) {
    showPlaceholder("В каталоге assets пока нет FR-файлов.");
  } else {
    showPlaceholder("Выберите ассет слева, чтобы увидеть анимацию.");
  }

  for (const asset of assets) {
    const item = document.createElement("li");
    item.className = "asset-gallery__list-item";

    const button = document.createElement("button");
    button.type = "button";
    button.textContent = asset.name;
    button.addEventListener("click", () => {
      if (activeItem === item) {
        return;
      }
      if (activeItem) {
        activeItem.classList.remove("is-active");
      }
      activeItem = item;
      item.classList.add("is-active");
      selectAsset(asset);
    });

    item.appendChild(button);
    list.appendChild(item);
  }

  function selectAsset(asset: AssetSource): void {
    currentAssetKey = asset.url;

    preview.innerHTML = "";

    const header = document.createElement("h2");
    header.className = "asset-preview__title";
    header.textContent = asset.name;

    const status = document.createElement("p");
    status.className = "asset-preview__status";
    status.textContent = "Загрузка...";

    const figure = document.createElement("figure");
    figure.className = "asset-preview__figure";

    const image = document.createElement("img");
    image.className = "asset-preview__image";
    image.alt = `Анимация ${asset.name}`;
    figure.appendChild(image);

    const meta = document.createElement("dl");
    meta.className = "asset-preview__meta";

    preview.append(header, status, figure, meta);

    void getAssetDetail(asset)
      .then((detail) => {
        if (currentAssetKey !== asset.url) {
          return;
        }
        image.src = detail.gifUrl;
        image.width = detail.composedSize.width;
        image.height = detail.composedSize.height;
        status.textContent = `Готово • ${detail.frameCount} кадров`;
        renderMeta(meta, detail);
      })
      .catch((error) => {
        if (currentAssetKey !== asset.url) {
          return;
        }
        status.textContent = error instanceof Error ? error.message : String(error);
        figure.remove();
        meta.remove();
      });
  }

  function getAssetDetail(asset: AssetSource): Promise<AssetDetail> {
    const cached = assetCache.get(asset.url);
    if (cached) {
      return cached;
    }
    const request = loadAsset(asset)
      .then((detail) => {
        gifUrls.add(detail.gifUrl);
        return detail;
      })
      .catch((error) => {
        assetCache.delete(asset.url);
        throw error;
      });
    assetCache.set(asset.url, request);
    return request;
  }

  return () => {
    screen.remove();
    currentAssetKey = null;
    for (const url of gifUrls) {
      URL.revokeObjectURL(url);
    }
    gifUrls.clear();
  };
}

function collectAssets(): AssetSource[] {
  return Object.entries(assetModules)
    .filter(([path]) => /\.fr[m\d]$/i.test(path))
    .map(([path, url]) => ({
      name: extractName(path),
      url,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "ru"));
}

function extractName(path: string): string {
  const segments = path.split("/");
  return segments[segments.length - 1] ?? path;
}

async function loadAsset(asset: AssetSource): Promise<AssetDetail> {
  const response = await fetch(asset.url);
  if (!response.ok) {
    throw new Error(`Не удалось загрузить файл (${response.status})`);
  }
  const buffer = await response.arrayBuffer();
  const decoded = parseFr(buffer);

  const nonEmptyDirections = decoded.directions.filter((frames) => frames.length > 0);
  if (nonEmptyDirections.length === 0) {
    throw new Error("Файл не содержит кадров");
  }

  const directionFrames = nonEmptyDirections[0];
  const composed = composeFrames(directionFrames);
  const gifUrl = encodeGif(composed.frames, composed.width, composed.height, decoded.header.fps || 10);

  const fps = decoded.header.fps || 10;
  const sizeRange = directionFrames.reduce(
    (acc, frame) => ({
      width: [Math.min(acc.width[0], frame.w), Math.max(acc.width[1], frame.w)] as [number, number],
      height: [Math.min(acc.height[0], frame.h), Math.max(acc.height[1], frame.h)] as [number, number],
    }),
    {
      width: [Number.POSITIVE_INFINITY, 0] as [number, number],
      height: [Number.POSITIVE_INFINITY, 0] as [number, number],
    },
  );

  return {
    gifUrl,
    fps,
    frameCount: directionFrames.length,
    framesPerDirection: decoded.header.framesPerDir,
    directions: nonEmptyDirections.length,
    actionFrame: decoded.header.actionFrame,
    sizeRange,
    composedSize: { width: composed.width, height: composed.height },
  };
}

function composeFrames(frames: FrFrame[]): { frames: Uint8Array[]; width: number; height: number } {
  if (frames.length === 0) {
    return { frames: [], width: 1, height: 1 };
  }

  let minLeft = Number.POSITIVE_INFINITY;
  let minTop = Number.POSITIVE_INFINITY;
  let maxRight = Number.NEGATIVE_INFINITY;
  let maxBottom = Number.NEGATIVE_INFINITY;

  for (const frame of frames) {
    const left = -frame.xOff;
    const top = -frame.yOff;
    const right = left + frame.w;
    const bottom = top + frame.h;
    minLeft = Math.min(minLeft, left);
    minTop = Math.min(minTop, top);
    maxRight = Math.max(maxRight, right);
    maxBottom = Math.max(maxBottom, bottom);
  }

  const width = Math.max(1, Math.ceil(maxRight - minLeft));
  const height = Math.max(1, Math.ceil(maxBottom - minTop));
  const offsetX = Math.round(-minLeft);
  const offsetY = Math.round(-minTop);

  const composedFrames = frames.map((frame) => {
    const bitmap = new Uint8Array(width * height);
    bitmap.fill(0);

    const baseX = Math.round(-frame.xOff) + offsetX;
    const baseY = Math.round(-frame.yOff) + offsetY;

    for (let y = 0; y < frame.h; y++) {
      const destY = baseY + y;
      if (destY < 0 || destY >= height) {
        continue;
      }
      for (let x = 0; x < frame.w; x++) {
        const destX = baseX + x;
        if (destX < 0 || destX >= width) {
          continue;
        }
        const paletteIndex = frame.pixelsIndex[y * frame.w + x];
        if (paletteIndex === 0) {
          continue;
        }
        const destIndex = destY * width + destX;
        bitmap[destIndex] = paletteIndex;
      }
    }

    return bitmap;
  });

  return { frames: composedFrames, width, height };
}

function encodeGif(frames: Uint8Array[], width: number, height: number, fps: number): string {
  if (frames.length === 0) {
    throw new Error("Нет кадров для построения GIF");
  }

  const gif = GIFEncoder();
  const delay = Math.max(20, Math.round(1000 / Math.max(fps, 1)));

  frames.forEach((bitmap, index) => {
    gif.writeFrame(bitmap, width, height, {
      palette: gifPalette,
      delay,
      transparent: true,
      transparentIndex: 0,
      repeat: index === 0 ? 0 : undefined,
    });
  });

  gif.finish();
  const blob = new Blob([gif.bytes()], { type: "image/gif" });
  return URL.createObjectURL(blob);
}

function renderMeta(meta: HTMLDListElement, detail: AssetDetail): void {
  const widthRange = formatRange(detail.sizeRange.width);
  const heightRange = formatRange(detail.sizeRange.height);

  meta.innerHTML = "";
  meta.append(
    createMetaRow("FPS", String(detail.fps)),
    createMetaRow("Action frame", detail.actionFrame ? String(detail.actionFrame) : "—"),
    createMetaRow("Кадров", String(detail.frameCount)),
    createMetaRow("Кадров в направлении", String(detail.framesPerDirection)),
    createMetaRow("Доступных направлений", String(detail.directions)),
    createMetaRow("Размер кадра", `${widthRange} × ${heightRange}`),
    createMetaRow(
      "Размер GIF",
      `${detail.composedSize.width}×${detail.composedSize.height}`,
    ),
  );
}

function createMetaRow(title: string, value: string): DocumentFragment {
  const fragment = document.createDocumentFragment();
  const dt = document.createElement("dt");
  dt.textContent = title;
  const dd = document.createElement("dd");
  dd.textContent = value;
  fragment.append(dt, dd);
  return fragment;
}

function formatRange([min, max]: [number, number]): string {
  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    return "—";
  }
  return min === max ? String(max) : `${min}…${max}`;
}

function buildGifPalette(palette: Uint8Array): number[][] {
  const colors: number[][] = [];
  for (let i = 0; i < palette.length; i += 3) {
    colors.push([palette[i] ?? 0, palette[i + 1] ?? 0, palette[i + 2] ?? 0]);
  }
  return colors;
}
