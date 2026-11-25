import { useEffect, useState } from 'react'
import { ChevronDown, ChevronLeft, ChevronRight, Download, FileText, ImageOff, Images, Users, CalendarDays, MapPin } from 'lucide-react'
import { documents, faq, heroPhotos, photos, prices, site, type Photo as PhotoData } from '@/config/site'
import { money } from '@/lib/format'
import { cn } from '@/lib/cn'
import { Dialog } from '@/components/ui'
import { BookingSection } from './BookingSection'
import { HomeBanner } from './SiteBanner'

export function HomePage() {
  // One lightbox for the whole page: hero photos and the gallery both open it.
  const [active, setActive] = useState<number | null>(null)
  const open = (photo: PhotoData) => setActive(photos.indexOf(photo))
  return (
    <>
      <HomeBanner />
      <Hero onOpen={open} />
      <Pricing />
      <BookingSection />
      <Gallery onOpen={open} />
      <Documents />
      <Faq />
      <Lightbox active={active} setActive={setActive} />
    </>
  )
}

// ---------- Hero ----------

function Hero({ onOpen }: { onOpen: (p: PhotoData) => void }) {
  return (
    <section className="relative overflow-hidden bg-cal">
      <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 pb-14 pt-10 sm:px-6 lg:grid-cols-[1fr_1.1fr] lg:gap-14 lg:pb-20 lg:pt-16">
        <div>
          <a
            href={site.mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sm font-medium text-encina-600 underline-offset-4 hover:underline"
          >
            <MapPin className="size-4" aria-hidden />
            {site.place}, {site.province}
            <span className="text-ink-soft">· Ver en el mapa</span>
          </a>
          <h1 className="mt-4 text-[clamp(2.9rem,8vw,5.6rem)] font-extrabold leading-[0.92] tracking-[-0.035em] text-encina-700">
            Rincón Scout
            <br />
            Cura Carlos
          </h1>
          <p className="mt-6 max-w-[34ch] text-lg leading-relaxed text-ink-soft">
            Casa para grupos scout, parroquias y asociaciones en el pueblo más alto de Cádiz, en plena Sierra de Grazalema.
          </p>
          <dl className="mt-8 flex flex-wrap gap-x-8 gap-y-3 text-sm">
            <div className="flex items-center gap-2">
              <Users className="size-4 text-albero-700" aria-hidden />
              <dt className="sr-only">Capacidad</dt>
              <dd>Hasta {site.maxGuests} personas</dd>
            </div>
            <div className="flex items-center gap-2">
              <CalendarDays className="size-4 text-albero-700" aria-hidden />
              <dt className="sr-only">Precio</dt>
              <dd>Desde {money(prices.dayVisit)} por persona y día</dd>
            </div>
          </dl>
          <div className="mt-9 flex flex-wrap gap-3">
            <a href="#reservar" className="inline-flex h-12 items-center rounded-lg bg-encina-600 px-6 font-medium text-white hover:bg-encina-700">
              Ver fechas libres
            </a>
            <a href="#documentos" className="inline-flex h-12 items-center rounded-lg px-5 font-medium text-encina-700 ring-1 ring-inset ring-encina-100 hover:bg-encina-50">
              Normas y documentos
            </a>
          </div>
        </div>

        {/* Every slot has a fixed 4:3 ratio, the shape of the source photos, so nothing is squashed or over-cropped. */}
        <div className="space-y-3">
          <Photo photo={heroPhotos.main} onClick={() => onOpen(heroPhotos.main)} className="aspect-[4/3] w-full rounded-2xl" eager />
          <div className="grid grid-cols-3 gap-3">
            <Photo photo={heroPhotos.top} onClick={() => onOpen(heroPhotos.top)} className="aspect-[4/3]" eager />
            <Photo photo={heroPhotos.bottom} onClick={() => onOpen(heroPhotos.bottom)} className="aspect-[4/3]" eager />
            <a
              href="#la-casa"
              className="flex aspect-[4/3] flex-col items-center justify-center gap-1 rounded-xl bg-encina-700 p-2 text-center text-sm font-medium text-white hover:bg-encina-600"
            >
              <Images className="size-5" aria-hidden />
              Ver las {photos.length} fotos
            </a>
          </div>
        </div>
      </div>
      {/* Ochre plinth, as painted at the foot of the whitewashed houses of the village */}
      <div aria-hidden className="h-3 bg-albero-500" />
    </section>
  )
}

// ---------- Photo with graceful fallback ----------

function Photo({ photo, className, eager, onClick, contain }: { photo: PhotoData; className?: string; eager?: boolean; onClick?: () => void; contain?: boolean }) {
  const [failed, setFailed] = useState(false)
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag
      onClick={onClick}
      className={cn('group relative overflow-hidden rounded-xl bg-piedra-200 text-left', onClick && 'cursor-zoom-in', className)}
      {...(onClick ? { 'aria-label': `Ampliar foto: ${photo.caption}` } : {})}
    >
      {failed ? (
        <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-[linear-gradient(160deg,var(--color-piedra-200),var(--color-piedra-300))] p-4 text-center text-piedra-500">
          <ImageOff className="size-6" aria-hidden />
          <span className="text-xs">{photo.caption}</span>
        </div>
      ) : (
        <img
          src={photo.src}
          alt={photo.alt}
          loading={eager ? 'eager' : 'lazy'}
          decoding="async"
          onError={() => setFailed(true)}
          style={contain ? undefined : { objectPosition: photo.position }}
          className={cn('h-full w-full', contain ? 'object-contain' : 'object-cover', onClick && 'transition-transform duration-500 group-hover:scale-[1.03]')}
        />
      )}
    </Tag>
  )
}

