import { useMemo } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { Search, KeyRound, Plus } from 'lucide-react'
import { BOOKING_STATUSES, keysLabel, statusMeta, type BookingStatus } from '@/domain/booking'
import { fmtDate, fmtRange, money } from '@/lib/format'
import { cn } from '@/lib/cn'
import { Input, Spinner, StatusBadge, Select } from '@/components/ui'
import { PageHeader } from './AdminLayout'
import { useBookings } from './queries'
import { suggestedAmountDue } from '@/lib/pricing'

type Sort = 'arrival_asc' | 'arrival_desc' | 'created_desc'

const normalize = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')

export function BookingsPage() {
  const { data, isLoading, isError } = useBookings()
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const status = (params.get('estado') as BookingStatus | null) ?? null
  const q = params.get('q') ?? ''
  const sort = (params.get('orden') as Sort | null) ?? 'arrival_asc'

  const set = (k: string, v: string | null) =>
    setParams(
      (p) => {
        if (v) p.set(k, v)
        else p.delete(k)
        return p
      },
      { replace: true },
    )

  const counts = useMemo(() => {
    const c: Partial<Record<BookingStatus, number>> = {}
    for (const b of data ?? []) c[b.status] = (c[b.status] ?? 0) + 1
    return c
  }, [data])

  const rows = useMemo(() => {
    const needle = normalize(q.trim())
    const list = (data ?? []).filter(
      (b) =>
        (!status || b.status === status) &&
        (!needle || normalize(`${b.reference} ${b.organization} ${b.responsibleName} ${b.dni} ${b.email} ${b.phone}`).includes(needle)),
    )
    return list.sort((a, b) =>
      sort === 'arrival_asc' ? a.arrivalDate.localeCompare(b.arrivalDate) : sort === 'arrival_desc' ? b.arrivalDate.localeCompare(a.arrivalDate) : b.createdAt.localeCompare(a.createdAt),
    )
  }, [data, status, q, sort])

  return (
    <>
      <PageHeader
        title="Reservas"
        description="Todas las solicitudes y su estado."
        actions={
          <Link to="/admin/reservas/nueva" className="inline-flex h-10 items-center gap-2 rounded-lg bg-encina-600 px-4 text-sm font-medium text-white hover:bg-encina-700">
            <Plus className="size-4" aria-hidden />
            Nueva reserva
          </Link>
        }
      />

      <div className="-mx-4 mb-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <div role="tablist" aria-label="Filtrar por estado" className="flex w-max gap-1 rounded-xl bg-piedra-100 p-1">
          <Tab active={!status} onClick={() => set('estado', null)} label="Todas" count={data?.length ?? 0} />
          {BOOKING_STATUSES.map((s) => (
            <Tab key={s} active={status === s} onClick={() => set('estado', s)} label={statusMeta[s].label} count={counts[s] ?? 0} />
          ))}
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-3">
        <div className="relative min-w-60 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-piedra-500" aria-hidden />
          <Input type="search" value={q} onChange={(e) => set('q', e.target.value || null)} placeholder="Buscar por grupo, responsable, DNI, referencia…" className="pl-9" aria-label="Buscar reservas" />
        </div>
        <Select value={sort} onChange={(e) => set('orden', e.target.value)} className="w-auto" aria-label="Ordenar">
          <option value="arrival_asc">Llegada: próximas primero</option>
          <option value="arrival_desc">Llegada: recientes primero</option>
          <option value="created_desc">Solicitud: más nuevas</option>
        </Select>
      </div>

      {isLoading ? (
        <Spinner />
      ) : isError ? (
        <p className="py-10 text-center text-busy">No se han podido cargar las reservas.</p>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-piedra-300 py-16 text-center text-sm text-ink-soft">
          {q ? `Ninguna reserva coincide con "${q}".` : 'No hay reservas en este estado.'}
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden overflow-hidden rounded-xl border border-piedra-200 bg-paper md:block">
            <table className="w-full text-sm">
              <thead className="border-b border-piedra-200 bg-cal text-left text-xs text-ink-soft">
                <tr>
                  <th className="px-4 py-3 font-medium">Grupo</th>
                  <th className="px-4 py-3 font-medium">Fechas</th>
                  <th className="px-4 py-3 text-right font-medium">Personas</th>
                  <th className="px-4 py-3 text-right font-medium">Importe</th>
                  <th className="px-4 py-3 font-medium">Estado</th>
                  <th className="px-4 py-3 font-medium">
                    <span className="sr-only">Llaves</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-piedra-200">
                {rows.map((b) => (
                  <tr key={b.id} onClick={() => navigate(`/admin/reservas/${b.id}`)} className="cursor-pointer hover:bg-cal">
                    <td className="px-4 py-3">
                      <Link to={`/admin/reservas/${b.id}`} className="font-medium hover:underline" onClick={(e) => e.stopPropagation()}>
                        {b.organization}
                      </Link>
                      <p className="text-xs text-ink-soft">
                        <span className="tabular">{b.reference}</span> · {b.responsibleName}
                      </p>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      {fmtRange(b.arrivalDate, b.departureDate)}
                      <p className="text-xs text-ink-soft">Solicitada el {fmtDate(b.createdAt.slice(0, 10))}</p>
                    </td>
                    <td className="px-4 py-3 text-right tabular">
                      {b.totalGuests}
                      <p className="text-xs text-ink-soft">
                        {b.children} + {b.monitors}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-right tabular">
                      {money(b.amountPaid ?? b.amountDue ?? suggestedAmountDue(b))}
                      {b.free && <p className="text-xs text-encina-700">Gratuita</p>}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={b.status} />
                    </td>
                    <td className="px-4 py-3">
                      {b.status === 'confirmed' && <KeysIcon keys={b.keys} />}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <ul className="space-y-3 md:hidden">
            {rows.map((b) => (
              <li key={b.id}>
                <Link to={`/admin/reservas/${b.id}`} className="block rounded-xl border border-piedra-200 bg-paper p-4">
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-medium">{b.organization}</p>
                    <StatusBadge status={b.status} />
                  </div>
                  <p className="mt-1 text-sm text-ink-soft">{fmtRange(b.arrivalDate, b.departureDate)}</p>
                  <p className="mt-2 flex items-center justify-between text-sm">
                    <span>{b.totalGuests} personas</span>
                    <span className="tabular">
                      {b.free && <span className="mr-2 text-xs text-encina-700">Gratuita</span>}
                      {money(b.amountPaid ?? b.amountDue ?? suggestedAmountDue(b))}
                    </span>
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  )
}

function Tab({ active, onClick, label, count }: { active: boolean; onClick: () => void; label: string; count: number }) {
  return (
    <button
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn('flex items-center gap-2 whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium', active ? 'bg-paper text-ink shadow-sm' : 'text-ink-soft hover:text-ink')}
    >
      {label}
      <span className={cn('rounded-full px-1.5 text-xs tabular', active ? 'bg-piedra-100' : 'bg-piedra-200')}>{count}</span>
    </button>
  )
}

function KeysIcon({ keys }: { keys: 'not_handed' | 'handed' | 'returned' }) {
  return (
    <span title={keysLabel[keys]} className={cn('inline-flex', keys === 'not_handed' ? 'text-piedra-300' : keys === 'handed' ? 'text-albero-700' : 'text-free')}>
      <KeyRound className="size-4" aria-label={keysLabel[keys]} />
    </span>
  )
}
