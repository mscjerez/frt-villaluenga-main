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
  history: StatusChange[]
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
  paymentProofUploaded: boolean
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
