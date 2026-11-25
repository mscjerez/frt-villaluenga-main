import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { ArrowLeft, Phone, Mail, FileText, CheckCircle2, Copy, Check, ExternalLink, Gift, Trash2, Download } from 'lucide-react'
import { statusMeta, transitions, transitionLabel, type Booking, type BookingStatus, type KeysStatus } from '@/domain/booking'
import { estimatePrice } from '@/lib/pricing'
import { trackingUrl } from '@/lib/base'
import { API_BASE } from '@/api/client'
import { prices, site } from '@/config/site'
import { fmtDate, fmtDateTime, fmtRange, money } from '@/lib/format'
import { cn } from '@/lib/cn'
import { Alert, Button, Input, Panel, Spinner, StatusBadge, Switch, Textarea } from '@/components/ui'
import { toneDot } from '@/components/ui/tones'
import { useAddComment, useBooking, useDeleteComment, useUpdateBooking } from './queries'
import { TransitionDialog } from './TransitionDialog'

export function BookingDetailPage() {
  const { id = '' } = useParams()
  const { data: b, isLoading, isError } = useBooking(id)
  const [to, setTo] = useState<BookingStatus | null>(null)

  if (isLoading) return <Spinner />
  if (isError || !b)
    return (
      <div className="py-16 text-center">
        <p className="text-lg font-medium">Reserva no encontrada</p>
        <Link to="/admin/reservas" className="mt-3 inline-block text-encina-600 underline">
          Volver a reservas
        </Link>
      </div>
    )

  const next = transitions[b.status]
  return (
    <>
      <Link to="/admin/reservas" className="inline-flex items-center gap-1.5 text-sm text-ink-soft hover:text-ink">
        <ArrowLeft className="size-4" aria-hidden />
        Reservas
      </Link>

      <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm text-ink-soft tabular">{b.reference}</p>
          <h1 className="text-3xl font-bold tracking-tight">{b.organization}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <StatusBadge status={b.status} />
            {b.free && (
              <span className="inline-flex items-center gap-1 rounded-full bg-encina-50 px-2.5 py-0.5 text-xs font-medium text-encina-700 ring-1 ring-inset ring-encina-600/20">
                <Gift className="size-3.5" aria-hidden />
                Gratuita
              </span>
            )}
            <span className="text-sm text-ink-soft">{statusMeta[b.status].description}</span>
          </div>
        </div>
        {next.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {next.map((s, i) => (
              <Button key={s} variant={s === 'cancelled' ? 'secondary' : i === 0 ? 'primary' : 'secondary'} onClick={() => setTo(s)} className={cn(s === 'cancelled' && 'text-busy')}>
                {s === 'completed' && b.status === 'refund' ? 'Devolución hecha: completar' : s === 'cancelled' && b.status === 'refund' ? 'Devolución hecha: cancelar' : transitionLabel[s]}
              </Button>
            ))}
          </div>
        )}
      </div>

      {b.status === 'cancelled' && b.cancelReason && (
        <Alert tone="red" className="mt-5">
          <strong className="font-semibold">Motivo de la cancelación:</strong> {b.cancelReason}
        </Alert>
      )}
      {b.status === 'refund' && b.refund && (
        <Alert tone="violet" className="mt-5">
          Pendiente de devolver: fianza {money(b.refund.deposit)} y pago {money(b.refund.payment)}. {b.refund.reason}
        </Alert>
      )}

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <div className="space-y-6">
          <Panel title="Estancia">
            <dl className="grid gap-x-6 gap-y-4 p-5 text-sm sm:grid-cols-2">
              <Item label="Fechas" value={fmtRange(b.arrivalDate, b.departureDate)} />
              <Item label="Horario" value={`Llegada ${b.arrivalTime} · Salida ${b.departureTime}`} />
              <Item label="Personas" value={`${b.totalGuests} en total (${b.children} niños/as, ${b.monitors} responsables)`} />
              <Item label="Solicitada" value={fmtDateTime(b.createdAt)} />
            </dl>
            <div className="border-t border-piedra-200 p-5">
              <p className="text-sm text-ink-soft">Actividad</p>
              <p className={cn('mt-1 whitespace-pre-line text-sm leading-relaxed', !b.activity && 'text-piedra-500')}>{b.activity || 'Sin descripción'}</p>
            </div>
          </Panel>

          <Panel title="Persona responsable">
            <dl className="grid gap-x-6 gap-y-4 p-5 text-sm sm:grid-cols-2">
              <Item label="Nombre" value={b.responsibleName} />
              <Item label="DNI / NIE" value={b.dni || 'Sin indicar'} mono={!!b.dni} />
              <div>
                <dt className="text-ink-soft">Teléfono</dt>
                <dd className="mt-0.5">
                  <a className="inline-flex items-center gap-1.5 font-medium text-encina-600 hover:underline" href={`tel:${b.phone.replace(/\s/g, '')}`}>
                    <Phone className="size-3.5" aria-hidden />
                    {b.phone}
                  </a>
                </dd>
              </div>
              <div>
                <dt className="text-ink-soft">Correo</dt>
                <dd className="mt-0.5">
                  {b.email ? (
                    <a className="inline-flex items-center gap-1.5 break-all font-medium text-encina-600 hover:underline" href={`mailto:${b.email}?subject=${encodeURIComponent(`Reserva ${b.reference}`)}`}>
                      <Mail className="size-3.5 shrink-0" aria-hidden />
                      {b.email}
                    </a>
                  ) : (
                    <span className="font-medium">Sin indicar</span>
                  )}
                </dd>
              </div>
            </dl>
          </Panel>

          <Money booking={b} />
        </div>

        <div className="space-y-6">
          <TrackingLink booking={b} />
          <Keys booking={b} />
          <PaymentProof booking={b} />
          <Comments booking={b} />
          <Notes booking={b} />
          <Panel title="Historial">
            <ol className="relative space-y-5 p-5">
              {[...b.history].reverse().map((h, i) => (
                <li key={i} className="relative flex gap-3 text-sm">
                  <span className={cn('mt-1.5 size-2.5 shrink-0 rounded-full', toneDot[statusMeta[h.to].tone])} aria-hidden />
                  <div>
                    <p className="font-medium">
                      {h.from === h.to ? 'Cambio de datos' : `${h.from ? `${statusMeta[h.from].label} → ` : ''}${statusMeta[h.to].label}`}
                    </p>
                    <p className="text-xs text-ink-soft">
                      {fmtDateTime(h.at)} · {h.by}
                    </p>
                    {h.note && <p className="mt-1 text-ink-soft">{h.note}</p>}
                  </div>
                </li>
              ))}
            </ol>
          </Panel>
        </div>
      </div>

      <TransitionDialog booking={b} to={to} onClose={() => setTo(null)} />
    </>
  )
}

