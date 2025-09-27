/// <reference types="vite/client" />

declare module "*.frm" {
  const src: string;
  export default src;
}

declare module "*.frm?url" {
  const src: string;
  export default src;
}

declare module "*.frm?raw" {
  const content: string;
  export default content;
}

declare module "*.frm?arraybuffer" {
  const data: ArrayBuffer;
  export default data;
}

declare interface ImportMetaEnv {
  readonly VITE_WS_URL?: string;
}

declare interface ImportMeta {
  readonly env: ImportMetaEnv;
}
