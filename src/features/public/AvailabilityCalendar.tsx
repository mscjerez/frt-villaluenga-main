import { DayPicker, type DateRange } from 'react-day-picker'
import { es } from 'react-day-picker/locale'
import { addMonths, startOfToday } from 'date-fns'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { AVAILABILITY_MONTHS, useAvailability } from '@/hooks/useAvailability'
import { toISODate } from '@/lib/format'

interface Props {
  selected: DateRange | undefined
  onSelect: (range: DateRange | undefined) => void
}

export function AvailabilityCalendar({ selected, onSelect }: Props) {
  const wide = useMediaQuery('(min-width: 1180px)')
  const { busy, pending, busyKeys, pendingKeys, isLoading, isError, refetch } = useAvailability()
  const today = startOfToday()

  return (
    <div>
      <div className="relative">
        <DayPicker
          mode="range"
          locale={es}
          weekStartsOn={1}
          numberOfMonths={wide ? 2 : 1}
          startMonth={today}
          endMonth={addMonths(today, AVAILABILITY_MONTHS)}
          selected={selected}
          onSelect={onSelect}
          excludeDisabled
          disabled={[{ before: today }, ...busy]}
          modifiers={{
            busy,
            pending,
            free: (d) => d >= today && !busyKeys.has(toISODate(d)) && !pendingKeys.has(toISODate(d)),
          }}
          modifiersClassNames={{ busy: 'is-busy', pending: 'is-pending', free: 'is-free' }}
          labels={{
            labelDayButton: (date, mods) => {
              const k = toISODate(date)
              const state = busyKeys.has(k) ? 'ocupado' : pendingKeys.has(k) ? 'pendiente de confirmar' : mods.disabled ? 'no disponible' : 'libre'
              return `${date.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}, ${state}${mods.selected ? ', seleccionado' : ''}`
            },
          }}
        />
        {isLoading && <div className="absolute inset-0 animate-pulse rounded-xl bg-paper/60" aria-hidden />}
      </div>
      {isError && (
        <p role="alert" className="mt-3 text-sm text-busy">
          No hemos podido cargar la disponibilidad.{' '}
          <button className="font-medium underline" onClick={() => refetch()}>
            Reintentar
          </button>
        </p>
      )}
      <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm text-ink-soft" aria-label="Leyenda">
        <Legend className="bg-free-bg ring-free/30">Libre</Legend>
        <Legend className="bg-[repeating-linear-gradient(-45deg,var(--color-tentative-bg)_0_3px,#fff6e5_3px_6px)] ring-tentative/40">
          Pendiente de confirmar
        </Legend>
        <Legend className="bg-busy-bg ring-busy/30">Ocupado</Legend>
      </ul>
    </div>
  )
}

function Legend({ className, children }: { className: string; children: string }) {
  return (
    <li className="flex items-center gap-2">
      <span className={`size-4 rounded ring-1 ring-inset ${className}`} aria-hidden />
      {children}
    </li>
  )
}
