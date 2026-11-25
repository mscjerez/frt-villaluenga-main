/**
 * API root. Production goes through the gateway at https://api.mscjerez.es/v1/rcc (set VITE_API_URL at build time).
 * The default relative /api/v1 is for localhost: the mocks or the Vite dev proxy answer it.
 */
export const API_BASE = (import.meta.env.VITE_API_URL || '/api/v1').replace(/\/$/, '')

export class ApiError extends Error {
  status: number
  code: string
  fieldErrors: Record<string, string>
  retryAfter: number | null

  constructor(status: number, code: string, message: string, fieldErrors: Record<string, string> = {}, retryAfter: number | null = null) {
    super(message)
    this.status = status
    this.code = code
    this.fieldErrors = fieldErrors
    this.retryAfter = retryAfter
  }
}

/** Fired when an admin request comes back 401 so the UI can drop the session. */
export const AUTH_EXPIRED_EVENT = 'admin:auth-expired'

// The API lives on another host (api.mscjerez.es), so its XSRF-TOKEN cookie can't be read from this page.
// The backend also sends the token in an X-XSRF-TOKEN response header; keep the latest one in memory.
let csrfToken: string | null = null

function readCookie(name: string): string | null {
  const match = document.cookie.split('; ').find((c) => c.startsWith(`${name}=`))
  return match ? decodeURIComponent(match.slice(name.length + 1)) : null
}

type Body = Record<string, unknown> | FormData | undefined

export async function request<T>(method: string, path: string, body?: Body, headers: Record<string, string> = {}): Promise<T> {
  const init: RequestInit = {
    method,
    // Session lives in an HttpOnly, Secure, SameSite=Strict cookie set by the backend. No tokens in JS storage.
    credentials: 'include',
    headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest', ...headers },
  }
  const h = init.headers as Record<string, string>
  if (method !== 'GET') {
    // Double-submit CSRF token: the backend checks this header against its XSRF-TOKEN cookie.
    const csrf = csrfToken ?? readCookie('XSRF-TOKEN')
    if (csrf) h['X-XSRF-TOKEN'] = csrf
  }
  if (body instanceof FormData) {
    init.body = body
  } else if (body !== undefined) {
    h['Content-Type'] = 'application/json'
    init.body = JSON.stringify(body)
  }

  let res: Response
  try {
    res = await fetch(`${API_BASE}${path}`, init)
  } catch {
    throw new ApiError(0, 'network', 'No hay conexión con el servidor. Comprueba tu conexión e inténtalo de nuevo.')
  }

  const issued = res.headers.get('X-XSRF-TOKEN')
  if (issued) csrfToken = issued

  if (res.status === 204) return undefined as T
  const data = await res.json().catch(() => null)
  if (!res.ok) {
    if (res.status === 401 && path.startsWith('/admin/') && !path.startsWith('/admin/auth/')) {
      window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT))
    }
    const retry = res.headers.get('Retry-After')
    throw new ApiError(
      res.status,
      data?.code ?? 'error',
      data?.message ?? 'Algo ha fallado en el servidor. Inténtalo de nuevo en unos minutos.',
      data?.fieldErrors ?? {},
      retry ? Number(retry) : null,
    )
  }
  return data as T
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: Body, headers?: Record<string, string>) => request<T>('POST', path, body, headers),
  put: <T>(path: string, body?: Body) => request<T>('PUT', path, body),
  patch: <T>(path: string, body?: Body) => request<T>('PATCH', path, body),
  del: <T>(path: string) => request<T>('DELETE', path),
}
