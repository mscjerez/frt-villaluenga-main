import { addDays, differenceInCalendarDays, isFriday, parseISO } from 'date-fns'
import { prices } from '@/config/site'

export interface PriceLine {
  label: string
  units: number
  guests: number
  unitPrice: number
  amount: number
}

export interface PriceEstimate {
  nights: number
  lines: PriceLine[]
  stay: number
  deposit: number
  total: number
}

/**
 * Day visit when arrival = departure. Otherwise every Friday+Saturday night pair inside the stay
 * is charged as a weekend; the remaining nights are charged one by one.
 */
export function estimatePrice(arrival: string, departure: string, guests: number): PriceEstimate | null {
  if (!arrival || !departure || guests <= 0) return null
  const start = parseISO(arrival)
  const nights = differenceInCalendarDays(parseISO(departure), start)
  if (nights < 0) return null

  const lines: PriceLine[] = []
  if (nights === 0) {
    lines.push(line('Día sin pernoctar', 1, guests, prices.dayVisit))
  } else {
    let weekends = 0
    let single = 0
    for (let i = 0; i < nights; i++) {
      if (isFriday(addDays(start, i)) && i + 1 < nights) {
        weekends++
        i++
      } else {
        single++
      }
    }
    if (weekends) lines.push(line(weekends === 1 ? 'Fin de semana (vie–dom)' : 'Fines de semana (vie–dom)', weekends, guests, prices.weekend))
    if (single) lines.push(line(single === 1 ? 'Noche' : 'Noches', single, guests, prices.night))
  }
  const stay = lines.reduce((s, l) => s + l.amount, 0)
  return { nights, lines, stay, deposit: prices.deposit, total: stay + prices.deposit }
}

function line(label: string, units: number, guests: number, unitPrice: number): PriceLine {
  return { label, units, guests, unitPrice, amount: units * guests * unitPrice }
}

/** Amount to ask the group for: the full estimate, or only the deposit for a free stay. */
export const suggestedAmountDue = (b: { free: boolean; estimatedTotal: number }) => (b.free ? prices.deposit : b.estimatedTotal)
