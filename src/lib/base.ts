/** Prefixes a root-relative path with the deploy base (e.g. `/frt-villaluenga-main/` on GitHub Pages). */
export const withBase = (path: string) => import.meta.env.BASE_URL + path.replace(/^\//, '')

/** Absolute tracking link for a booking, the same one the backend emails to the group. */
export const trackingUrl = (token: string) => new URL(withBase(`/reservas/${token}`), window.location.origin).href
