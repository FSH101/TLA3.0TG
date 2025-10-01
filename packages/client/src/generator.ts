import { drawMap, getPixelMetrics, projectHex } from './rendering';
import type {
  AssetDescriptor,
  HexGridInfo,
  ImageCache,
  MapData,
  MapObject,
  MapTile,
} from './types';

interface GeneratorPage {
  root: HTMLElement;
  activate(): void;
  deactivate(): void;
}

interface AssetCatalogEntry {
  id: string;
  folder: string;
  name: string;
  originalPath: string;
  dirs: number;
  framesPerDir: number;
  descriptor: AssetDescriptor;
}

type PlacementMode = 'ground' | 'roof' | 'object' | 'erase';

interface EditableMapState {
  id: string;
  name: string;
  hex: HexGridInfo;
  size: { w: number; h: number };
  tiles: Map<string, MapTile>;
  objects: Map<string, MapObject[]>;
}

interface RenderContext {
  offsetX: number;
  offsetY: number;
  dpr: number;
}

const TILE_FOLDERS = new Set(['tiles']);
const OBJECT_FOLDERS = new Set(['misc', 'scenery', 'skilldex', 'splash', 'walls']);

export function createGeneratorPage(): GeneratorPage {
  const root = document.createElement('div');
  root.className = 'generator-page';

  const sidebar = document.createElement('aside');
  sidebar.className = 'generator-sidebar';

  const settingsSection = document.createElement('section');
  settingsSection.className = 'generator-section';

  const settingsHeader = document.createElement('h2');
  settingsHeader.textContent = 'Параметры карты';
  settingsSection.appendChild(settingsHeader);

  const settingsForm = document.createElement('form');
  settingsForm.className = 'generator-form';
  settingsSection.appendChild(settingsForm);

  sidebar.appendChild(settingsSection);

  const paletteSection = document.createElement('section');
  paletteSection.className = 'generator-section';

  const paletteHeader = document.createElement('h2');
  paletteHeader.textContent = 'Библиотека ассетов';
  paletteSection.appendChild(paletteHeader);

  const paletteSearch = document.createElement('input');
  paletteSearch.type = 'search';
  paletteSearch.placeholder = 'Поиск по имени или пути…';
  paletteSearch.className = 'asset-search';
  paletteSection.appendChild(paletteSearch);

  const paletteList = document.createElement('div');
  paletteList.className = 'asset-list';
  paletteSection.appendChild(paletteList);

  sidebar.appendChild(paletteSection);

  const content = document.createElement('div');
  content.className = 'generator-content';

  const toolbar = document.createElement('div');
  toolbar.className = 'generator-toolbar';

  const modeLabel = document.createElement('span');
  modeLabel.textContent = 'Режим:';
  toolbar.appendChild(modeLabel);

  const modeButtons: { mode: PlacementMode; button: HTMLButtonElement }[] = [];
  const modes: { label: string; mode: PlacementMode }[] = [
    { label: 'Пол', mode: 'ground' },
    { label: 'Крыша', mode: 'roof' },
    { label: 'Объект', mode: 'object' },
    { label: 'Ластик', mode: 'erase' },
  ];
  for (const entry of modes) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = entry.label;
    button.className = 'mode-button';
    toolbar.appendChild(button);
    modeButtons.push({ mode: entry.mode, button });
  }

  const selectionInfo = document.createElement('div');
  selectionInfo.className = 'selection-info';
  toolbar.appendChild(selectionInfo);

  const objectControls = document.createElement('div');
  objectControls.className = 'object-controls';
  const dirLabel = document.createElement('label');
  dirLabel.textContent = 'Направление:';
  const dirInput = document.createElement('input');
  dirInput.type = 'number';
  dirInput.min = '0';
  dirInput.max = '5';
  dirInput.value = '0';
  dirInput.step = '1';
  dirLabel.appendChild(dirInput);

  const elevLabel = document.createElement('label');
  elevLabel.textContent = 'Высота:';
  const elevInput = document.createElement('input');
  elevInput.type = 'number';
  elevInput.value = '0';
  elevInput.step = '1';
  elevLabel.appendChild(elevInput);

  objectControls.append(dirLabel, elevLabel);
  toolbar.appendChild(objectControls);

  const canvasWrap = document.createElement('div');
  canvasWrap.className = 'generator-canvas-wrap';

  const canvas = document.createElement('canvas');
  canvas.className = 'generator-canvas';
  canvasWrap.appendChild(canvas);

  const generatorStatus = document.createElement('div');
  generatorStatus.className = 'generator-status';

  const summary = document.createElement('div');
  summary.className = 'generator-summary';

  const exportSection = document.createElement('section');
  exportSection.className = 'generator-section export-section';
  const exportHeader = document.createElement('h2');
  exportHeader.textContent = 'Экспорт карты';
  exportSection.appendChild(exportHeader);

  const exportButtons = document.createElement('div');
  exportButtons.className = 'export-actions';

  const exportButton = document.createElement('button');
  exportButton.type = 'button';
  exportButton.textContent = 'Сформировать JSON';
  exportButtons.appendChild(exportButton);

  const downloadButton = document.createElement('button');
  downloadButton.type = 'button';
  downloadButton.textContent = 'Скачать файл';
  exportButtons.appendChild(downloadButton);

  const copyButton = document.createElement('button');
  copyButton.type = 'button';
  copyButton.textContent = 'Копировать';
  exportButtons.appendChild(copyButton);

  exportSection.appendChild(exportButtons);

  const exportOutput = document.createElement('textarea');
  exportOutput.readOnly = true;
  exportOutput.className = 'export-output';
  exportSection.appendChild(exportOutput);

  content.append(toolbar, canvasWrap, generatorStatus, summary, exportSection);

  root.append(sidebar, content);

  let assets: AssetCatalogEntry[] = [];
  const assetLookup = new Map<string, AssetCatalogEntry>();
  let placementMode: PlacementMode = 'ground';
  let selectedAsset: AssetCatalogEntry | null = null;
  let hoverCell: { q: number; r: number } | null = null;
  let renderContext: RenderContext | null = null;
  const imageCache: ImageCache = new Map();
  let assetsLoaded = false;

  const mapState: EditableMapState = {
    id: 'custom-map',
    name: 'Новая карта',
    hex: {
      orientation: 'isometric',
      size: 28,
      pixel: { tileWidth: 80, tileHeight: 36, elevation: 96 },
    },
    size: { w: 16, h: 16 },
    tiles: new Map(),
    objects: new Map(),
  };

  function updateModeButtons(): void {
    for (const entry of modeButtons) {
      if (entry.mode === placementMode) {
        entry.button.classList.add('active');
      } else {
        entry.button.classList.remove('active');
      }
    }
    objectControls.style.display = placementMode === 'object' ? 'flex' : 'none';
  }

  function updateSelectionInfo(): void {
    if (!selectedAsset) {
      selectionInfo.textContent = 'Ассет не выбран';
      return;
    }
    selectionInfo.textContent = `${selectedAsset.folder} / ${selectedAsset.name}`;
  }

  function updateSummary(): void {
    const tileCount = mapState.tiles.size;
    let objectCount = 0;
    for (const list of mapState.objects.values()) {
      objectCount += list.length;
    }
    summary.textContent = `Размер: ${mapState.size.w} × ${mapState.size.h} • Плиток: ${tileCount} • Объектов: ${objectCount}`;
  }

  function setStatus(message: string, isError = false): void {
    generatorStatus.textContent = message;
    generatorStatus.classList.toggle('error', isError);
  }

  function tileKey(layer: 'ground' | 'roof', q: number, r: number): string {
    return `${layer}:${q}:${r}`;
  }

  function objectKey(q: number, r: number): string {
    return `${q}:${r}`;
  }

  function ensureWithinBounds(q: number, r: number): boolean {
    return q >= 0 && r >= 0 && q < mapState.size.w && r < mapState.size.h;
  }

  function addTile(layer: 'ground' | 'roof', q: number, r: number, art: string): void {
    if (!ensureWithinBounds(q, r)) {
      return;
    }
    const key = tileKey(layer, q, r);
    mapState.tiles.set(key, { q, r, layer, art });
  }

  function removeTile(q: number, r: number, layer?: 'ground' | 'roof'): void {
    if (layer) {
      mapState.tiles.delete(tileKey(layer, q, r));
      return;
    }
    mapState.tiles.delete(tileKey('ground', q, r));
    mapState.tiles.delete(tileKey('roof', q, r));
  }

  function addObject(q: number, r: number, art: string, dir: number, elev: number): void {
    if (!ensureWithinBounds(q, r)) {
      return;
    }
    const key = objectKey(q, r);
    const list = mapState.objects.get(key) ?? [];
    const id = globalThis.crypto?.randomUUID
      ? globalThis.crypto.randomUUID()
      : `obj-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    list.push({ id, q, r, art, dir, elev });
    mapState.objects.set(key, list);
  }

  function removeObjects(q: number, r: number): void {
    mapState.objects.delete(objectKey(q, r));
  }

  function clearOutsideBounds(): void {
    for (const key of [...mapState.tiles.keys()]) {
      const [, qStr, rStr] = key.split(':');
      const q = Number.parseInt(qStr, 10);
      const r = Number.parseInt(rStr, 10);
      if (!ensureWithinBounds(q, r)) {
        mapState.tiles.delete(key);
      }
    }
    for (const [key] of mapState.objects.entries()) {
      const [qStr, rStr] = key.split(':');
      const q = Number.parseInt(qStr, 10);
      const r = Number.parseInt(rStr, 10);
      if (!ensureWithinBounds(q, r)) {
        mapState.objects.delete(key);
      }
    }
  }

  function buildMapData(): MapData {
    const tiles = [...mapState.tiles.values()].sort((a, b) => {
      if (a.layer === b.layer) {
        if (a.r === b.r) {
          return a.q - b.q;
        }
        return a.r - b.r;
      }
      return a.layer.localeCompare(b.layer);
    });

    const objects: MapObject[] = [];
    for (const list of mapState.objects.values()) {
      for (const obj of list) {
        objects.push({ ...obj });
      }
    }

    objects.sort((a, b) => {
      if (a.r === b.r) {
        if (a.q === b.q) {
          return a.id.localeCompare(b.id);
        }
        return a.q - b.q;
      }
      return a.r - b.r;
    });

    const assetsMeta: Record<string, AssetDescriptor> = {};
    for (const tile of tiles) {
      const asset = assetLookup.get(tile.art);
      if (asset) {
        assetsMeta[tile.art] = asset.descriptor;
      }
    }
    for (const object of objects) {
      const asset = assetLookup.get(object.art);
      if (asset) {
        assetsMeta[object.art] = asset.descriptor;
      }
    }

    return {
      id: mapState.id,
      name: mapState.name,
      hex: { ...mapState.hex },
      size: { ...mapState.size },
      tiles,
      objects,
      assets: assetsMeta,
    };
  }

  function serializeMapData(): string {
    const map = buildMapData();
    const payload = {
      id: map.id,
      name: map.name,
      hex: map.hex,
      size: map.size,
      tiles: map.tiles.map(({ layer, q, r, art }) => ({ layer, q, r, art })),
      objects: map.objects.map(({ id, q, r, elev, dir, art }) => ({ id, q, r, elev, dir, art })),
      assets: map.assets ?? {},
    };
    return JSON.stringify(payload, null, 2);
  }

  function ensureExportOutput(): string {
    const json = serializeMapData();
    exportOutput.value = json;
    return json;
  }

  async function refreshPreview(): Promise<void> {
    const mapData = buildMapData();
    try {
      const result = await drawMap(canvas, mapData, imageCache);
      renderContext = { offsetX: result.offsetX, offsetY: result.offsetY, dpr: result.dpr };
      drawGridOverlay(result.ctx, result.offsetX, result.offsetY, mapData);
      setStatus('Готово');
    } catch (error) {
      console.error(error);
      setStatus('Не удалось отрисовать карту', true);
    }
  }

  function drawGridOverlay(
    ctx: CanvasRenderingContext2D,
    offsetX: number,
    offsetY: number,
    map: MapData,
  ): void {
    ctx.save();
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.fillStyle = 'rgba(255,255,255,0.05)';

    for (let r = 0; r < map.size.h; r += 1) {
      for (let q = 0; q < map.size.w; q += 1) {
        const polygon = computeCellPolygon(q, r, map.hex);
        if (polygon.length === 0) {
          continue;
        }
        ctx.beginPath();
        ctx.moveTo(polygon[0].x + offsetX, polygon[0].y + offsetY);
        for (let i = 1; i < polygon.length; i += 1) {
          ctx.lineTo(polygon[i].x + offsetX, polygon[i].y + offsetY);
        }
        ctx.closePath();
        if (hoverCell && hoverCell.q === q && hoverCell.r === r) {
          ctx.fillStyle = 'rgba(255,255,255,0.1)';
          ctx.fill();
          ctx.fillStyle = 'rgba(255,255,255,0.05)';
        }
        ctx.stroke();
      }
    }

    ctx.restore();
  }

  function computeCellPolygon(q: number, r: number, hex: HexGridInfo): { x: number; y: number }[] {
    const points: { x: number; y: number }[] = [];
    if (hex.orientation === 'isometric') {
      const metrics = getPixelMetrics(hex);
      const base = projectHex(q, r, hex);
      const halfWidth = metrics.tileWidth / 2;
      const halfHeight = metrics.tileHeight / 2;
      const centerY = base.y - halfHeight;
      points.push(
        { x: base.x, y: centerY - halfHeight },
        { x: base.x + halfWidth, y: centerY },
        { x: base.x, y: base.y },
        { x: base.x - halfWidth, y: centerY },
      );
      return points;
    }

    const center = projectHex(q, r, hex);
    const radius = Math.max(1, hex.size);
    const angleOffset = hex.orientation === 'pointy' ? -30 : 0;
    for (let i = 0; i < 6; i += 1) {
      const angle = ((60 * i + angleOffset) * Math.PI) / 180;
      points.push({ x: center.x + radius * Math.cos(angle), y: center.y + radius * Math.sin(angle) });
    }
    return points;
  }

  function pointInPolygon(point: { x: number; y: number }, polygon: { x: number; y: number }[]): boolean {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
      const xi = polygon[i].x;
      const yi = polygon[i].y;
      const xj = polygon[j].x;
      const yj = polygon[j].y;
      const intersect = yi > point.y !== yj > point.y && point.x < ((xj - xi) * (point.y - yi)) / (yj - yi) + xi;
      if (intersect) {
        inside = !inside;
      }
    }
    return inside;
  }

  function pickCell(worldX: number, worldY: number): { q: number; r: number } | null {
    const hex = mapState.hex;
    for (let r = 0; r < mapState.size.h; r += 1) {
      for (let q = 0; q < mapState.size.w; q += 1) {
        const polygon = computeCellPolygon(q, r, hex);
        if (polygon.length === 0) {
          continue;
        }
        if (pointInPolygon({ x: worldX, y: worldY }, polygon)) {
          return { q, r };
        }
      }
    }
    return null;
  }

  function handleCanvasAction(event: MouseEvent): void {
    if (!renderContext) {
      return;
    }
    const rect = canvas.getBoundingClientRect();
    const cssX = event.clientX - rect.left;
    const cssY = event.clientY - rect.top;
    const worldX = cssX - renderContext.offsetX;
    const worldY = cssY - renderContext.offsetY;
    const cell = pickCell(worldX, worldY);
    if (!cell) {
      return;
    }

    if (placementMode === 'erase') {
      removeTile(cell.q, cell.r);
      removeObjects(cell.q, cell.r);
      updateSummary();
      void refreshPreview();
      return;
    }

    if (!selectedAsset) {
      setStatus('Сначала выберите ассет', true);
      return;
    }

    if (placementMode === 'ground' || placementMode === 'roof') {
      if (!TILE_FOLDERS.has(selectedAsset.folder)) {
        setStatus('Для плиток выберите ассет из папки tiles', true);
        return;
      }
      addTile(placementMode, cell.q, cell.r, selectedAsset.id);
    } else if (placementMode === 'object') {
      if (!OBJECT_FOLDERS.has(selectedAsset.folder) && !TILE_FOLDERS.has(selectedAsset.folder)) {
        setStatus('Ассет не подходит для объектов', true);
        return;
      }
      const dir = Number.parseInt(dirInput.value, 10) || 0;
      const elev = Number.parseInt(elevInput.value, 10) || 0;
      addObject(cell.q, cell.r, selectedAsset.id, dir, elev);
    }

    updateSummary();
    void refreshPreview();
  }

  function updateHover(event: MouseEvent): void {
    if (!renderContext) {
      return;
    }
    const rect = canvas.getBoundingClientRect();
    const cssX = event.clientX - rect.left;
    const cssY = event.clientY - rect.top;
    const worldX = cssX - renderContext.offsetX;
    const worldY = cssY - renderContext.offsetY;
    const cell = pickCell(worldX, worldY);
    const changed = (hoverCell?.q ?? -1) !== (cell?.q ?? -1) || (hoverCell?.r ?? -1) !== (cell?.r ?? -1);
    hoverCell = cell;
    if (changed) {
      void refreshPreview();
    }
  }

  function clearHover(): void {
    if (hoverCell) {
      hoverCell = null;
      void refreshPreview();
    }
  }

  canvas.addEventListener('click', handleCanvasAction);
  canvas.addEventListener('mousemove', updateHover);
  canvas.addEventListener('mouseleave', clearHover);

  for (const entry of modeButtons) {
    entry.button.addEventListener('click', () => {
      placementMode = entry.mode;
      updateModeButtons();
    });
  }

  function createLabeledInput(
    labelText: string,
    input: HTMLInputElement | HTMLSelectElement,
    description?: string,
  ): HTMLDivElement {
    const wrapper = document.createElement('div');
    wrapper.className = 'form-field';
    const label = document.createElement('label');
    label.textContent = labelText;
    label.appendChild(input);
    wrapper.appendChild(label);
    if (description) {
      const hint = document.createElement('span');
      hint.className = 'field-hint';
      hint.textContent = description;
      wrapper.appendChild(hint);
    }
    return wrapper;
  }

  const idInput = document.createElement('input');
  idInput.type = 'text';
  idInput.value = mapState.id;
  settingsForm.appendChild(createLabeledInput('Идентификатор', idInput));

  idInput.addEventListener('input', () => {
    mapState.id = idInput.value.trim() || 'custom-map';
  });

  const nameInput = document.createElement('input');
  nameInput.type = 'text';
  nameInput.value = mapState.name;
  settingsForm.appendChild(createLabeledInput('Название', nameInput));

  nameInput.addEventListener('input', () => {
    mapState.name = nameInput.value.trim() || 'Новая карта';
  });

  const widthInput = document.createElement('input');
  widthInput.type = 'number';
  widthInput.min = '1';
  widthInput.value = mapState.size.w.toString();
  settingsForm.appendChild(createLabeledInput('Ширина', widthInput));

  widthInput.addEventListener('change', () => {
    const value = Number.parseInt(widthInput.value, 10);
    if (Number.isFinite(value) && value > 0) {
      mapState.size.w = value;
      clearOutsideBounds();
      updateSummary();
      void refreshPreview();
    }
  });

  const heightInput = document.createElement('input');
  heightInput.type = 'number';
  heightInput.min = '1';
  heightInput.value = mapState.size.h.toString();
  settingsForm.appendChild(createLabeledInput('Высота', heightInput));

  heightInput.addEventListener('change', () => {
    const value = Number.parseInt(heightInput.value, 10);
    if (Number.isFinite(value) && value > 0) {
      mapState.size.h = value;
      clearOutsideBounds();
      updateSummary();
      void refreshPreview();
    }
  });

  const orientationSelect = document.createElement('select');
  for (const value of ['isometric', 'pointy', 'flat'] as const) {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = value;
    orientationSelect.appendChild(option);
  }
  orientationSelect.value = mapState.hex.orientation;
  settingsForm.appendChild(createLabeledInput('Ориентация гекса', orientationSelect));

  orientationSelect.addEventListener('change', () => {
    const value = orientationSelect.value as HexGridInfo['orientation'];
    mapState.hex.orientation = value;
    if (value === 'isometric') {
      mapState.hex.pixel = mapState.hex.pixel ?? { tileWidth: 80, tileHeight: 36, elevation: 96 };
      pixelWidthInput.value = `${mapState.hex.pixel.tileWidth}`;
      pixelHeightInput.value = `${mapState.hex.pixel.tileHeight}`;
      pixelElevationInput.value = `${mapState.hex.pixel.elevation}`;
    } else {
      delete mapState.hex.pixel;
    }
    void refreshPreview();
  });

  const sizeInput = document.createElement('input');
  sizeInput.type = 'number';
  sizeInput.min = '1';
  sizeInput.value = mapState.hex.size.toString();
  settingsForm.appendChild(createLabeledInput('Размер гекса', sizeInput));

  sizeInput.addEventListener('change', () => {
    const value = Number.parseInt(sizeInput.value, 10);
    if (Number.isFinite(value) && value > 0) {
      mapState.hex.size = value;
      void refreshPreview();
    }
  });

  const pixelWidthInput = document.createElement('input');
  pixelWidthInput.type = 'number';
  pixelWidthInput.min = '1';
  pixelWidthInput.value = mapState.hex.pixel?.tileWidth?.toString() ?? '80';

  const pixelHeightInput = document.createElement('input');
  pixelHeightInput.type = 'number';
  pixelHeightInput.min = '1';
  pixelHeightInput.value = mapState.hex.pixel?.tileHeight?.toString() ?? '36';

  const pixelElevationInput = document.createElement('input');
  pixelElevationInput.type = 'number';
  pixelElevationInput.min = '0';
  pixelElevationInput.value = mapState.hex.pixel?.elevation?.toString() ?? '96';

  const pixelWrapper = document.createElement('div');
  pixelWrapper.className = 'pixel-fields';
  pixelWrapper.appendChild(createLabeledInput('Ширина тайла', pixelWidthInput));
  pixelWrapper.appendChild(createLabeledInput('Высота тайла', pixelHeightInput));
  pixelWrapper.appendChild(createLabeledInput('Высота уровня', pixelElevationInput));
  settingsForm.appendChild(pixelWrapper);

  function syncPixelVisibility(): void {
    pixelWrapper.style.display = mapState.hex.orientation === 'isometric' ? 'grid' : 'none';
  }

  syncPixelVisibility();

  function ensurePixelMetrics(): void {
    if (mapState.hex.orientation !== 'isometric') {
      return;
    }
    mapState.hex.pixel = {
      tileWidth: Number.parseInt(pixelWidthInput.value, 10) || 80,
      tileHeight: Number.parseInt(pixelHeightInput.value, 10) || 36,
      elevation: Number.parseInt(pixelElevationInput.value, 10) || 96,
    };
  }

  pixelWidthInput.addEventListener('change', () => {
    ensurePixelMetrics();
    void refreshPreview();
  });
  pixelHeightInput.addEventListener('change', () => {
    ensurePixelMetrics();
    void refreshPreview();
  });
  pixelElevationInput.addEventListener('change', () => {
    ensurePixelMetrics();
    void refreshPreview();
  });

  orientationSelect.addEventListener('change', () => {
    syncPixelVisibility();
  });

  paletteSearch.addEventListener('input', () => {
    renderAssetPalette();
  });

  function renderAssetPalette(): void {
    const filter = paletteSearch.value.trim().toLowerCase();
    paletteList.innerHTML = '';
    const groups = new Map<string, AssetCatalogEntry[]>();
    for (const asset of assets) {
      if (filter) {
        const haystack = `${asset.folder}/${asset.name}/${asset.originalPath}`.toLowerCase();
        if (!haystack.includes(filter)) {
          continue;
        }
      }
      const list = groups.get(asset.folder) ?? [];
      list.push(asset);
      groups.set(asset.folder, list);
    }

    const sortedGroups = [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
    if (sortedGroups.length === 0) {
      const empty = document.createElement('p');
      empty.textContent = 'Ассеты не найдены';
      paletteList.appendChild(empty);
      return;
    }

    for (const [folder, entries] of sortedGroups) {
      const details = document.createElement('details');
      details.open = true;
      const summaryEl = document.createElement('summary');
      summaryEl.textContent = `${folder} (${entries.length})`;
      details.appendChild(summaryEl);

      const grid = document.createElement('div');
      grid.className = 'asset-grid';
      for (const asset of entries.sort((a, b) => a.name.localeCompare(b.name))) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'asset-item';
        if (selectedAsset?.id === asset.id) {
          button.classList.add('selected');
        }

        const preview = document.createElement('img');
        preview.loading = 'lazy';
        preview.alt = asset.name;
        preview.src = `/art/${asset.id}/dir_0/frame_00.png`;
        button.appendChild(preview);

        const caption = document.createElement('span');
        caption.textContent = asset.name;
        button.appendChild(caption);

        button.addEventListener('click', () => {
          selectedAsset = asset;
          updateSelectionInfo();
          renderAssetPalette();
        });

        grid.appendChild(button);
      }
      details.appendChild(grid);
      paletteList.appendChild(details);
    }
  }

  async function loadAssets(): Promise<void> {
    if (assetsLoaded) {
      return;
    }
    setStatus('Загружаем ассеты…');
    try {
      const response = await fetch('/api/assets');
      if (!response.ok) {
        throw new Error(`${response.status} ${response.statusText}`);
      }
      const data = (await response.json()) as AssetCatalogEntry[];
      assets = data;
      assetLookup.clear();
      for (const entry of assets) {
        assetLookup.set(entry.id, entry);
      }
      assetsLoaded = true;
      renderAssetPalette();
      updateSelectionInfo();
      updateSummary();
      setStatus('Ассеты загружены');
    } catch (error) {
      console.error(error);
      setStatus('Не удалось загрузить ассеты', true);
    }
  }

  exportButton.addEventListener('click', () => {
    ensureExportOutput();
    setStatus('JSON обновлён');
  });

  downloadButton.addEventListener('click', () => {
    const json = exportOutput.value || ensureExportOutput();
    if (!json) {
      setStatus('Сначала сформируйте JSON', true);
      return;
    }
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${mapState.id}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setStatus('Файл скачан');
  });

  copyButton.addEventListener('click', async () => {
    const json = exportOutput.value || ensureExportOutput();
    if (!json) {
      setStatus('Нет данных для копирования', true);
      return;
    }
    try {
      await navigator.clipboard.writeText(json);
      setStatus('JSON скопирован в буфер обмена');
    } catch (error) {
      console.error(error);
      setStatus('Не удалось скопировать JSON', true);
    }
  });

  const page: GeneratorPage = {
    root,
    activate() {
      void loadAssets();
      void refreshPreview();
    },
    deactivate() {
      // noop
    },
  };

  updateModeButtons();
  updateSelectionInfo();
  updateSummary();

  return page;
}
