import { createContext, useCallback, useContext, useEffect, useMemo, type ReactNode } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { adminApi, type AdminUser } from '@/api/admin'
import { AUTH_EXPIRED_EVENT } from '@/api/client'

const IDLE_LIMIT_MS = 20 * 60_000

interface AuthState {
  user: AdminUser | null
  loading: boolean
  signedIn: (user: AdminUser) => void
  logout: (reason?: 'idle' | 'expired') => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient()
  const session = useQuery({
    queryKey: ['admin', 'session'],
    queryFn: () => adminApi.session().then((r) => r.user).catch(() => null),
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: true,
  })
  const user = session.data ?? null

  const signedIn = useCallback((u: AdminUser) => qc.setQueryData(['admin', 'session'], u), [qc])

  const logout = useCallback(
    async (reason?: 'idle' | 'expired') => {
      if (reason !== 'expired') await adminApi.logout().catch(() => {})
      // Drop every cached admin response so nothing sensitive stays in memory.
      qc.removeQueries({ queryKey: ['admin'] })
      qc.setQueryData(['admin', 'session'], null)
      if (reason) sessionStorage.setItem('rcc-logout-reason', reason)
    },
    [qc],
  )

  useEffect(() => {
    const onExpired = () => logout('expired')
    window.addEventListener(AUTH_EXPIRED_EVENT, onExpired)
    return () => window.removeEventListener(AUTH_EXPIRED_EVENT, onExpired)
  }, [logout])

  // Sign out after a period without activity.
  useEffect(() => {
    if (!user) return
    let timer = window.setTimeout(() => logout('idle'), IDLE_LIMIT_MS)
    const bump = () => {
      window.clearTimeout(timer)
      timer = window.setTimeout(() => logout('idle'), IDLE_LIMIT_MS)
    }
    const events = ['pointerdown', 'keydown', 'scroll', 'visibilitychange'] as const
    events.forEach((e) => window.addEventListener(e, bump, { passive: true }))
    return () => {
      window.clearTimeout(timer)
      events.forEach((e) => window.removeEventListener(e, bump))
    }
  }, [user, logout])

  const value = useMemo(() => ({ user, loading: session.isLoading, signedIn, logout }), [user, session.isLoading, signedIn, logout])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth outside AuthProvider')
  return ctx
}
