import { FALLOUT_GIMP_PALETTE, applyPalette, normalizePalette, parseFr, type RgbaFrame } from "@tla/shared";
import type { RouteContext } from "../router";
import { getSession, saveSession } from "../state/storage";
import "../styles/asset-gallery.css";

interface AssetSource {
  name: string;
  url: string;
}

interface AnimationState {
  frames: RgbaFrame[];
  canvas: HTMLCanvasElement;
  context: CanvasRenderingContext2D;
  fps: number;
  frameIndex: number;
  accumulator: number;
}

const assetModules = import.meta.glob("../assets/**/*.{frm,fr0,fr1,fr2,fr3}", {
  import: "default",
  query: "?url",
  eager: true,
}) as Record<string, string>;

const palette = normalizePalette(FALLOUT_GIMP_PALETTE);

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
    "Выборка заполняется автоматически из папки <code>client/src/assets</code>. Каждая карточка воспроизводит " +
    "FRM-анимацию с палитрой !Fallout.";

  content.appendChild(info);

  const grid = document.createElement("div");
  grid.className = "asset-gallery__grid";
  content.appendChild(grid);

  screen.appendChild(content);
  container.appendChild(screen);

  const animations: AnimationState[] = [];
  let rafId: number | null = null;

  function startAnimationLoop(): void {
    if (rafId !== null) {
      return;
    }
    let lastTimestamp = performance.now();

    const tick = (timestamp: number) => {
      const delta = timestamp - lastTimestamp;
      lastTimestamp = timestamp;

      for (const animation of animations) {
        if (animation.frames.length === 0) {
          continue;
        }
        const frameDuration = 1000 / Math.max(animation.fps, 1);
        animation.accumulator += delta;
        if (animation.accumulator < frameDuration) {
          continue;
        }
        const steps = Math.floor(animation.accumulator / frameDuration);
        animation.accumulator -= steps * frameDuration;
        animation.frameIndex = (animation.frameIndex + steps) % animation.frames.length;
        drawFrame(animation, animation.frames[animation.frameIndex]);
      }

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
  }

  function stopAnimationLoop(): void {
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
  }

  if (assets.length === 0) {
    const empty = document.createElement("p");
    empty.className = "asset-gallery__empty";
    empty.textContent = "В каталоге assets пока нет FR-файлов.";
    grid.appendChild(empty);
  } else {
    for (const asset of assets) {
      const card = document.createElement("article");
      card.className = "asset-card";

      const heading = document.createElement("h2");
      heading.textContent = asset.name;
      card.appendChild(heading);

      const canvas = document.createElement("canvas");
      canvas.width = 1;
      canvas.height = 1;
      canvas.className = "asset-card__canvas";
      card.appendChild(canvas);

      const meta = document.createElement("dl");
      meta.className = "asset-card__meta";
      card.appendChild(meta);

      const status = document.createElement("p");
      status.className = "asset-card__status";
      status.textContent = "Загрузка...";
      card.appendChild(status);

      grid.appendChild(card);

      void loadAsset(asset, canvas, meta, status, animations);
    }
  }

  startAnimationLoop();

  return () => {
    stopAnimationLoop();
    animations.length = 0;
    screen.remove();
  };
}

function collectAssets(): AssetSource[] {
  return Object.entries(assetModules)
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

async function loadAsset(
  asset: AssetSource,
  canvas: HTMLCanvasElement,
  meta: HTMLDListElement,
  status: HTMLParagraphElement,
  animations: AnimationState[],
): Promise<void> {
  try {
    const response = await fetch(asset.url);
    if (!response.ok) {
      throw new Error(`Не удалось загрузить файл (${response.status})`);
    }
    const buffer = await response.arrayBuffer();
    const decoded = parseFr(buffer);
    const paletteFrames = applyPalette(decoded, palette);
    const availableDirections = paletteFrames.filter((frames) => frames.length > 0);
    const directionFrames = availableDirections[0] ?? [];

    if (directionFrames.length === 0) {
      status.textContent = "Файл не содержит кадров";
      return;
    }

    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Браузер не поддерживает 2D-контекст");
    }

    const fps = decoded.header.fps || 10;

    const animation: AnimationState = {
      frames: directionFrames,
      canvas,
      context,
      fps,
      frameIndex: 0,
      accumulator: 0,
    };

    animations.push(animation);
    updateMeta(meta, decoded.header.framesPerDir, availableDirections.length, fps, directionFrames);
    drawFrame(animation, directionFrames[0]);
    status.textContent = `Готово • ${directionFrames.length} кадров`;
  } catch (error) {
    console.error("Ошибка загрузки ассета", asset.name, error);
    status.textContent = error instanceof Error ? error.message : String(error);
  }
}

function drawFrame(animation: AnimationState, frame: RgbaFrame): void {
  if (animation.canvas.width !== frame.w || animation.canvas.height !== frame.h) {
    animation.canvas.width = frame.w;
    animation.canvas.height = frame.h;
  }

  const image = new ImageData(frame.rgba, frame.w, frame.h);
  animation.context.putImageData(image, 0, 0);
}

function updateMeta(
  meta: HTMLDListElement,
  framesPerDirection: number,
  directions: number,
  fps: number,
  frames: RgbaFrame[],
): void {
  const [minW, minH, maxW, maxH] = frames.reduce(
    (acc, frame) => [
      Math.min(acc[0], frame.w),
      Math.min(acc[1], frame.h),
      Math.max(acc[2], frame.w),
      Math.max(acc[3], frame.h),
    ],
    [Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY, 0, 0],
  );

  const sizeText =
    minW === maxW && minH === maxH
      ? `${maxW}×${maxH}`
      : `${minW}×${minH}…${maxW}×${maxH}`;

  meta.innerHTML = "";

  meta.append(
    createMetaRow("FPS", String(fps)),
    createMetaRow("Кадров в направлении", String(framesPerDirection)),
    createMetaRow("Доступных направлений", String(directions)),
    createMetaRow("Размеры кадров", sizeText),
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
