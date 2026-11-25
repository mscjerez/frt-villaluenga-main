import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { addMonths, eachDayOfInterval, endOfMonth, endOfWeek, format, isSameMonth, isToday, startOfMonth, startOfWeek, subMonths } from 'date-fns'
import { es } from 'date-fns/locale'
import { Ban, ChevronLeft, ChevronRight, Trash2 } from 'lucide-react'
import { blockingStatuses, statusMeta, tentativeStatuses, type Booking, type DateBlock } from '@/domain/booking'
import { ApiError } from '@/api/client'
import { fmtRange, toISODate } from '@/lib/format'
import { cn } from '@/lib/cn'
import { Alert, Button, Dialog, Field, Input, Panel, Spinner } from '@/components/ui'
import { toneDot } from '@/components/ui/tones'
import { PageHeader } from './AdminLayout'
import { useAddBlock, useBlocks, useBookings, useDeleteBlock } from './queries'

const chip: Record<string, string> = {
  pending: 'bg-tentative-bg text-tentative',
  pending_payment: 'bg-[#e1ebf5] text-[#2f5d8a]',
  confirmed: 'bg-free-bg text-free',
  refund: 'bg-[#ece6f5] text-[#5d4690]',
  completed: 'bg-piedra-200 text-ink-soft',
}

