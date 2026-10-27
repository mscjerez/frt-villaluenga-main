import { useState } from 'react'
import { Navigate, NavLink, Outlet, useLocation } from 'react-router'
import { LayoutDashboard, CalendarRange, ListChecks, Wallet, LogOut, Menu, X, ExternalLink } from 'lucide-react'
import { site } from '@/config/site'
import { cn } from '@/lib/cn'
import { Spinner } from '@/components/ui'
import { useAuth } from './auth'
import { useBookings } from './queries'

const nav = [
  { to: '/admin', label: 'Panel', icon: LayoutDashboard, end: true },
  { to: '/admin/reservas', label: 'Reservas', icon: ListChecks },
  { to: '/admin/calendario', label: 'Calendario', icon: CalendarRange },
  { to: '/admin/finanzas', label: 'Finanzas', icon: Wallet },
]

export function AdminLayout() {
  const { user, loading, logout } = useAuth()
  const location = useLocation()
  const [open, setOpen] = useState(false)

  if (loading) return <Spinner />
  if (!user) return <Navigate to="/admin/login" replace state={{ from: location.pathname }} />

  return (
    <div className="min-h-dvh bg-cal lg:grid lg:grid-cols-[15rem_1fr]">
      <aside className={cn('fixed inset-y-0 left-0 z-40 flex w-60 flex-col border-r border-piedra-200 bg-paper transition-transform lg:sticky lg:top-0 lg:h-dvh lg:translate-x-0', open ? 'translate-x-0' : '-translate-x-full')}>
        <div className="flex h-16 items-center justify-between px-5">
          <span className="font-display text-base font-bold leading-tight text-encina-700">{site.name}</span>
          <button className="rounded p-1 lg:hidden" onClick={() => setOpen(false)} aria-label="Cerrar menú">
            <X className="size-5" />
          </button>
        </div>
        <nav aria-label="Gestión" className="flex-1 space-y-1 px-3">
          {nav.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                cn('flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium', isActive ? 'bg-encina-50 text-encina-700' : 'text-ink-soft hover:bg-piedra-100 hover:text-ink')
              }
            >
              <n.icon className="size-4.5" aria-hidden />
              {n.label}
              {n.label === 'Reservas' && <PendingCount />}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-piedra-200 p-3 text-sm">
          <a href="/" target="_blank" rel="noopener" className="flex items-center gap-3 rounded-lg px-3 py-2 text-ink-soft hover:bg-piedra-100 hover:text-ink">
            <ExternalLink className="size-4" aria-hidden />
            Ver web pública
          </a>
          <div className="mt-2 px-3">
            <p className="truncate font-medium">{user.name}</p>
            <p className="truncate text-xs text-ink-soft">{user.email}</p>
          </div>
          <button onClick={() => logout()} className="mt-2 flex w-full items-center gap-3 rounded-lg px-3 py-2 text-ink-soft hover:bg-piedra-100 hover:text-ink">
            <LogOut className="size-4" aria-hidden />
            Cerrar sesión
          </button>
        </div>
      </aside>
      {open && <div className="fixed inset-0 z-30 bg-ink/30 lg:hidden" onClick={() => setOpen(false)} aria-hidden />}

      <div className="min-w-0">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-piedra-200 bg-paper px-4 lg:hidden">
          <button className="-ml-1 rounded p-1" onClick={() => setOpen(true)} aria-label="Abrir menú">
            <Menu className="size-6" />
          </button>
          <span className="font-display font-bold text-encina-700">{site.name}</span>
        </header>
        <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

function PendingCount() {
  const { data } = useBookings()
  const n = data?.filter((b) => b.status === 'pending').length ?? 0
  if (!n) return null
  return (
    <span className="ml-auto rounded-full bg-albero-500 px-2 py-0.5 text-xs font-semibold text-ink" aria-label={`${n} pendientes`}>
      {n}
    </span>
  )
}

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
        {description && <p className="mt-1 text-sm text-ink-soft">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  )
}
