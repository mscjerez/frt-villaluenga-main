export const BOOKING_STATUSES = [
  'pending',
  'pending_payment',
  'confirmed',
  'refund',
  'cancelled',
  'completed',
] as const

export type BookingStatus = (typeof BOOKING_STATUSES)[number]

export type KeysStatus = 'not_handed' | 'handed' | 'returned'

export type DayStatus = 'available' | 'pending' | 'busy'

export interface AvailabilityRange {
  start: string // yyyy-MM-dd, inclusive
  end: string // yyyy-MM-dd, inclusive
  status: Exclude<DayStatus, 'available'>
}

export interface BookingRequest {
  arrivalDate: string
  departureDate: string
  arrivalTime: string
  departureTime: string
  organization: string
  responsibleName: string
  dni: string
  phone: string
  email: string
  children: number
  monitors: number
  totalGuests: number
  activity: string
  acceptPrivacy: true
  acceptRules: true
}

export interface StatusChange {
  at: string
  from: BookingStatus | null
  to: BookingStatus
  by: string
  note?: string
}

export interface Booking extends Omit<BookingRequest, 'acceptPrivacy' | 'acceptRules'> {
  id: string
  reference: string
  status: BookingStatus
  createdAt: string
  updatedAt: string
  estimatedTotal: number
  amountDue: number | null
  amountPaid: number | null
  paidAt: string | null
  paymentProof: { fileName: string; uploadedAt: string; verified: boolean } | null
  keys: KeysStatus
  cancelReason: string | null
  refund: { deposit: number; payment: number; reason: string; doneAt: string | null } | null
  depositRetained: number
  internalNotes: string
  /** Free stay: the group only pays the deposit and the booking generates no income. */
  free: boolean
  /** Secret for the tracking link `/reservas/:token` that the backend emails to the group. */
  trackingToken: string
  /** Messages from the house to the group, shown on the tracking page. */
  comments: BookingComment[]
  history: StatusChange[]
}

export interface BookingComment {
  id: string
  at: string
  by: string
  text: string
}

/** Dates the house is closed (maintenance, own use…). Shown as busy on the public calendar. */
export interface DateBlock {
  id: string
  start: string // yyyy-MM-dd, inclusive
  end: string // yyyy-MM-dd, inclusive
  reason: string
  createdBy: string
  createdAt: string
}

export type NewDateBlock = Pick<DateBlock, 'start' | 'end' | 'reason'>

/**
 * A booking an admin enters by hand (agreed by phone, email or in person). Same data as the web form without the consents;
 * DNI, email and activity may be left empty.
 */
export interface ManualBookingRequest extends Omit<BookingRequest, 'acceptPrivacy' | 'acceptRules'> {
  free: boolean
  internalNotes: string
  /** Email the group its tracking link, as for web requests. Requires `email`. */
  notifyGroup: boolean
}

/** Public view of a booking, reachable through the secret tracking link. */
export interface PublicBooking {
  reference: string
  status: BookingStatus
  organization: string
  arrivalDate: string
  departureDate: string
  arrivalTime: string
  departureTime: string
  totalGuests: number
  estimatedTotal: number
  amountDue: number | null
  free: boolean
  cancelReason: string | null
  paymentProof: { fileName: string; uploadedAt: string; verified: boolean } | null
  /** Status changes, oldest first (no internal notes or admin names). */
  timeline: { at: string; status: BookingStatus }[]
  comments: { at: string; text: string }[]
}

export const statusMeta: Record<BookingStatus, { label: string; short: string; description: string; tone: Tone }> = {
  pending: {
    label: 'Pendiente',
    short: 'Pendiente',
    description: 'Solicitud recibida, falta que la casa la acepte.',
    tone: 'amber',
  },
  pending_payment: {
    label: 'Pendiente de pago',
    short: 'Pago',
    description: 'Aceptada. Esperando el justificante de pago.',
    tone: 'blue',
  },
  confirmed: {
    label: 'Confirmada',
    short: 'Confirmada',
    description: 'Pagada y confirmada. Pendiente de la estancia.',
    tone: 'green',
  },
  refund: {
    label: 'Devolución',
    short: 'Devolución',
    description: 'Hay que devolver la fianza o el pago.',
    tone: 'violet',
  },
  cancelled: {
    label: 'Cancelada',
    short: 'Cancelada',
    description: 'No sigue adelante.',
    tone: 'red',
  },
  completed: {
    label: 'Completada',
    short: 'Completada',
    description: 'Estancia terminada y cuentas cerradas.',
    tone: 'stone',
  },
}

export type Tone = 'amber' | 'blue' | 'green' | 'violet' | 'red' | 'stone'

export const keysLabel: Record<KeysStatus, string> = {
  not_handed: 'Llaves sin entregar',
  handed: 'Llaves entregadas',
  returned: 'Llaves devueltas',
}

/** Allowed transitions. The backend must enforce the same table. */
export const transitions: Record<BookingStatus, BookingStatus[]> = {
  pending: ['pending_payment', 'cancelled'],
  pending_payment: ['confirmed', 'cancelled'],
  confirmed: ['refund', 'completed', 'cancelled'],
  refund: ['completed', 'cancelled'],
  cancelled: ['refund'],
  completed: [],
}

export const transitionLabel: Record<BookingStatus, string> = {
  pending: 'Pendiente',
  pending_payment: 'Aceptar y pedir pago',
  confirmed: 'Registrar pago y confirmar',
  refund: 'Iniciar devolución',
  cancelled: 'Cancelar reserva',
  completed: 'Marcar como completada',
}

export type TransitionPayload =
  | { to: 'pending_payment'; amountDue: number; note?: string }
  | { to: 'confirmed'; amountPaid: number; paidAt: string; note?: string }
  | { to: 'cancelled'; reason: string }
  | { to: 'refund'; deposit: number; payment: number; reason: string }
  | { to: 'completed'; depositRetained?: number; note?: string }

/** Statuses that block the calendar for other groups. */
export const blockingStatuses: BookingStatus[] = ['pending_payment', 'confirmed']
export const tentativeStatuses: BookingStatus[] = ['pending']
