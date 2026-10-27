import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'

const eur = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 })
const eurRound = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })

export const money = (n: number) => (Number.isInteger(n) ? eurRound.format(n) : eur.format(n))

export const toISODate = (d: Date) => format(d, 'yyyy-MM-dd')

export const fmtDate = (iso: string, pattern = 'd MMM yyyy') => format(parseISO(iso), pattern, { locale: es })

export const fmtDateTime = (iso: string) => format(parseISO(iso), "d MMM yyyy, HH:mm", { locale: es })

export const fmtRange = (start: string, end: string) => {
  const a = parseISO(start)
  const b = parseISO(end)
  if (start === end) return format(a, 'd MMM yyyy', { locale: es })
  const sameYear = a.getFullYear() === b.getFullYear()
  return `${format(a, sameYear ? "d MMM" : 'd MMM yyyy', { locale: es })} – ${format(b, 'd MMM yyyy', { locale: es })}`
}
