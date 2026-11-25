import { useState, type FormEvent } from 'react'
import { Check, Megaphone } from 'lucide-react'
import { ApiError } from '@/api/client'
import { BANNER_MESSAGE_MAX, BANNER_TITLE_MAX, isBannerActive, type BannerTone, type SiteBanner, type SiteBannerInput } from '@/domain/settings'
import type { DateBlock } from '@/domain/booking'
import { buildInfo } from '@/config/build'
import { fmtDate, fmtDateTime, fmtRange, toISODate } from '@/lib/format'
import { cn } from '@/lib/cn'
import { Alert, Badge, Button, Field, Input, Panel, Spinner, Switch, Textarea } from '@/components/ui'
import { SiteBannerView } from '@/features/public/SiteBanner'
import { PageHeader } from './AdminLayout'
import { AdminsPanel } from './AdminsPanel'
import { useAdminBanner, useBlocks, useSaveBanner, useSystem } from './queries'

export function SettingsPage() {
  const banner = useAdminBanner()
  return (
    <>
      <PageHeader title="Ajustes" description="Aviso de la página principal, administradores y versiones instaladas." />
      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        {banner.isLoading ? (
          <Spinner />
        ) : banner.isError ? (
          <Alert>No se ha podido cargar el aviso.</Alert>
        ) : (
          <BannerForm saved={banner.data!} />
        )}
        <Versions />
      </div>
      <div className="mt-6">
        <AdminsPanel />
      </div>
    </>
  )
}

const toInput = ({ enabled, tone, title, message, startsOn, endsOn }: SiteBanner): SiteBannerInput => ({ enabled, tone, title, message, startsOn, endsOn })

function BannerForm({ saved }: { saved: SiteBanner }) {
  const save = useSaveBanner()
  const [form, setForm] = useState<SiteBannerInput>(() => toInput(saved))
  const [done, setDone] = useState(false)
  const set = <K extends keyof SiteBannerInput>(k: K, v: SiteBannerInput[K]) => {
    setDone(false)
    setForm((f) => ({ ...f, [k]: v }))
  }
  const fieldErrors = save.error instanceof ApiError ? save.error.fieldErrors : {}
  const dirty = JSON.stringify(form) !== JSON.stringify(toInput(saved))
  const today = toISODate(new Date())

  const submit = (e: FormEvent) => {
    e.preventDefault()
    save.mutate(
      { ...form, title: form.title.trim(), message: form.message.trim() },
      {
        onSuccess: (b) => {
          // Back in step with what the server stored (trimmed text).
          setForm(toInput(b))
          setDone(true)
        },
      },
    )
  }

  return (
    <form onSubmit={submit} className="min-w-0 space-y-6">
      <Panel
        title={
          <span className="flex items-center gap-2">
            <Megaphone className="size-4.5 text-ink-soft" aria-hidden />
            Aviso en la página principal
          </span>
        }
        action={<BannerState banner={toInput(saved)} today={today} />}
      >
        <div className="space-y-5 p-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium">Mostrar el aviso</p>
              <p className="text-xs text-ink-soft">Aparece arriba del todo en la página principal, para cierres, novedades o cambios de horario.</p>
            </div>
            <Switch label="Mostrar el aviso" checked={form.enabled} onChange={(v) => set('enabled', v)} />
          </div>

          <fieldset>
            <legend className="mb-1.5 text-sm font-medium">Tipo</legend>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  ['info', 'Informativo'],
                  ['warning', 'Importante'],
                ] as [BannerTone, string][]
              ).map(([tone, label]) => (
                <label
                  key={tone}
                  className={cn(
                    'flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm ring-1 ring-inset',
                    form.tone === tone ? 'bg-encina-50 font-medium text-encina-700 ring-encina-600/40' : 'ring-piedra-200 hover:bg-piedra-100',
                  )}
                >
                  <input type="radio" name="tone" value={tone} checked={form.tone === tone} onChange={() => set('tone', tone)} className="accent-encina-600" />
                  {label}
                </label>
              ))}
            </div>
          </fieldset>

          <Field label="Título" optional error={fieldErrors.title} hint="Va en negrita delante del texto.">
            {(p) => <Input value={form.title} maxLength={BANNER_TITLE_MAX} onChange={(e) => set('title', e.target.value)} placeholder="Casa cerrada" {...p} />}
          </Field>
          <Field label="Texto" error={fieldErrors.message} hint={`${form.message.length}/${BANNER_MESSAGE_MAX}. Solo texto, sin enlaces.`}>
            {(p) => (
              <Textarea
                rows={3}
                value={form.message}
                maxLength={BANNER_MESSAGE_MAX}
                onChange={(e) => set('message', e.target.value)}
                placeholder="Del 3 al 6 de noviembre la casa estará cerrada por mantenimiento."
                {...p}
              />
            )}
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Mostrar desde" optional error={fieldErrors.startsOn}>
              {(p) => <Input type="date" value={form.startsOn ?? ''} onChange={(e) => set('startsOn', e.target.value || null)} {...p} />}
            </Field>
            <Field label="Hasta (incluido)" optional error={fieldErrors.endsOn} hint="Sin fechas, se ve mientras esté activado.">
              {(p) => <Input type="date" value={form.endsOn ?? ''} min={form.startsOn ?? undefined} onChange={(e) => set('endsOn', e.target.value || null)} {...p} />}
            </Field>
          </div>

          <div>
            <p className="mb-1.5 text-sm font-medium">Vista previa</p>
            {form.message.trim() ? (
              <div className="overflow-hidden rounded-lg ring-1 ring-piedra-200">
                <SiteBannerView banner={form} className="border-b-0" />
              </div>
            ) : (
              <p className="rounded-lg border border-dashed border-piedra-300 px-4 py-3 text-sm text-ink-soft">Escribe el texto para ver cómo queda.</p>
            )}
          </div>

          {save.isError && <Alert>{save.error instanceof ApiError ? save.error.message : 'No se ha podido guardar.'}</Alert>}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-piedra-200 pt-4">
            <p className="text-xs text-ink-soft">{saved.updatedAt ? `Última modificación: ${saved.updatedBy}, ${fmtDateTime(saved.updatedAt)}` : 'Nunca se ha publicado un aviso.'}</p>
            <div className="flex items-center gap-3">
              {done && !dirty && (
                <span className="flex items-center gap-1 text-sm text-free" role="status">
                  <Check className="size-4" aria-hidden />
                  Guardado
                </span>
              )}
              <Button type="submit" loading={save.isPending} disabled={!dirty}>
                Guardar aviso
              </Button>
            </div>
          </div>
        </div>
      </Panel>

      <ClosureShortcuts
        onPick={(k) => {
          setDone(false)
          setForm({
            enabled: true,
            tone: 'warning',
            title: 'Casa cerrada',
            message: `${k.start === k.end ? `El ${fmtDate(k.start, "d 'de' MMMM")}` : `Del ${fmtDate(k.start, "d 'de' MMMM")} al ${fmtDate(k.end, "d 'de' MMMM")}`} la casa estará cerrada y no se puede reservar.`,
            startsOn: today,
            endsOn: k.end,
          })
          window.scrollTo({ top: 0, behavior: 'smooth' })
        }}
      />
    </form>
  )
}