function Item({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <dt className="text-ink-soft">{label}</dt>
      <dd className={cn('mt-0.5 font-medium', mono && 'font-mono')}>{value}</dd>
    </div>
  )
}

function Money({ booking: b }: { booking: Booking }) {
  const est = estimatePrice(b.arrivalDate, b.departureDate, b.totalGuests)
  return (
    <Panel title="Importes" action={<FreeToggle booking={b} />}>
      {b.free && (
        <p className="border-b border-piedra-200 bg-encina-50 px-5 py-3 text-sm text-encina-700">
          Estancia gratuita: el grupo solo paga la fianza ({money(prices.deposit)}) y la reserva no suma ingresos en finanzas.
        </p>
      )}
      <dl className="divide-y divide-piedra-200 text-sm">
        {est?.lines.map((l) => (
          <Row key={l.label} label={`${l.units > 1 ? `${l.units} × ` : ''}${l.label} (${l.guests} × ${money(l.unitPrice)})`} value={money(l.amount)} muted />
        ))}
        <Row label="Fianza" value={money(est?.deposit ?? 0)} muted />
        <Row label="Estimación de la web" value={money(b.estimatedTotal)} />
        <Row label="Importe pedido al grupo" value={b.amountDue !== null ? money(b.amountDue) : '—'} />
        <Row label="Importe cobrado" value={b.amountPaid !== null ? `${money(b.amountPaid)}${b.paidAt ? ` · ${fmtDate(b.paidAt)}` : ''}` : '—'} strong />
        {b.depositRetained > 0 && <Row label="Fianza retenida" value={money(b.depositRetained)} />}
        {b.refund && <Row label={`Devolución${b.refund.doneAt ? ` (hecha el ${fmtDate(b.refund.doneAt)})` : ' (pendiente)'}`} value={money(b.refund.deposit + b.refund.payment)} />}
      </dl>
    </Panel>
  )
}

