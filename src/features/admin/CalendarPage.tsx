import { useState } from 'react'
import { Link } from 'react-router'
import { addMonths, eachDayOfInterval, endOfMonth, endOfWeek, format, isSameMonth, isToday, startOfMonth, startOfWeek, subMonths } from 'date-fns'
import { es } from 'date-fns/locale'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { statusMeta, type Booking } from '@/domain/booking'
import { toISODate } from '@/lib/format'
import { cn } from '@/lib/cn'
import { Button, Spinner } from '@/components/ui'
import { toneDot } from '@/components/ui/tones'
import { PageHeader } from './AdminLayout'
import { useBookings } from './queries'

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
  const days = eachDayOfInterval({ start: startOfWeek(month, { weekStartsOn: 1 }), end: endOfWeek(endOfMonth(month), { weekStartsOn: 1 }) })
  const visible = (data ?? []).filter((b) => b.status !== 'cancelled')
  const on = (d: Date): Booking[] => {
    const k = toISODate(d)
    return visible.filter((b) => b.arrivalDate <= k && b.departureDate >= k)
  }

  return (
    <>
      <PageHeader
        title="Calendario"
        description="Ocupación de la casa. Las reservas canceladas no aparecen."
        actions={
          <div className="flex items-center gap-2">
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
                return (
                  <div key={d.toISOString()} className={cn('min-h-28 border-b border-r border-piedra-200 p-1.5 [&:nth-child(7n)]:border-r-0', !isSameMonth(d, month) && 'bg-cal/60')}>
                    <span
                      className={cn(
                        'inline-grid size-6 place-items-center rounded-full text-xs tabular',
                        isToday(d) ? 'bg-encina-600 font-semibold text-white' : !isSameMonth(d, month) ? 'text-piedra-300' : 'text-ink-soft',
                      )}
                    >
                      {format(d, 'd')}
                    </span>
                    <div className="mt-1 space-y-1">
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
          </ul>
        </>
      )}
    </>
  )
}
