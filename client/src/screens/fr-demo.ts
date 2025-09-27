import type { RouteContext } from "../router";
import {
  FALLOUT_GIMP_PALETTE,
  applyPalette,
  normalizePalette,
  parseFr,
  parsePaletteFile,
  type FrDecoded,
  type RgbaFrame,
} from "@tla/shared";
import "../styles/fr-demo.css";

interface LoadedState {
  decoded: FrDecoded;
  frames: RgbaFrame[][];
  paletteName: string;
  frmName: string;
}

const ACCEPT_FR = [".frm", ".fr0", ".fr1", ".fr2", ".fr3"];
const ACCEPT_PAL = [".pal", ".act", ".gpl"];

export function renderFrDemo({ container }: RouteContext): () => void {
  let state: LoadedState | null = null;
  let currentDirection = 0;
  let rafId: number | null = null;
  let lastTimestamp = 0;
  let currentFrameIndex = 0;

  const main = document.createElement("main");
  main.className = "screen fr-demo";

  const dropzone = document.createElement("label");
  dropzone.className = "fr-demo__dropzone";

  const dropTitle = document.createElement("h1");
  dropTitle.textContent = "Fallout FRM Loader";

  const dropHint = document.createElement("p");
  dropHint.className = "fr-demo__hint";
  dropHint.innerHTML =
    "Перетащите сюда файлы <strong>FRM/FR1/FR2</strong> и необязательную палитру <strong>.pal/.act/.gpl</strong>";

  const selectButton = document.createElement("button");
  selectButton.type = "button";
  selectButton.textContent = "Выбрать файлы";

  const statusLine = document.createElement("div");
  statusLine.className = "fr-demo__hint";
  statusLine.textContent = "Палитра по умолчанию: !Fallout";

  const errorLine = document.createElement("div");
  errorLine.className = "fr-demo__error";

  const fileInput = document.createElement("input");
  fileInput.type = "file";
  fileInput.multiple = true;
  fileInput.accept = [...ACCEPT_FR, ...ACCEPT_PAL].join(",");

  dropzone.append(dropTitle, dropHint, selectButton, statusLine, errorLine, fileInput);

  const grid = document.createElement("div");
  grid.className = "fr-demo__grid";

  const previewPanel = document.createElement("section");
  previewPanel.className = "fr-demo__panel";

  const controls = document.createElement("div");
  controls.className = "fr-demo__controls";

  const directionLabel = document.createElement("label");
  directionLabel.textContent = "Направление:";

  const directionSelect = document.createElement("select");
  directionSelect.disabled = true;
  directionLabel.appendChild(directionSelect);

  const fpsInfo = document.createElement("span");
  fpsInfo.textContent = "FPS: —";

  controls.append(directionLabel, fpsInfo);

  const canvasArea = document.createElement("div");
  canvasArea.className = "fr-demo__canvas-area";

  const sheetCanvas = document.createElement("canvas");
  sheetCanvas.width = 1;
  sheetCanvas.height = 1;

  const animationCanvas = document.createElement("canvas");
  animationCanvas.width = 1;
  animationCanvas.height = 1;

  canvasArea.append(sheetCanvas, animationCanvas);
  previewPanel.append(controls, canvasArea);

  const metaPanel = document.createElement("section");
  metaPanel.className = "fr-demo__panel fr-demo__meta";

  const metaTable = document.createElement("table");
  metaPanel.appendChild(metaTable);

  const framesHeader = document.createElement("h3");
  framesHeader.textContent = "Кадры";
  const framesList = document.createElement("div");
  framesList.className = "fr-demo__frames";
  metaPanel.append(framesHeader, framesList);

  grid.append(previewPanel, metaPanel);

  const notice = document.createElement("p");
  notice.className = "fr-demo__notice";
  notice.innerHTML =
    "Используйте этот экран как проверку: результат можно напрямую конвертировать в PixiJS/Phaser текстуры.";

  main.append(dropzone, grid, notice);
  container.appendChild(main);

  selectButton.addEventListener("click", () => fileInput.click());
  fileInput.addEventListener("change", () => handleFiles(fileInput.files));

  dropzone.addEventListener("dragover", (event) => {
    event.preventDefault();
    dropzone.classList.add("is-dragover");
  });
  dropzone.addEventListener("dragleave", () => {
    dropzone.classList.remove("is-dragover");
  });
  dropzone.addEventListener("drop", (event) => {
    event.preventDefault();
    dropzone.classList.remove("is-dragover");
    handleFiles(event.dataTransfer?.files ?? null);
  });

  directionSelect.addEventListener("change", () => {
    currentDirection = Number.parseInt(directionSelect.value, 10) || 0;
    renderCurrentDirection();
  });

  function stopAnimation(): void {
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
  }

  function setError(message: string): void {
    errorLine.textContent = message;
  }

  async function handleFiles(list: FileList | null): Promise<void> {
    if (!list || list.length === 0) {
      return;
    }
    setError("");

    try {
      const files = Array.from(list);
      const frmFile = files.find((file) => hasExtension(file.name, ACCEPT_FR));
      if (!frmFile) {
        throw new Error("Не найден FRM файл");
      }

      const paletteFile = files.find((file) => hasExtension(file.name, ACCEPT_PAL));

      const decoded = parseFr(await frmFile.arrayBuffer());
      let paletteName = "!Fallout";
      let paletteBytes = FALLOUT_GIMP_PALETTE;

      if (paletteFile) {
        paletteBytes = parsePaletteFile(await paletteFile.arrayBuffer(), paletteFile.name);
        paletteName = paletteFile.name;
      }

      const frames = applyPalette(decoded, normalizePalette(paletteBytes));

      state = { decoded, frames, paletteName, frmName: frmFile.name };
      fpsInfo.textContent = `FPS: ${decoded.header.fps}`;
      populateDirections(decoded.header.framesPerDir);
      updateMeta(paletteName);
      statusLine.textContent = `Загружено: ${frmFile.name}${paletteFile ? ` + ${paletteFile.name}` : ""}`;
      directionSelect.value = "0";
      directionSelect.disabled = false;
      currentDirection = 0;
      renderCurrentDirection();
    } catch (error) {
      console.error("Ошибка обработки файлов", error);
      setError(error instanceof Error ? error.message : String(error));
      state = null;
      fpsInfo.textContent = "FPS: —";
      directionSelect.disabled = true;
      directionSelect.innerHTML = "";
      framesList.innerHTML = "";
      metaTable.innerHTML = "";
      statusLine.textContent = "Палитра по умолчанию: !Fallout";
      stopAnimation();
      clearCanvas(sheetCanvas);
      clearCanvas(animationCanvas);
    }
  }

  function populateDirections(count: number): void {
    directionSelect.innerHTML = "";
    for (let i = 0; i < count; i++) {
      const option = document.createElement("option");
      option.value = String(i);
      option.textContent = `#${i + 1}`;
      directionSelect.appendChild(option);
    }
  }

  function updateMeta(paletteName: string): void {
    if (!state) {
      metaTable.innerHTML = "";
      framesList.innerHTML = "";
      return;
    }
    const { header, directions } = state.decoded;
    metaTable.innerHTML = `
      <tr><th>Файл</th><td>${state.frmName}</td></tr>
      <tr><th>Палитра</th><td>${paletteName}</td></tr>
      <tr><th>Версия</th><td>${header.version}</td></tr>
      <tr><th>FPS</th><td>${header.fps}</td></tr>
      <tr><th>Action frame</th><td>${header.actionFrame}</td></tr>
      <tr><th>Кадров/направление</th><td>${header.framesPerDir}</td></tr>
      <tr><th>Shift X</th><td>${header.shiftX.join(", ")}</td></tr>
      <tr><th>Shift Y</th><td>${header.shiftY.join(", ")}</td></tr>
      <tr><th>Смещения направлений</th><td>${header.dirOffsets.join(", ")}</td></tr>
      <tr><th>Всего кадров</th><td>${directions.flat().length}</td></tr>
    `;
  }

  function renderCurrentDirection(): void {
    stopAnimation();
    clearCanvas(sheetCanvas);
    clearCanvas(animationCanvas);
    framesList.innerHTML = "";

    if (!state) {
      return;
    }
    const frames = state.frames[currentDirection] ?? [];
    if (frames.length === 0) {
      framesList.textContent = "Нет кадров для выбранного направления";
      return;
    }

    renderSpriteSheet(sheetCanvas, frames);
    updateFramesList(frames);
    startAnimation(frames, state.decoded.header.fps);
  }

  function startAnimation(frames: RgbaFrame[], fps: number): void {
    const ctx = animationCanvas.getContext("2d");
    if (!ctx) {
      return;
    }

    const { width, height } = measureFrames(frames);
    animationCanvas.width = width || 1;
    animationCanvas.height = height || 1;

    currentFrameIndex = 0;
    lastTimestamp = 0;
    const frameDuration = fps > 0 ? 1000 / fps : 100;

    const drawFrame = (frame: RgbaFrame) => {
      ctx.clearRect(0, 0, animationCanvas.width, animationCanvas.height);
      const image = new ImageData(frame.rgba, frame.w, frame.h);
      const x = Math.floor((animationCanvas.width - frame.w) / 2);
      const y = Math.floor((animationCanvas.height - frame.h) / 2);
      ctx.putImageData(image, x, y);
    };

    drawFrame(frames[currentFrameIndex]);

    const step = (timestamp: number) => {
      if (!state) {
        return;
      }
      if (timestamp - lastTimestamp >= frameDuration) {
        lastTimestamp = timestamp;
        currentFrameIndex = (currentFrameIndex + 1) % frames.length;
        drawFrame(frames[currentFrameIndex]);
      }
      rafId = requestAnimationFrame(step);
    };

    rafId = requestAnimationFrame(step);
  }

  function renderSpriteSheet(canvas: HTMLCanvasElement, frames: RgbaFrame[]): void {
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return;
    }

    const gap = 2;
    const totalWidth = frames.reduce((sum, frame, index) => sum + frame.w + (index > 0 ? gap : 0), 0);
    const maxHeight = measureFrames(frames).height;

    canvas.width = totalWidth || 1;
    canvas.height = maxHeight || 1;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    let offsetX = 0;
    for (const frame of frames) {
      const image = new ImageData(frame.rgba, frame.w, frame.h);
      const y = maxHeight - frame.h;
      ctx.putImageData(image, offsetX, y);
      offsetX += frame.w + gap;
    }
  }

  function updateFramesList(frames: RgbaFrame[]): void {
    framesList.innerHTML = "";
    frames.forEach((frame, index) => {
      const line = document.createElement("span");
      line.innerHTML = `<strong>#${index}</strong> — ${frame.w}×${frame.h} (x: ${frame.xOff}, y: ${frame.yOff})`;
      framesList.appendChild(line);
    });
  }

  function clearCanvas(canvas: HTMLCanvasElement): void {
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return;
    }
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  return () => {
    stopAnimation();
  };
}

function hasExtension(name: string, allowed: string[]): boolean {
  const lower = name.toLowerCase();
  return allowed.some((ext) => lower.endsWith(ext));
}

function measureFrames(frames: RgbaFrame[]): { width: number; height: number } {
  return frames.reduce(
    (acc, frame) => ({
      width: Math.max(acc.width, frame.w),
      height: Math.max(acc.height, frame.h),
    }),
    { width: 0, height: 0 },
  );
}