// ---------- Pricing ----------

function Pricing() {
  const rows = [
    { label: 'Día sin pernoctar', detail: 'Llegada y salida el mismo día', price: prices.dayVisit, unit: 'por persona' },
    { label: 'Una noche', detail: 'Cada noche que el grupo duerme en la casa', price: prices.night, unit: 'por persona y noche' },
    { label: 'Fin de semana', detail: 'De viernes a domingo, dos noches', price: prices.weekend, unit: 'por persona' },
  ]
  return (
    <section id="precios" className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
      <div className="grid gap-10 md:grid-cols-[1fr_1.4fr]">
        <div>
          <h2 className="text-4xl font-bold tracking-tight">Precios</h2>
          <p className="mt-4 max-w-[40ch] leading-relaxed text-ink-soft">
            Pagas por persona según el tiempo que estéis. Al importe se suma una fianza que te devolvemos después de la estancia.
          </p>
        </div>
        <div className="overflow-hidden rounded-2xl border border-piedra-200 bg-paper">
          <ul className="divide-y divide-piedra-200">
            {rows.map((r) => (
              <li key={r.label} className="flex items-center justify-between gap-4 px-5 py-4 sm:px-6">
                <div>
                  <p className="font-medium">{r.label}</p>
                  <p className="text-sm text-ink-soft">{r.detail}</p>
                </div>
                <p className="text-right">
                  <span className="font-display text-3xl font-bold tabular text-encina-700">{money(r.price)}</span>
                  <span className="block text-xs text-ink-soft">{r.unit}</span>
                </p>
              </li>
            ))}
          </ul>
          <div className="flex items-center justify-between gap-4 bg-albero-50 px-5 py-4 sm:px-6">
            <div>
              <p className="font-medium">Fianza</p>
              <p className="text-sm text-ink-soft">Una por reserva. Se devuelve tras revisar la casa.</p>
            </div>
            <p className="font-display text-3xl font-bold tabular text-albero-700">{money(prices.deposit)}</p>
          </div>
        </div>
      </div>
    </section>
  )
}

// ---------- Gallery ----------

function Gallery({ onOpen }: { onOpen: (p: PhotoData) => void }) {
  return (
    <section id="la-casa" className="bg-paper py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <h2 className="text-4xl font-bold tracking-tight">La casa</h2>
        <p className="mt-4 max-w-[60ch] leading-relaxed text-ink-soft">
          Comedor con chimenea para todo el grupo, cocina equipada, salas amplias en las plantas altas y una terraza sobre los tejados. A dos
          pasos de los senderos de la sierra y de la plaza del pueblo.
        </p>
        <div className="mt-10 grid grid-flow-row-dense auto-rows-[10rem] grid-cols-2 gap-3 sm:auto-rows-[13rem] md:grid-cols-4">
          {photos.map((p) => (
            <Photo
              key={p.src}
              photo={p}
              onClick={() => onOpen(p)}
              className={cn(p.span === 'big' && 'col-span-2 row-span-2', p.span === 'wide' && 'col-span-2')}
            />
          ))}
        </div>
      </div>
    </section>
  )
}