function FreeToggle({ booking: b }: { booking: Booking }) {
  const update = useUpdateBooking(b.id)
  const editable = b.status === 'pending' || b.status === 'pending_payment'
  return (
    <div className="flex items-center gap-2.5">
      {update.isError && <span className="text-xs text-busy">No se ha podido cambiar</span>}
      <label
        className={cn('flex items-center gap-2 text-sm', editable ? 'cursor-pointer' : 'cursor-not-allowed text-ink-soft')}
        title={editable ? 'Solo paga la fianza y no cuenta como ingreso' : 'Solo se puede cambiar antes de registrar el pago'}
      >
        <span>Gratuita</span>
        <Switch label="Estancia gratuita" checked={b.free} disabled={!editable || update.isPending} onChange={(free) => update.mutate({ free })} />
      </label>
    </div>
  )
}

function Row({ label, value, muted, strong }: { label: string; value: string; muted?: boolean; strong?: boolean }) {
  return (
    <div className="flex justify-between gap-4 px-5 py-2.5">
      <dt className={cn(muted && 'text-ink-soft')}>{label}</dt>
      <dd className={cn('tabular text-right', strong && 'font-semibold', muted && 'text-ink-soft')}>{value}</dd>
    </div>
  )
}

const keyOptions: KeysStatus[] = ['not_handed', 'handed', 'returned']
const keysShort: Record<KeysStatus, string> = { not_handed: 'Sin entregar', handed: 'Entregadas', returned: 'Devueltas' }

function Keys({ booking: b }: { booking: Booking }) {
  const update = useUpdateBooking(b.id)
  const editable = b.status === 'confirmed' || b.status === 'refund'
  return (
    <Panel title="Llaves">
      <div className="p-5">
        <div role="radiogroup" aria-label="Estado de las llaves" className="grid grid-cols-3 gap-1 rounded-xl bg-piedra-100 p-1">
          {keyOptions.map((k) => (
            <button
              key={k}
              role="radio"
              aria-checked={b.keys === k}
              disabled={!editable || update.isPending}
              onClick={() => update.mutate({ keys: k })}
              className={cn(
                'rounded-lg px-2 py-2 text-xs font-medium disabled:cursor-not-allowed',
                b.keys === k ? 'bg-paper text-ink shadow-sm' : 'text-ink-soft enabled:hover:text-ink',
              )}
            >
              {keysShort[k]}
            </button>
          ))}
        </div>
        {!editable && <p className="mt-3 text-xs text-ink-soft">Se gestionan cuando la reserva está confirmada.</p>}
      </div>
    </Panel>
  )
}

function PaymentProof({ booking: b }: { booking: Booking }) {
  const update = useUpdateBooking(b.id)
  if (!b.paymentProof) return null
  const p = b.paymentProof
  return (
    <Panel title="Justificante de pago">
      <div className="flex items-center gap-3 p-5 text-sm">
        <FileText className="size-8 shrink-0 text-encina-600" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{p.fileName}</p>
          <p className="text-xs text-ink-soft">Subido el {fmtDateTime(p.uploadedAt)}</p>
          {/* A plain link: the browser sends the session cookie and saves the file (the API answers with Content-Disposition: attachment). */}
          <a
            href={`${API_BASE}/admin/bookings/${b.id}/payment-proof`}
            className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-encina-600 hover:underline"
          >
            <Download className="size-3.5" aria-hidden />
            Descargar
          </a>
        </div>
        {p.verified ? (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-free">
            <CheckCircle2 className="size-4" aria-hidden />
            Revisado
          </span>
        ) : (
          <Button size="sm" onClick={() => update.mutate({ paymentProofVerified: true })} loading={update.isPending}>
            Marcar revisado
          </Button>
        )}
      </div>
    </Panel>
  )
}