function BannerState({ banner, today }: { banner: SiteBannerInput; today: string }) {
  if (isBannerActive(banner, today)) return <Badge tone="green">Visible en la web</Badge>
  if (banner.enabled && banner.message && banner.startsOn && banner.startsOn > today) return <Badge tone="blue">Desde el {fmtDate(banner.startsOn, 'd MMM')}</Badge>
  if (banner.enabled && banner.message && banner.endsOn && banner.endsOn < today) return <Badge tone="stone">Caducado</Badge>
  return <Badge tone="stone">Oculto</Badge>
}

/** Fills the banner from an upcoming closure, so announcing it takes one click. The closure's reason stays internal. */
function ClosureShortcuts({ onPick }: { onPick: (k: DateBlock) => void }) {
  const blocks = useBlocks()
  const today = toISODate(new Date())
  const upcoming = (blocks.data ?? []).filter((k) => k.end >= today)
  if (upcoming.length === 0) return null
  return (
    <Panel title="Anunciar un cierre">
      <ul className="divide-y divide-piedra-200">
        {upcoming.map((k) => (
          <li key={k.id} className="flex items-center gap-4 px-5 py-3 text-sm">
            <div className="min-w-0 flex-1">
              <p className="font-medium">{fmtRange(k.start, k.end)}</p>
              <p className="truncate text-ink-soft">{k.reason}</p>
            </div>
            <Button type="button" variant="secondary" size="sm" onClick={() => onPick(k)}>
              Usar en el aviso
            </Button>
          </li>
        ))}
      </ul>
      <p className="border-t border-piedra-200 px-5 py-3 text-xs text-ink-soft">Rellena el aviso con las fechas (sin el motivo, que es interno). Revísalo y pulsa «Guardar aviso».</p>
    </Panel>
  )
}

function Versions() {
  const system = useSystem()
  const api = system.data?.api
  return (
    <Panel title="Versiones" className="self-start">
      <dl className="divide-y divide-piedra-200 text-sm">
        <Version
          name="Web"
          version={buildInfo.version}
          commit={buildInfo.commit}
          detail={`Compilada el ${fmtDateTime(buildInfo.builtAt)}`}
        />
        {system.isError ? (
          <div className="px-5 py-3">
            <dt className="font-medium">API</dt>
            <dd className="text-busy">No disponible</dd>
          </div>
        ) : !api ? (
          <div className="px-5 py-3 text-ink-soft">Cargando…</div>
        ) : (
          <Version name="API" version={api.version} commit={api.commit} detail={`En marcha desde el ${fmtDateTime(api.startedAt)} · Node ${api.node.replace(/^v/, '')}`} />
        )}
      </dl>
    </Panel>
  )
}

function Version({ name, version, commit, detail }: { name: string; version: string; commit: string; detail: string }) {
  return (
    <div className="px-5 py-3">
      <div className="flex items-baseline justify-between gap-3">
        <dt className="font-medium">{name}</dt>
        <dd className="tabular font-semibold">v{version}</dd>
      </div>
      <dd className="mt-0.5 text-xs text-ink-soft">
        {commit ? <span className="font-mono">{commit}</span> : 'Commit desconocido'} · {detail}
      </dd>
    </div>
  )
}