function Lightbox({ active, setActive }: { active: number | null; setActive: (fn: (i: number | null) => number | null) => void }) {
  const current = active !== null ? photos[active] : null
  const step = (d: number) => setActive((i) => (i === null ? i : (i + d + photos.length) % photos.length))
  const open = active !== null
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') step(1)
      if (e.key === 'ArrowLeft') step(-1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  return (
    <Dialog
      open={open}
      onClose={() => setActive(() => null)}
      title={current?.caption ?? ''}
      description={active !== null ? `${active + 1} de ${photos.length}` : undefined}
      className="w-[min(64rem,calc(100vw-2rem))]"
    >
      {current && (
        <div>
          <div className="h-[min(70vh,40rem)] w-full">
            <Photo photo={current} className="h-full w-full bg-ink" contain eager />
          </div>
          <div className="mt-4 flex items-center justify-between gap-4">
            <p className="text-sm text-ink-soft">{current.alt}</p>
            <div className="flex shrink-0 gap-2">
              <button onClick={() => step(-1)} className="rounded-lg p-2 ring-1 ring-inset ring-piedra-300 hover:bg-piedra-100" aria-label="Foto anterior">
                <ChevronLeft className="size-5" />
              </button>
              <button onClick={() => step(1)} className="rounded-lg p-2 ring-1 ring-inset ring-piedra-300 hover:bg-piedra-100" aria-label="Foto siguiente">
                <ChevronRight className="size-5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </Dialog>
  )
}

// ---------- Documents ----------

function Documents() {
  return (
    <section id="documentos" className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
      <h2 className="text-4xl font-bold tracking-tight">Documentos</h2>
      <p className="mt-4 max-w-[60ch] leading-relaxed text-ink-soft">Léelos antes de la estancia y compártelos con el resto de responsables del grupo.</p>
      <div className="mt-10 grid gap-4 md:grid-cols-2">
        {documents.map((d) => (
          <a
            key={d.id}
            href={d.href}
            download
            className="group flex items-start gap-4 rounded-2xl border border-piedra-200 bg-paper p-6 transition-colors hover:border-encina-500"
          >
            <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-encina-50 text-encina-600">
              <FileText className="size-6" aria-hidden />
            </span>
            <span className="flex-1">
              <span className="block text-lg font-semibold">{d.title}</span>
              <span className="mt-1 block text-sm leading-relaxed text-ink-soft">{d.description}</span>
              <span className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-encina-600 group-hover:underline">
                <Download className="size-4" aria-hidden />
                Descargar PDF
              </span>
            </span>
          </a>
        ))}
      </div>
    </section>
  )
}

// ---------- FAQ ----------

function Faq() {
  return (
    <section id="preguntas" className="bg-paper py-20">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 sm:px-6 md:grid-cols-[1fr_1.6fr]">
        <div>
          <h2 className="text-4xl font-bold tracking-tight">Preguntas frecuentes</h2>
          <p className="mt-4 leading-relaxed text-ink-soft">
            ¿No encuentras lo que buscas? Escríbenos a{' '}
            <a className="font-medium text-encina-600 underline-offset-2 hover:underline" href={`mailto:${site.contactEmail}`}>
              {site.contactEmail}
            </a>
            .
          </p>
        </div>
        <div className="divide-y divide-piedra-200 border-y border-piedra-200">
          {faq.map((f) => (
            <details key={f.q} className="group py-1">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 font-medium [&::-webkit-details-marker]:hidden">
                {f.q}
                <ChevronDown className="size-5 shrink-0 text-piedra-500 transition-transform group-open:rotate-180" aria-hidden />
              </summary>
              <p className="pb-5 pr-8 leading-relaxed text-ink-soft">{f.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  )
}
