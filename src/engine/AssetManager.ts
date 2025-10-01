import { Subject } from 'rxjs';

export interface AssetDescriptor {
  id: string;
  path_in: string;
  kind: string;
  category: string;
  tags: string[];
  out_dir: string;
  dirs?: number;
  framesPerDir?: number;
  palette?: string | null;
}

export interface AssetLoadProgress {
  total: number;
  loaded: number;
  currentId?: string;
}

export type AssetRecord = HTMLImageElement | ArrayBuffer | string;

type Fetcher = (input: RequestInfo, init?: RequestInit) => Promise<Response>;

export class AssetManager {
  private manifest = new Map<string, AssetDescriptor>();
  private cache = new Map<string, AssetRecord>();
  private readonly progress$ = new Subject<AssetLoadProgress>();

  get progressStream() {
    return this.progress$.asObservable();
  }

  async loadManifest(fetcher: Fetcher = fetch): Promise<void> {
    if (this.manifest.size > 0) {
      return;
    }

    const response = await fetcher('/asset_map.json');
    if (!response.ok) {
      throw new Error(`Unable to load asset manifest: ${response.status} ${response.statusText}`);
    }

    const json = (await response.json()) as AssetDescriptor[];
    for (const descriptor of json) {
      this.manifest.set(descriptor.id, descriptor);
    }
  }

  hasDescriptor(id: string): boolean {
    return this.manifest.has(id);
  }

  getDescriptor(id: string): AssetDescriptor | undefined {
    return this.manifest.get(id);
  }

  listDescriptorsByKind(kind: string): AssetDescriptor[] {
    return Array.from(this.manifest.values()).filter((asset) => asset.kind === kind);
  }

  async preloadAssets(ids: string[], fetcher: Fetcher = fetch): Promise<void> {
    if (ids.length === 0) {
      return;
    }

    let loaded = 0;
    const total = ids.length;

    for (const id of ids) {
      const descriptor = this.getDescriptor(id);
      if (!descriptor) {
        console.warn(`Asset ${id} is missing from manifest`);
        continue;
      }

      const record = await this.loadAssetRecord(descriptor, fetcher);
      this.cache.set(id, record);
      loaded += 1;
      this.progress$.next({ total, loaded, currentId: id });
    }
  }

  getCachedAsset(id: string): AssetRecord | undefined {
    return this.cache.get(id);
  }

  async loadAssetRecord(descriptor: AssetDescriptor, fetcher: Fetcher = fetch): Promise<AssetRecord> {
    if (this.cache.has(descriptor.id)) {
      return this.cache.get(descriptor.id)!;
    }

    const url = `/${descriptor.path_in.replace(/\\/g, '/')}`;

    if (descriptor.path_in.toLowerCase().endsWith('.frm') || descriptor.path_in.toLowerCase().endsWith('.rix')) {
      const response = await fetcher(url);
      if (!response.ok) {
        throw new Error(`Failed to download binary asset ${descriptor.id}`);
      }
      return await response.arrayBuffer();
    }

    if (descriptor.path_in.toLowerCase().match(/\.(png|jpg|jpeg|gif|webp)$/)) {
      return await this.loadImage(url);
    }

    const response = await fetcher(url);
    if (!response.ok) {
      throw new Error(`Failed to download asset ${descriptor.id}`);
    }
    return await response.text();
  }

  private loadImage(url: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = (event) => reject(new Error(`Failed to load image ${url}: ${event}`));
      img.src = url;
    });
  }
}
