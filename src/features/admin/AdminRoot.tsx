import { useEffect } from 'react'
import { Outlet } from 'react-router'
import { AuthProvider } from './auth'

export function AdminRoot() {
  useEffect(() => {
    const meta = document.createElement('meta')
    meta.name = 'robots'
    meta.content = 'noindex, nofollow'
    document.head.appendChild(meta)
    const prev = document.title
    document.title = 'Gestión · Rincón Cura Carlos'
    return () => {
      meta.remove()
      document.title = prev
    }
  }, [])
  return (
    <AuthProvider>
      <Outlet />
    </AuthProvider>
  )
}
