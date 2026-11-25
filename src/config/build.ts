declare const __BUILD_INFO__: { version: string; commit: string; builtAt: string }

/** Injected by vite.config.ts at build time. */
export const buildInfo = __BUILD_INFO__
