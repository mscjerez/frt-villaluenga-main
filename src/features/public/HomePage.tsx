import { useState } from 'react'
import { ChevronDown, Download, FileText, ImageOff, Users, CalendarDays, Mountain } from 'lucide-react'
import { documents, faq, photos, prices, site } from '@/config/site'
import { money } from '@/lib/format'
import { cn } from '@/lib/cn'
import { Dialog } from '@/components/ui'
import { BookingSection } from './BookingSection'

export function HomePage() {
  return (
    <>
      <Hero />
      <Pricing />
      <BookingSection />
      <Gallery />
      <Documents />
      <Faq />
    </>
  )
}

// ---------- Hero ----------

function Hero() {
  return (
    <section className="relative overflow-hidden bg-cal">
      <div className="mx-auto grid max-w-6xl items-end gap-10 px-4 pb-14 pt-10 sm:px-6 md:grid-cols-[1.1fr_1fr] md:pb-20 md:pt-16">
        <div>
          <p className="flex items-center gap-2 text-sm font-medium text-encina-600">
            <Mountain className="size-4" aria-hidden />
            {site.place}, {site.province}
          </p>
          <h1 className="mt-4 text-[clamp(2.9rem,8vw,5.6rem)] font-extrabold leading-[0.92] tracking-[-0.035em] text-encina-700">
            Rincón
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
        <div className="grid grid-cols-5 grid-rows-[11rem_8rem] gap-3 sm:grid-rows-[15rem_10rem]">
          <Photo photo={photos[0]} className="col-span-5 sm:col-span-5" eager />
          <Photo photo={photos[1]} className="col-span-3" eager />
          <Photo photo={photos[5]} className="col-span-2" eager />
        </div>
      </div>
      {/* Ochre plinth, as painted at the foot of the whitewashed houses of the village */}
      <div aria-hidden className="h-3 bg-albero-500" />
    </section>
  )
}

// ---------- Photo with graceful fallback ----------

type PhotoData = (typeof photos)[number]

function Photo({ photo, className, eager, onClick }: { photo: PhotoData; className?: string; eager?: boolean; onClick?: () => void }) {
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
          className={cn('h-full w-full object-cover', onClick && 'transition-transform duration-500 group-hover:scale-[1.03]')}
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

function Gallery() {
  const [active, setActive] = useState<number | null>(null)
  const current = active !== null ? photos[active] : null
  return (
    <section id="la-casa" className="bg-paper py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <h2 className="text-4xl font-bold tracking-tight">La casa</h2>
        <p className="mt-4 max-w-[60ch] leading-relaxed text-ink-soft">
          Dormitorios con literas, salón comedor para todo el grupo, cocina equipada y patio. A dos pasos de los senderos de la sierra y de la
          plaza del pueblo.
        </p>
        <div className="mt-10 grid auto-rows-[10rem] grid-cols-2 gap-3 sm:auto-rows-[13rem] md:grid-cols-4">
          {photos.map((p, i) => (
            <Photo key={p.src} photo={p} onClick={() => setActive(i)} className={cn(i === 0 && 'col-span-2 row-span-2', i === 3 && 'md:col-span-2')} />
          ))}
        </div>
      </div>
      <Dialog open={current !== null} onClose={() => setActive(null)} title={current?.caption ?? ''} className="w-[min(64rem,calc(100vw-2rem))]">
        {current && (
          <div className="aspect-[3/2] w-full">
            <Photo photo={current} className="h-full w-full" eager />
          </div>
        )}
      </Dialog>
    </section>
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
