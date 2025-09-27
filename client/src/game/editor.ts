import type { MapJSON, MapLayer } from "@tla/shared";

export type EditorMode = "paint" | "erase";

type ChangeListener = () => void;

type SaveHandler = (map: MapJSON) => void;
type LoadHandler = (map: MapJSON) => void;

export class MapEditor {
  private panel: HTMLDivElement;
  private visible = false;
  private mode: EditorMode = "paint";
  private layer: MapLayer = "floor";
  private tileId = "tile_placeholder";
  private listeners: ChangeListener[] = [];
  private onSave?: SaveHandler;
  private onLoad?: LoadHandler;

  constructor(parent: HTMLElement) {
    this.panel = document.createElement("div");
    this.panel.className = "editor-panel pip-panel";
    this.panel.style.display = "none";

    const title = document.createElement("h2");
    title.textContent = "Редактор карты";

    const layerSection = document.createElement("div");
    layerSection.className = "section";
    const layerLabel = document.createElement("label");
    layerLabel.textContent = "Слой";
    const layerSelect = document.createElement("select");
    const layerNames: Record<MapLayer, string> = {
      floor: "Пол",
      wall: "Стена",
      object: "Объект",
    };

    (["floor", "wall", "object"] as MapLayer[]).forEach((value) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = layerNames[value];
      layerSelect.appendChild(option);
    });
    layerSelect.value = this.layer;
    layerSelect.addEventListener("change", () => {
      this.layer = layerSelect.value as MapLayer;
      this.emit();
    });
    layerLabel.appendChild(layerSelect);
    layerSection.appendChild(layerLabel);

    const tileSection = document.createElement("div");
    tileSection.className = "section";
    const tileLabel = document.createElement("label");
    tileLabel.textContent = "ID тайла";
    const tileInput = document.createElement("input");
    tileInput.type = "text";
    tileInput.value = this.tileId;
    tileInput.addEventListener("change", () => {
      this.tileId = tileInput.value.trim() || "tile_placeholder";
      this.emit();
    });
    tileLabel.appendChild(tileInput);
    tileSection.appendChild(tileLabel);

    const toolsRow = document.createElement("div");
    toolsRow.className = "tools";
    const paintButton = document.createElement("button");
    paintButton.textContent = "Рисовать";
    paintButton.addEventListener("click", () => {
      this.mode = "paint";
      paintButton.classList.add("active");
      eraseButton.classList.remove("active");
      this.emit();
    });
    const eraseButton = document.createElement("button");
    eraseButton.textContent = "Стирать";
    eraseButton.addEventListener("click", () => {
      this.mode = "erase";
      eraseButton.classList.add("active");
      paintButton.classList.remove("active");
      this.emit();
    });
    paintButton.classList.add("active");
    toolsRow.append(paintButton, eraseButton);

    this.panel.append(title, layerSection, tileSection, toolsRow);
    parent.appendChild(this.panel);
  }

  onChange(listener: ChangeListener): void {
    this.listeners.push(listener);
  }

  setMapHandlers(onSave: SaveHandler, onLoad: LoadHandler): void {
    this.onSave = onSave;
    this.onLoad = onLoad;
  }

  getLayer(): MapLayer {
    return this.layer;
  }

  getMode(): EditorMode {
    return this.mode;
  }

  getTileId(): string {
    return this.tileId;
  }

  isVisible(): boolean {
    return this.visible;
  }

  setVisible(visible: boolean): void {
    this.visible = visible;
    this.panel.style.display = visible ? "flex" : "none";
  }

  download(map: MapJSON): void {
    if (!this.onSave) return;
    this.onSave(map);
  }

  upload(file: File): void {
    if (!this.onLoad) return;
    file
      .text()
      .then((text) => JSON.parse(text) as MapJSON)
      .then((json) => this.onLoad?.(json))
      .catch((err) => console.error("Не удалось загрузить карту", err));
  }

  private emit(): void {
    this.listeners.forEach((listener) => listener());
  }
}
