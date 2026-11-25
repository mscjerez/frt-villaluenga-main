import { useState } from 'react'
import { Link, Outlet, ScrollRestoration } from 'react-router'
import { MapPin, Menu, X } from 'lucide-react'
import { site } from '@/config/site'
import { cn } from '@/lib/cn'
import { withBase } from '@/lib/base'

const nav = [
  { href: withBase('/#precios'), label: 'Precios' },
  { href: withBase('/#reservar'), label: 'Disponibilidad' },
  { href: withBase('/#la-casa'), label: 'La casa' },
  { href: withBase('/#documentos'), label: 'Documentos' },
  { href: withBase('/#preguntas'), label: 'Preguntas' },
]

export function PublicLayout() {
  const [open, setOpen] = useState(false)

  return (
    <div className="flex min-h-dvh flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-paper focus:px-3 focus:py-2">
        Saltar al contenido
      </a>
      <header className="sticky top-0 z-30 border-b border-piedra-200/80 bg-cal/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-6 px-4 sm:px-6 lg:gap-4 xl:gap-6">
          <Link to="/" className="flex shrink-0 items-center gap-2.5 whitespace-nowrap font-display text-lg font-bold tracking-tight text-encina-700 lg:text-base xl:text-lg">
            <img src={withBase('/logo.svg')} alt="Scouts Católicos Asidonia-Jerez" width={44} height={44} className="size-11" />
            {site.name}
          </Link>
          <nav aria-label="Principal" className="hidden items-center gap-1 whitespace-nowrap lg:flex">
            {nav.map((n) => (
              <a key={n.href} href={n.href} className="rounded-md px-3 py-2 text-sm text-ink-soft hover:bg-piedra-100 hover:text-ink lg:px-2 xl:px-3">
                {n.label}
              </a>
            ))}
            <Link to="/mi-reserva" className="ml-2 inline-flex h-9 items-center rounded-lg px-3 text-sm font-medium text-encina-700 ring-1 ring-inset ring-encina-600/40 hover:bg-encina-50">
              Mi reserva
            </Link>
            <a href={withBase('/#reservar')} className="ml-1 inline-flex h-9 items-center rounded-lg bg-encina-600 px-4 text-sm font-medium text-white hover:bg-encina-700">
              Solicitar reserva
            </a>
          </nav>
          <button className="-mr-2 rounded-md p-2 lg:hidden" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-controls="mobile-nav" aria-label="Menú">
            {open ? <X className="size-6" /> : <Menu className="size-6" />}
          </button>
        </div>
        <nav id="mobile-nav" aria-label="Principal" className={cn('border-t border-piedra-200 bg-cal px-4 pb-4 lg:hidden', !open && 'hidden')}>
          {nav.map((n) => (
            <a key={n.href} href={n.href} onClick={() => setOpen(false)} className="block rounded-md px-2 py-3 text-base text-ink">
              {n.label}
            </a>
          ))}
          <Link to="/mi-reserva" onClick={() => setOpen(false)} className="block rounded-md px-2 py-3 text-base font-medium text-encina-700">
            Mi reserva
          </Link>
          <a href={withBase('/#reservar')} onClick={() => setOpen(false)} className="mt-2 flex h-11 items-center justify-center rounded-lg bg-encina-600 font-medium text-white">
            Solicitar reserva
          </a>
        </nav>
      </header>

      <main id="main" className="flex-1">
        <Outlet />
      </main>

      <footer className="bg-encina-700 text-encina-100">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:px-6 md:grid-cols-3">
          <div className="flex items-start gap-4">
            <a href={site.ownerWeb} target="_blank" rel="noopener noreferrer" className="shrink-0 rounded-xl bg-white p-2" aria-label="Web de Scouts Católicos Asidonia-Jerez">
              <img src={withBase('/logo.svg')} alt="Scouts Católicos Asidonia-Jerez" width={64} height={64} className="size-16" />
            </a>
            <div>
              <p className="font-display text-xl font-bold text-white">{site.name}</p>
              <p className="mt-2 text-sm leading-relaxed">
                {site.place}, {site.province}
                <br />
                {site.area}
              </p>
              <p className="mt-3 text-xs leading-relaxed">Una casa de la {site.owner}.</p>
            </div>
          </div>
          <div className="text-sm leading-relaxed">
            <p className="font-medium text-white">Contacto</p>
            <a className="mt-2 block hover:text-white" href={`mailto:${site.contactEmail}`}>
              {site.contactEmail}
            </a>
            <a className="block hover:text-white" href={`tel:${site.contactPhone.replace(/\s/g, '')}`}>
              {site.contactPhone}
            </a>
            <Link className="mt-2 block hover:text-white" to="/mi-reserva">
              Consultar mi reserva
            </Link>
            <a className="mt-2 inline-flex items-center gap-1.5 hover:text-white" href={site.mapsUrl} target="_blank" rel="noopener noreferrer">
              <MapPin className="size-4" aria-hidden />
              Cómo llegar (Google Maps)
            </a>
          </div>
          <div className="text-sm leading-relaxed">
            <p className="font-medium text-white">Legal</p>
            <Link className="mt-2 block hover:text-white" to="/privacidad">
              Política de privacidad
            </Link>
            <a className="block hover:text-white" href={withBase('/docs/normas-de-la-casa.pdf')} download>
              Normas de la casa
            </a>
          </div>
        </div>
      </footer>
      <ScrollRestoration />
    </div>
  )
}
