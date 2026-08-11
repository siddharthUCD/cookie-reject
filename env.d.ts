/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_BANNER_REPORT_ENDPOINT?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
