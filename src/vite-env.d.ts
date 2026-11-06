/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly BASE_URL: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

// Injected at build time by vite.config.ts
declare const __BUILD_ID__: string
declare const __BUILD_COMMIT__: string
declare const __BUILD_TIME__: string
