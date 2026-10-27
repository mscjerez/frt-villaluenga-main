/** Prefixes a root-relative path with the deploy base (e.g. `/frt-villaluenga-main/` on GitHub Pages). */
export const withBase = (path: string) => import.meta.env.BASE_URL + path.replace(/^\//, '')
