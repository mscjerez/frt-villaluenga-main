const BASE = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '')

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
    // Double-submit CSRF token: backend sets a readable XSRF-TOKEN cookie and checks this header.
    const csrf = readCookie('XSRF-TOKEN')
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
    res = await fetch(`${BASE}${path}`, init)
  } catch {
    throw new ApiError(0, 'network', 'No hay conexión con el servidor. Comprueba tu conexión e inténtalo de nuevo.')
  }

  if (res.status === 204) return undefined as T
  const data = await res.json().catch(() => null)
  if (!res.ok) {
    if (res.status === 401 && path.startsWith('/api/admin') && !path.startsWith('/api/admin/auth/')) {
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
  patch: <T>(path: string, body?: Body) => request<T>('PATCH', path, body),
  del: <T>(path: string) => request<T>('DELETE', path),
}