function TrackingLink({ booking: b }: { booking: Booking }) {
  const [copied, setCopied] = useState(false)
  const url = trackingUrl(b.trackingToken)
  const body = `Hola ${b.responsibleName.split(' ')[0]}:\n\nPuedes ver el estado de tu reserva ${b.reference} en el ${site.name} y subir el justificante de pago aquí:\n${url}\n\nUn saludo.`
  return (
    <Panel title="Enlace del grupo">
      <div className="space-y-3 p-5">
        <p className="text-xs text-ink-soft">El enlace de seguimiento del grupo (se le envía por correo). Da acceso a la reserva: compártelo solo con la persona responsable.</p>
        <div className="flex gap-2">
          <Input readOnly value={url} onFocus={(e) => e.currentTarget.select()} className="font-mono text-xs" aria-label="Enlace de seguimiento" />
          <Button
            variant="secondary"
            aria-label="Copiar enlace"
            onClick={() => navigator.clipboard?.writeText(url).then(() => setCopied(true), () => {})}
          >
            {copied ? <Check className="size-4 text-free" /> : <Copy className="size-4" />}
          </Button>
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
          <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 font-medium text-encina-600 hover:underline">
            <ExternalLink className="size-3.5" aria-hidden />
            Abrir como el grupo
          </a>
          <a
            href={`mailto:${b.email}?subject=${encodeURIComponent(`Tu reserva ${b.reference}`)}&body=${encodeURIComponent(body)}`}
            className="inline-flex items-center gap-1.5 font-medium text-encina-600 hover:underline"
          >
            <Mail className="size-3.5" aria-hidden />
            Reenviar por correo
          </a>
        </div>
      </div>
    </Panel>
  )
}

function Comments({ booking: b }: { booking: Booking }) {
  const add = useAddComment(b.id)
  const remove = useDeleteComment(b.id)
  const [text, setText] = useState('')
  return (
    <Panel title="Mensajes para el grupo">
      {b.comments.length > 0 && (
        <ol className="divide-y divide-piedra-200 border-b border-piedra-200">
          {[...b.comments].reverse().map((c) => (
            <li key={c.id} className="flex gap-3 px-5 py-3 text-sm">
              <div className="min-w-0 flex-1">
                <p className="text-xs text-ink-soft">
                  {fmtDateTime(c.at)} · {c.by}
                </p>
                <p className="mt-1 whitespace-pre-line leading-relaxed">{c.text}</p>
              </div>
              <button
                type="button"
                className="self-start rounded p-1 text-piedra-500 hover:bg-piedra-100 hover:text-busy disabled:opacity-50"
                aria-label="Borrar mensaje"
                disabled={remove.isPending}
                onClick={() => window.confirm('¿Borrar este mensaje? El grupo dejará de verlo.') && remove.mutate(c.id)}
              >
                <Trash2 className="size-4" />
              </button>
            </li>
          ))}
        </ol>
      )}
      <form
        className="space-y-3 p-5"
        onSubmit={(e) => {
          e.preventDefault()
          if (text.trim()) add.mutate(text, { onSuccess: () => setText('') })
        }}
      >
        <Textarea rows={3} value={text} onChange={(e) => setText(e.target.value)} maxLength={2000} placeholder="Lo verá el grupo en su página de seguimiento" aria-label="Nuevo mensaje para el grupo" />
        {add.isError && <Alert>No se ha podido publicar el mensaje.</Alert>}
        <div className="flex justify-end">
          <Button type="submit" size="sm" disabled={!text.trim()} loading={add.isPending}>
            Publicar mensaje
          </Button>
        </div>
      </form>
    </Panel>
  )
}

function Notes({ booking: b }: { booking: Booking }) {
  const update = useUpdateBooking(b.id)
  const [text, setText] = useState(b.internalNotes)
  const dirty = text !== b.internalNotes
  return (
    <Panel title="Notas internas">
      <div className="space-y-3 p-5">
        <Textarea rows={4} value={text} onChange={(e) => setText(e.target.value)} maxLength={4000} placeholder="Solo las ve el equipo de gestión" aria-label="Notas internas" />
        <div className="flex items-center justify-end gap-3">
          {update.isSuccess && !dirty && <span className="text-xs text-free">Guardado</span>}
          <Button size="sm" variant="secondary" disabled={!dirty} loading={update.isPending} onClick={() => update.mutate({ internalNotes: text })}>
            Guardar notas
          </Button>
        </div>
      </div>
    </Panel>
  )
}
