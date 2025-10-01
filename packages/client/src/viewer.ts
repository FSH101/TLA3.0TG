import { drawMap } from './rendering';
import type { ImageCache, MapData, MapSummary } from './types';

interface ViewerPage {
  root: HTMLElement;
  activate(): void;
  deactivate(): void;
}

export function createViewerPage(): ViewerPage {
  const root = document.createElement('div');
  root.className = 'viewer-page';

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

  root.append(toolbar, viewer);

  let maps: MapSummary[] = [];
  let currentMap: MapData | null = null;
  const imageCache: ImageCache = new Map();
  let initialized = false;

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

  async function renderCurrentMap(): Promise<void> {
    const map = currentMap;
    if (!map) {
      return;
    }
    const result = await drawMap(canvas, map, imageCache);
    if (!Number.isFinite(result.bounds.minX)) {
      status.textContent = 'Карта пустая';
    }
  }

  select.addEventListener('change', (event: Event) => {
    const target = event.target as HTMLSelectElement | null;
    if (target && target.value) {
      loadMap(target.value).catch((error) => console.error('Map load failed', error));
    }
  });

  const page: ViewerPage = {
    root,
    activate() {
      if (!initialized) {
        initialized = true;
        loadMapsList().catch((error) => {
          console.error(error);
          status.textContent = 'Ошибка инициализации клиента';
          status.classList.add('error');
        });
      } else if (currentMap) {
        renderCurrentMap().catch((error) => console.error('Render failed', error));
      }
    },
    deactivate() {
      // noop
    },
  };

  return page;
}
