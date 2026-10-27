import { Link } from 'react-router'
import { addDays, startOfToday } from 'date-fns'
import { ArrowUpRight, CircleAlert, KeyRound, FileCheck2, ClipboardList, Undo2, Clock } from 'lucide-react'
import { BOOKING_STATUSES, statusMeta, keysLabel, type BookingStatus } from '@/domain/booking'
import { summarize } from '@/domain/finance'
import { fmtDate, fmtRange, money, toISODate } from '@/lib/format'
import { cn } from '@/lib/cn'
import { Panel, Spinner, StatusBadge } from '@/components/ui'
import { toneDot } from '@/components/ui/tones'
import { PageHeader } from './AdminLayout'
import { useBookings, useLedger } from './queries'
import { attentionItems, type AttentionItem } from './attention'

const attentionIcon: Record<AttentionItem['kind'], typeof CircleAlert> = {
  review: ClipboardList,
  proof: FileCheck2,
  keys_out: KeyRound,
  keys_back: KeyRound,
  close: CircleAlert,
  refund: Undo2,
  payment_overdue: Clock,
}

export function DashboardPage() {
  const bookings = useBookings()
  const ledger = useLedger()
  if (bookings.isLoading) return <Spinner />
  const list = bookings.data ?? []

  const today = toISODate(startOfToday())
  const in60 = toISODate(addDays(startOfToday(), 60))
  const counts = Object.fromEntries(BOOKING_STATUSES.map((s) => [s, list.filter((b) => b.status === s).length])) as Record<BookingStatus, number>
  const upcoming = list
    .filter((b) => ['pending', 'pending_payment', 'confirmed'].includes(b.status) && b.departureDate >= today && b.arrivalDate <= in60)
    .sort((a, b) => a.arrivalDate.localeCompare(b.arrivalDate))
  const attention = attentionItems(list)
  const year = new Date().getFullYear()
  const fin = summarize((ledger.data ?? []).filter((e) => e.date.startsWith(String(year))))
  const guestsThisYear = list.filter((b) => ['confirmed', 'completed', 'refund'].includes(b.status) && b.arrivalDate.startsWith(String(year))).reduce((s, b) => s + b.totalGuests, 0)

  return (
    <>
      <PageHeader title="Panel" description={`Hoy es ${fmtDate(today, "EEEE d 'de' MMMM")}`} />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {BOOKING_STATUSES.map((s) => (
          <Link key={s} to={`/admin/reservas?estado=${s}`} className="group rounded-xl border border-piedra-200 bg-paper p-4 hover:border-encina-500">
            <p className="flex items-center gap-2 text-sm text-ink-soft">
              <span className={cn('size-2 rounded-full', toneDot[statusMeta[s].tone])} aria-hidden />
              {statusMeta[s].label}
            </p>
            <p className="mt-2 font-display text-3xl font-bold tabular">{counts[s]}</p>
          </Link>
        ))}
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.25fr_1fr]">
        <Panel title="Necesita tu atención" action={<span className="text-sm text-ink-soft">{attention.length} tareas</span>}>
          {attention.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-ink-soft">Nada pendiente. Todo al día.</p>
          ) : (
            <ul className="divide-y divide-piedra-200">
              {attention.map((a) => {
                const Icon = attentionIcon[a.kind]
                return (
                  <li key={`${a.booking.id}-${a.kind}`}>
                    <Link to={`/admin/reservas/${a.booking.id}`} className="flex items-center gap-4 px-5 py-3.5 hover:bg-cal">
                      <span className={cn('grid size-9 shrink-0 place-items-center rounded-lg', a.priority === 1 ? 'bg-busy-bg text-busy' : 'bg-albero-50 text-albero-700')}>
                        <Icon className="size-4.5" aria-hidden />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{a.text}</span>
                        <span className="block truncate text-xs text-ink-soft">
                          {a.booking.organization} · {fmtRange(a.booking.arrivalDate, a.booking.departureDate)}
                        </span>
                      </span>
                      <ArrowUpRight className="size-4 shrink-0 text-piedra-500" aria-hidden />
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
        </Panel>

        <Panel title="Próximas estancias" action={<span className="text-sm text-ink-soft">60 días</span>}>
          {upcoming.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-ink-soft">No hay estancias en los próximos 60 días.</p>
          ) : (
            <ul className="divide-y divide-piedra-200">
              {upcoming.map((b) => (
                <li key={b.id}>
                  <Link to={`/admin/reservas/${b.id}`} className="flex items-center gap-4 px-5 py-3.5 hover:bg-cal">
                    <span className="w-12 shrink-0 text-center">
                      <span className="block font-display text-xl font-bold leading-none tabular">{fmtDate(b.arrivalDate, 'd')}</span>
                      <span className="block text-xs capitalize text-ink-soft">{fmtDate(b.arrivalDate, 'MMM')}</span>
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{b.organization}</span>
                      <span className="block truncate text-xs text-ink-soft">
                        {b.totalGuests} personas · {b.arrivalTime}–{b.departureTime}
                        {b.status === 'confirmed' && ` · ${keysLabel[b.keys]}`}
                      </span>
                    </span>
                    <StatusBadge status={b.status} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Stat label={`Ingresos ${year}`} value={money(fin.income - fin.refunds)} />
        <Stat label={`Gastos ${year}`} value={money(fin.expenses)} />
        <Stat label="Balance" value={money(fin.net)} tone={fin.net >= 0 ? 'good' : 'bad'} />
        <Stat label="Fianzas en custodia" value={money(fin.depositsHeld)} hint="No es ingreso: hay que devolverlas" />
        <Stat label={`Personas alojadas ${year}`} value={String(guestsThisYear)} />
      </div>
      <p className="mt-3 text-right text-sm">
        <Link to="/admin/finanzas" className="font-medium text-encina-600 hover:underline">
          Ver informe de finanzas
        </Link>
      </p>
    </>
  )
}

function Stat({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: 'good' | 'bad' }) {
  return (
    <div className="rounded-xl border border-piedra-200 bg-paper p-4">
      <p className="text-sm text-ink-soft">{label}</p>
      <p className={cn('mt-1 font-display text-2xl font-bold tabular', tone === 'good' && 'text-free', tone === 'bad' && 'text-busy')}>{value}</p>
      {hint && <p className="mt-1 text-xs text-ink-soft">{hint}</p>}
    </div>
  )
}
