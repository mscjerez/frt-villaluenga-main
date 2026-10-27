import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { addMonths, eachDayOfInterval, endOfMonth, parseISO, startOfToday } from 'date-fns'
import { publicApi } from '@/api/public'
import { toISODate } from '@/lib/format'

export const AVAILABILITY_MONTHS = 12

/** Public availability for the next year, expanded into day lists for the calendar. */
export function useAvailability() {
  const from = toISODate(startOfToday())
  const to = toISODate(endOfMonth(addMonths(startOfToday(), AVAILABILITY_MONTHS)))
  const query = useQuery({
    queryKey: ['availability', from, to],
    queryFn: () => publicApi.availability(from, to),
    refetchInterval: 60_000,
  })

  const days = useMemo(() => {
    const busy = new Map<string, Date>()
    const pending = new Map<string, Date>()
    for (const r of query.data ?? []) {
      for (const d of eachDayOfInterval({ start: parseISO(r.start), end: parseISO(r.end) })) {
        const key = toISODate(d)
        if (r.status === 'busy') busy.set(key, d)
        else pending.set(key, d)
      }
    }
    for (const k of busy.keys()) pending.delete(k)
    return { busy: [...busy.values()], pending: [...pending.values()], busyKeys: new Set(busy.keys()), pendingKeys: new Set(pending.keys()) }
  }, [query.data])

  return { ...query, ...days }
}