export function CalendarPage() {
  const [month, setMonth] = useState(() => startOfMonth(new Date()))
  const { data, isLoading } = useBookings()
  const blocks = useBlocks()
  const [blocking, setBlocking] = useState(false)
  const days = eachDayOfInterval({ start: startOfWeek(month, { weekStartsOn: 1 }), end: endOfWeek(endOfMonth(month), { weekStartsOn: 1 }) })
  const visible = (data ?? []).filter((b) => b.status !== 'cancelled')
  const on = (d: Date): Booking[] => {
    const k = toISODate(d)
    return visible.filter((b) => b.arrivalDate <= k && b.departureDate >= k)
  }
  const closedOn = (d: Date): DateBlock | undefined => {
    const k = toISODate(d)
    return blocks.data?.find((x) => x.start <= k && x.end >= k)
  }

  return (
    <>
      <PageHeader
        title="Calendario"
        description="Ocupación de la casa. Las reservas canceladas no aparecen."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" size="sm" onClick={() => setBlocking(true)}>
              <Ban className="size-4" aria-hidden />
              Cerrar fechas
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setMonth((m) => subMonths(m, 1))} aria-label="Mes anterior">
              <ChevronLeft className="size-4" />
            </Button>
            <span className="w-36 text-center font-display font-semibold capitalize">{format(month, 'MMMM yyyy', { locale: es })}</span>
            <Button variant="secondary" size="sm" onClick={() => setMonth((m) => addMonths(m, 1))} aria-label="Mes siguiente">
              <ChevronRight className="size-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setMonth(startOfMonth(new Date()))}>
              Hoy
            </Button>
          </div>
        }
      />
      {isLoading ? (
        <Spinner />
      ) : (
        <>
          <div className="overflow-x-auto rounded-xl border border-piedra-200 bg-paper">
            <div className="grid min-w-[720px] grid-cols-7">
              {['lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom'].map((d) => (
                <div key={d} className="border-b border-piedra-200 bg-cal px-2 py-2 text-xs font-medium text-ink-soft">
                  {d}
                </div>
              ))}
              {days.map((d) => {
                const items = on(d)
                const closed = closedOn(d)
                return (
                  <div
                    key={d.toISOString()}
                    className={cn(
                      'min-h-28 border-b border-r border-piedra-200 p-1.5 [&:nth-child(7n)]:border-r-0',
                      !isSameMonth(d, month) && 'bg-cal/60',
                      closed && 'bg-[repeating-linear-gradient(-45deg,var(--color-piedra-200)_0_4px,transparent_4px_9px)]',
                    )}
                  >
                    <span
                      className={cn(
                        'inline-grid size-6 place-items-center rounded-full text-xs tabular',
                        isToday(d) ? 'bg-encina-600 font-semibold text-white' : !isSameMonth(d, month) ? 'text-piedra-300' : 'text-ink-soft',
                      )}
                    >
                      {format(d, 'd')}
                    </span>
                    <div className="mt-1 space-y-1">
                      {closed && (
                        <p title={`Cerrada: ${closed.reason}`} className="truncate rounded bg-piedra-200 px-1.5 py-0.5 text-[11px] font-medium text-ink">
                          Cerrada · {closed.reason}
                        </p>
                      )}
                      {items.map((b) => (
                        <Link
                          key={b.id}
                          to={`/admin/reservas/${b.id}`}
                          title={`${b.organization} · ${statusMeta[b.status].label}`}
                          className={cn('block truncate rounded px-1.5 py-0.5 text-[11px] font-medium hover:brightness-95', chip[b.status])}
                        >
                          {b.arrivalDate === toISODate(d) && `${b.arrivalTime} `}
                          {b.organization}
                        </Link>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
          <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm text-ink-soft">
            {(['pending', 'pending_payment', 'confirmed', 'refund', 'completed'] as const).map((s) => (
              <li key={s} className="flex items-center gap-2">
                <span className={cn('size-2.5 rounded-full', toneDot[statusMeta[s].tone])} aria-hidden />
                {statusMeta[s].label}
              </li>
            ))}
            <li className="flex items-center gap-2">
              <span className="size-2.5 rounded-full bg-piedra-500" aria-hidden />
              Casa cerrada
            </li>
          </ul>
          <BlockList blocks={blocks.data ?? []} />
        </>
      )}
      <BlockDialog open={blocking} onClose={() => setBlocking(false)} bookings={visible} />
    </>
  )
}

function BlockList({ blocks }: { blocks: DateBlock[] }) {
  const remove = useDeleteBlock()
  const today = toISODate(new Date())
  const upcoming = blocks.filter((b) => b.end >= today)
  return (
    <Panel title="Cierres programados" className="mt-8">
      {upcoming.length === 0 ? (
        <p className="p-5 text-sm text-ink-soft">No hay cierres. Usa «Cerrar fechas» para bloquear días por mantenimiento u otros motivos.</p>
      ) : (
        <ul className="divide-y divide-piedra-200">
          {upcoming.map((b) => (
            <li key={b.id} className="flex items-center gap-4 px-5 py-3 text-sm">
              <div className="min-w-0 flex-1">
                <p className="font-medium">{fmtRange(b.start, b.end)}</p>
                <p className="truncate text-ink-soft">
                  {b.reason} · {b.createdBy}
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                disabled={remove.isPending}
                onClick={() => window.confirm('¿Reabrir estas fechas? Volverán a aparecer libres en la web.') && remove.mutate(b.id)}
              >
                <Trash2 className="size-4" aria-hidden />
                Reabrir
              </Button>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}

function BlockDialog({ open, onClose, bookings }: { open: boolean; onClose: () => void; bookings: Booking[] }) {
  return (
    <Dialog open={open} onClose={onClose} title="Cerrar fechas" description="En la web pública esos días saldrán como ocupados y nadie podrá pedirlos.">
      {open && <BlockForm onClose={onClose} bookings={bookings} />}
    </Dialog>
  )
}

function BlockForm({ onClose, bookings }: { onClose: () => void; bookings: Booking[] }) {
  const add = useAddBlock()
  const [start, setStart] = useState(toISODate(new Date()))
  const [end, setEnd] = useState(toISODate(new Date()))
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  const active = [...blockingStatuses, ...tentativeStatuses]
  const clashes = start && end && end >= start ? bookings.filter((b) => active.includes(b.status) && b.arrivalDate <= end && b.departureDate >= start) : []

  const submit = (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!start || !end || end < start) return setError('La fecha final no puede ser anterior a la inicial.')
    if (!reason.trim()) return setError('Indica el motivo del cierre.')
    add.mutate({ start, end, reason: reason.trim() }, { onSuccess: onClose })
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Desde">{(p) => <Input type="date" value={start} onChange={(e) => setStart(e.target.value)} {...p} />}</Field>
        <Field label="Hasta (incluido)">{(p) => <Input type="date" value={end} min={start} onChange={(e) => setEnd(e.target.value)} {...p} />}</Field>
      </div>
      <Field label="Motivo" hint="Solo lo ve el equipo de gestión.">
        {(p) => <Input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={200} placeholder="Mantenimiento de la caldera" {...p} />}
      </Field>
      {clashes.length > 0 && (
        <Alert tone="amber">
          Ya hay {clashes.length === 1 ? 'una reserva' : `${clashes.length} reservas`} en esas fechas: {clashes.map((b) => `${b.organization} (${statusMeta[b.status].label.toLowerCase()})`).join(', ')}.
          {clashes.length === 1
            ? ' El cierre no la cancela; avisa al grupo y cancélala a mano si hace falta.'
            : ' El cierre no las cancela; avisa a los grupos y cancélalas a mano si hace falta.'}
        </Alert>
      )}
      {(error || add.isError) && <Alert>{error ?? (add.error instanceof ApiError ? add.error.message : 'No se ha podido guardar.')}</Alert>}
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="ghost" onClick={onClose}>
          Volver
        </Button>
        <Button type="submit" loading={add.isPending}>
          Cerrar fechas
        </Button>
      </div>
    </form>
  )
}
