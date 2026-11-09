/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Absolute API base used by static deployments, e.g. https://api.example.com/api/v1 */
  readonly VITE_API_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
