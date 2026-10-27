import { useState } from 'react'
import { Link, Outlet, ScrollRestoration } from 'react-router'
import { Menu, X } from 'lucide-react'
import { site } from '@/config/site'
import { cn } from '@/lib/cn'

const nav = [
  { href: '/#precios', label: 'Precios' },
  { href: '/#reservar', label: 'Disponibilidad' },
  { href: '/#la-casa', label: 'La casa' },
  { href: '/#documentos', label: 'Documentos' },
  { href: '/#preguntas', label: 'Preguntas' },
]

export function PublicLayout() {
  const [open, setOpen] = useState(false)

  return (
    <div className="flex min-h-dvh flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-paper focus:px-3 focus:py-2">
        Saltar al contenido
      </a>
      <header className="sticky top-0 z-30 border-b border-piedra-200/80 bg-cal/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-6 px-4 sm:px-6">
          <Link to="/" className="font-display text-lg font-bold tracking-tight text-encina-700">
            {site.name}
          </Link>
          <nav aria-label="Principal" className="hidden items-center gap-1 md:flex">
            {nav.map((n) => (
              <a key={n.href} href={n.href} className="rounded-md px-3 py-2 text-sm text-ink-soft hover:bg-piedra-100 hover:text-ink">
                {n.label}
              </a>
            ))}
            <a href="/#reservar" className="ml-2 inline-flex h-9 items-center rounded-lg bg-encina-600 px-4 text-sm font-medium text-white hover:bg-encina-700">
              Solicitar reserva
            </a>
          </nav>
          <button className="-mr-2 rounded-md p-2 md:hidden" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-controls="mobile-nav" aria-label="Menú">
            {open ? <X className="size-6" /> : <Menu className="size-6" />}
          </button>
        </div>
        <nav id="mobile-nav" aria-label="Principal" className={cn('border-t border-piedra-200 bg-cal px-4 pb-4 md:hidden', !open && 'hidden')}>
          {nav.map((n) => (
            <a key={n.href} href={n.href} onClick={() => setOpen(false)} className="block rounded-md px-2 py-3 text-base text-ink">
              {n.label}
            </a>
          ))}
          <a href="/#reservar" onClick={() => setOpen(false)} className="mt-2 flex h-11 items-center justify-center rounded-lg bg-encina-600 font-medium text-white">
            Solicitar reserva
          </a>
        </nav>
      </header>

      <main id="main" className="flex-1">
        <Outlet />
      </main>

      <footer className="bg-encina-700 text-encina-100">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:px-6 md:grid-cols-3">
          <div>
            <p className="font-display text-xl font-bold text-white">{site.name}</p>
            <p className="mt-2 text-sm leading-relaxed">
              {site.place}, {site.province}
              <br />
              {site.area}
            </p>
          </div>
          <div className="text-sm leading-relaxed">
            <p className="font-medium text-white">Contacto</p>
            <a className="mt-2 block hover:text-white" href={`mailto:${site.contactEmail}`}>
              {site.contactEmail}
            </a>
            <a className="block hover:text-white" href={`tel:${site.contactPhone.replace(/\s/g, '')}`}>
              {site.contactPhone}
            </a>
          </div>
          <div className="text-sm leading-relaxed">
            <p className="font-medium text-white">Legal</p>
            <Link className="mt-2 block hover:text-white" to="/privacidad">
              Política de privacidad
            </Link>
            <a className="block hover:text-white" href="/docs/normas-de-la-casa.pdf" download>
              Normas de la casa
            </a>
          </div>
        </div>
      </footer>
      <ScrollRestoration />
    </div>
  )
}
