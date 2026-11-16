/// <reference types="vite/client" />

interface ViteTypeOptions {
  strictImportMetaEnv: unknown;
}

interface ImportMetaEnv {
  readonly VITE_PUBLIC_MAPBOX_TOKEN: string;
  readonly VITE_NAVIGATOR_ENDPOINT?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
