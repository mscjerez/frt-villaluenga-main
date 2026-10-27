import { addDays, differenceInCalendarDays, parseISO, startOfToday } from 'date-fns'
import type { Booking } from '@/domain/booking'
import { toISODate } from '@/lib/format'

export interface AttentionItem {
  booking: Booking
  kind: 'review' | 'proof' | 'keys_out' | 'keys_back' | 'close' | 'refund' | 'payment_overdue'
  text: string
  priority: number
}

/** Things an admin should act on, most urgent first. */
export function attentionItems(bookings: Booking[]): AttentionItem[] {
  const today = startOfToday()
  const todayIso = toISODate(today)
  const soon = toISODate(addDays(today, 7))
  const items: AttentionItem[] = []

  for (const b of bookings) {
    const daysToArrival = differenceInCalendarDays(parseISO(b.arrivalDate), today)
    if (b.status === 'pending') {
      const age = differenceInCalendarDays(today, parseISO(b.createdAt))
      items.push({ booking: b, kind: 'review', text: `Solicitud por revisar${age > 0 ? ` desde hace ${age} ${age === 1 ? 'día' : 'días'}` : ' de hoy'}`, priority: daysToArrival < 21 ? 1 : 3 })
    }
    if (b.status === 'pending_payment' && daysToArrival <= 14) {
      items.push({ booking: b, kind: 'payment_overdue', text: `Sin pago y llegan en ${daysToArrival} días`, priority: 2 })
    }
    if (b.status === 'confirmed' && b.paymentProof && !b.paymentProof.verified) {
      items.push({ booking: b, kind: 'proof', text: 'Justificante de pago sin revisar', priority: 2 })
    }
    if (b.status === 'confirmed' && b.keys === 'not_handed' && b.arrivalDate >= todayIso && b.arrivalDate <= soon) {
      items.push({ booking: b, kind: 'keys_out', text: daysToArrival === 0 ? 'Llegan hoy: entregar llaves' : `Llegan en ${daysToArrival} días: preparar llaves`, priority: 1 })
    }
    if (b.status === 'confirmed' && b.departureDate < todayIso) {
      if (b.keys !== 'returned') items.push({ booking: b, kind: 'keys_back', text: 'Estancia terminada y llaves sin devolver', priority: 1 })
      else items.push({ booking: b, kind: 'close', text: 'Estancia terminada: devolver fianza y cerrar', priority: 2 })
    }
    if (b.status === 'refund') {
      items.push({ booking: b, kind: 'refund', text: `Devolución pendiente de ${(b.refund?.deposit ?? 0) + (b.refund?.payment ?? 0)} €`, priority: 2 })
    }
  }
  return items.sort((a, b) => a.priority - b.priority || a.booking.arrivalDate.localeCompare(b.booking.arrivalDate))
}
