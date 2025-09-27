interface HudCallbacks {
  onToggleEditor: () => void;
  onSave: () => void;
  onLoad: (file: File) => void;
  onExport: () => void;
  onFullscreen: () => void;
}

export class GameHud {
  private root: HTMLDivElement;
  private coordsLabel: HTMLDivElement;
  private fileInput: HTMLInputElement;
  private fullscreenButton: HTMLButtonElement;

  constructor(parent: HTMLElement, callbacks: HudCallbacks) {
    this.root = document.createElement("div");
    this.root.className = "game-ui pip-panel";

    const heading = document.createElement("div");
    heading.className = "pip-subtitle";
    heading.textContent = "Консоль Смотрителя";

    const coords = document.createElement("div");
    coords.className = "coords";
    coords.textContent = "Q: 0 | R: 0";
    this.coordsLabel = coords;

    const editorButton = document.createElement("button");
    editorButton.textContent = "Редактор [E]";
    editorButton.addEventListener("click", callbacks.onToggleEditor);

    const saveButton = document.createElement("button");
    saveButton.textContent = "Экспорт карты в JSON";
    saveButton.addEventListener("click", callbacks.onSave);

    const loadButton = document.createElement("button");
    loadButton.textContent = "Загрузить карту из JSON";
    loadButton.addEventListener("click", () => {
      this.fileInput.click();
    });

    const exportButton = document.createElement("button");
    exportButton.textContent = "Сохранить карту PNG";
    exportButton.addEventListener("click", callbacks.onExport);

    this.fileInput = document.createElement("input");
    this.fileInput.type = "file";
    this.fileInput.accept = "application/json";
    this.fileInput.style.display = "none";
    this.fileInput.addEventListener("change", () => {
      const file = this.fileInput.files?.[0];
      if (file) {
        callbacks.onLoad(file);
      }
      this.fileInput.value = "";
    });

    this.fullscreenButton = document.createElement("button");
    this.fullscreenButton.className = "fullscreen-button";
    this.fullscreenButton.textContent = "Во весь экран";
    this.fullscreenButton.style.display = "none";
    this.fullscreenButton.addEventListener("click", callbacks.onFullscreen);

    this.root.append(
      heading,
      coords,
      editorButton,
      saveButton,
      loadButton,
      exportButton
    );
    parent.append(this.root, this.fileInput, this.fullscreenButton);
  }

  updateCoords(q: number, r: number): void {
    this.coordsLabel.textContent = `Q: ${q} | R: ${r}`;
  }

  showFullscreenButton(show: boolean): void {
    this.fullscreenButton.style.display = show ? "block" : "none";
  }
}
