// In-browser fake backend state for development (persisted in localStorage).
// It mirrors the rules the real backend must implement; see docs/API.md.
import { addDays, format, isBefore, parseISO, subDays } from 'date-fns'
import {
  blockingStatuses,
  tentativeStatuses,
  transitions,
  type AvailabilityRange,
  type Booking,
  type BookingRequest,
  type BookingStatus,
  type DateBlock,
  type NewDateBlock,
  type TransitionPayload,
} from '@/domain/booking'
import type { LedgerEntry, NewLedgerEntry } from '@/domain/finance'
import { emptyBanner, type SiteBanner } from '@/domain/settings'
import { estimatePrice, suggestedAmountDue } from '@/lib/pricing'
import { prices } from '@/config/site'

const KEY = 'rcc-mock-db-v2'

interface Db {
  bookings: Booking[]
  ledger: LedgerEntry[]
  blocks: DateBlock[]
  banner: SiteBanner
}

const iso = (d: Date) => format(d, 'yyyy-MM-dd')
const uid = () => crypto.randomUUID()

export const randomToken = () => {
  const bytes = crypto.getRandomValues(new Uint8Array(24))
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

let counter = 0
function nextReference(created: Date) {
  counter++
  return `RCC-${format(created, 'yy')}-${String(counter).padStart(4, '0')}`
}

export const db: Db = { bookings: [], ledger: [], blocks: [], banner: emptyBanner }

export const persist = () => {
  try {
    localStorage.setItem(KEY, JSON.stringify(db))
  } catch {
    /* storage full or blocked: keep in memory */
  }
}

function init() {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      Object.assign(db, JSON.parse(raw) as Db)
      db.banner ??= emptyBanner // saved before the banner existed
      counter = db.bookings.length
      return
    }
  } catch {
    /* fall through to seed */
  }
  seed()
  persist()
}

export function resetDb() {
  seed()
  persist()
}

// ---------- availability ----------

export function availability(from: string, to: string): AvailabilityRange[] {
  const bookings = db.bookings
    .filter((b) => b.departureDate >= from && b.arrivalDate <= to)
    .flatMap<AvailabilityRange>((b) => {
      if (blockingStatuses.includes(b.status)) return [{ start: b.arrivalDate, end: b.departureDate, status: 'busy' }]
      if (tentativeStatuses.includes(b.status)) return [{ start: b.arrivalDate, end: b.departureDate, status: 'pending' }]
      return []
    })
  // Closed dates look like any other busy day: the reason stays internal.
  const blocks = db.blocks
    .filter((k) => k.end >= from && k.start <= to)
    .map<AvailabilityRange>((k) => ({ start: k.start, end: k.end, status: 'busy' }))
  return [...bookings, ...blocks]
}

export function overlapsBusy(arrival: string, departure: string, ignoreId?: string) {
  return db.bookings.some(
    (b) => b.id !== ignoreId && blockingStatuses.includes(b.status) && b.arrivalDate <= departure && b.departureDate >= arrival,
  )
}

export const overlapsBlock = (arrival: string, departure: string) => db.blocks.some((k) => k.start <= departure && k.end >= arrival)

export function addBlock(block: NewDateBlock, by: string): DateBlock {
  if (!block.start || !block.end || block.end < block.start) throw new RuleError('invalid_dates', 'La fecha final no puede ser anterior a la inicial.')
  if (!block.reason.trim()) throw new RuleError('reason_required', 'Indica el motivo del cierre.')
  const created: DateBlock = { ...block, reason: block.reason.trim().slice(0, 200), id: uid(), createdBy: by, createdAt: new Date().toISOString() }
  db.blocks.push(created)
  db.blocks.sort((a, b) => (a.start < b.start ? -1 : 1))
  return created
}

export const findByToken = (token: string) => db.bookings.find((b) => b.trackingToken === token)

/** Normalised reference so "rcc 26 12" or "RCC-26-0012" both match. */
const normRef = (r: string) => r.toUpperCase().replace(/[^A-Z0-9]/g, '')

export function lookup(reference: string) {
  const ref = normRef(reference)
  return db.bookings.find((b) => normRef(b.reference) === ref)
}

export function addComment(b: Booking, text: string, by: string, at = new Date()) {
  b.comments.push({ id: uid(), at: at.toISOString(), by, text: text.trim().slice(0, 2000) })
  b.updatedAt = at.toISOString()
}

// ---------- bookings ----------

export function createBooking(
  req: Omit<BookingRequest, 'acceptPrivacy' | 'acceptRules'>,
  createdAt = new Date(),
  opts: { by?: string; note?: string; free?: boolean; internalNotes?: string } = {},
): { booking: Booking; token: string } {
  const estimate = estimatePrice(req.arrivalDate, req.departureDate, req.totalGuests)
  const booking: Booking = {
    ...req,
    id: uid(),
    reference: nextReference(createdAt),
    status: 'pending',
    createdAt: createdAt.toISOString(),
    updatedAt: createdAt.toISOString(),
    estimatedTotal: estimate?.total ?? 0,
    amountDue: null,
    amountPaid: null,
    paidAt: null,
    paymentProof: null,
    keys: 'not_handed',
    cancelReason: null,
    refund: null,
    depositRetained: 0,
    internalNotes: opts.internalNotes ?? '',
    free: opts.free ?? false,
    trackingToken: randomToken(),
    comments: [],
    history: [{ at: createdAt.toISOString(), from: null, to: 'pending', by: opts.by ?? 'Formulario web', ...(opts.note ? { note: opts.note } : {}) }],
  }
  db.bookings.unshift(booking)
  return { booking, token: booking.trackingToken }
}

export class RuleError extends Error {
  code: string
  constructor(code: string, message: string) {
    super(message)
    this.code = code
  }
}

function ledger(entry: NewLedgerEntry, b: Booking | null, by: string, automatic = true) {
  if (entry.amount <= 0) return
  db.ledger.unshift({ ...entry, id: uid(), bookingId: b?.id ?? null, bookingReference: b?.reference ?? null, createdBy: by, automatic })
}

export function applyTransition(b: Booking, p: TransitionPayload, by: string, at = new Date()) {
  if (!transitions[b.status].includes(p.to)) {
    throw new RuleError('invalid_transition', `No se puede pasar de "${b.status}" a "${p.to}".`)
  }
  const from = b.status
  const today = iso(at)
  let note: string | undefined

  switch (p.to) {
    case 'pending_payment':
      if (!(p.amountDue > 0)) throw new RuleError('amount_required', 'Indica el importe a pagar.')
      if (overlapsBusy(b.arrivalDate, b.departureDate, b.id))
        throw new RuleError('dates_taken', 'Las fechas se solapan con otra reserva aceptada o confirmada.')
      if (overlapsBlock(b.arrivalDate, b.departureDate)) throw new RuleError('dates_blocked', 'Las fechas coinciden con un cierre de la casa.')
      b.amountDue = p.amountDue
      note = `Importe a pagar: ${p.amountDue} €`
      // The message to the group is shown on the tracking page.
      if (p.note) addComment(b, p.note, by, at)
      break
    case 'confirmed': {
      if (!(p.amountPaid > 0)) throw new RuleError('amount_required', 'Indica el importe pagado.')
      b.amountPaid = p.amountPaid
      b.paidAt = p.paidAt
      const deposit = Math.min(prices.deposit, p.amountPaid)
      ledger({ date: p.paidAt, kind: 'deposit_in', category: 'Fianzas', amount: deposit, description: `Fianza ${b.organization}` }, b, by)
      // Free stays only pay the deposit and never count as income.
      if (!b.free)
        ledger({ date: p.paidAt, kind: 'income', category: 'Estancias', amount: p.amountPaid - deposit, description: `Estancia ${b.organization}` }, b, by)
      note = p.note
      break
    }
    case 'cancelled':
      if (!p.reason.trim()) throw new RuleError('reason_required', 'Indica el motivo de la cancelación.')
      if (from === 'refund') closeRefund(b, by, today)
      b.cancelReason = p.reason
      note = p.reason
      break
    case 'refund':
      if (!p.reason.trim()) throw new RuleError('reason_required', 'Indica el motivo de la devolución.')
      b.refund = { deposit: p.deposit, payment: p.payment, reason: p.reason, doneAt: null }
      note = `${p.reason} · Fianza ${p.deposit} € · Pago ${p.payment} €`
      break
    case 'completed':
      if (from === 'refund') closeRefund(b, by, today)
      if (from === 'confirmed') {
        const retained = Math.min(p.depositRetained ?? 0, prices.deposit)
        const returned = prices.deposit - retained
        b.depositRetained = retained
        if (retained > 0)
          ledger({ date: today, kind: 'income', category: 'Fianza retenida', amount: retained, description: `Fianza retenida ${b.organization}` }, b, by)
        ledger({ date: today, kind: 'deposit_out', category: 'Fianzas', amount: retained, description: `Fianza retenida ${b.organization}` }, b, by)
        // returned part is still held until a refund is processed; completing directly means it was returned in cash
        ledger({ date: today, kind: 'deposit_out', category: 'Fianzas', amount: returned, description: `Fianza devuelta ${b.organization}` }, b, by)
      }
      note = p.note
      break
  }

  b.status = p.to
  b.updatedAt = at.toISOString()
  b.history.push({ at: at.toISOString(), from, to: p.to, by, ...(note ? { note } : {}) })
}

function closeRefund(b: Booking, by: string, date: string) {
  if (!b.refund || b.refund.doneAt) return
  b.refund.doneAt = date
  ledger({ date, kind: 'deposit_out', category: 'Fianzas', amount: b.refund.deposit, description: `Fianza devuelta ${b.organization}` }, b, by)
  ledger({ date, kind: 'refund', category: 'Devoluciones', amount: b.refund.payment, description: `Devolución ${b.organization}` }, b, by)
}

export function addLedgerEntry(entry: NewLedgerEntry, by: string) {
  ledger(entry, null, by, false)
  return db.ledger[0]!
}

// ---------- seed ----------

const groups = [
  ['Grupo Scout Bahía 112', 'Lucía Fernández Ruiz', '12345678Z'],
  ['Parroquia San Pedro de Jerez', 'Antonio Gómez Pérez', '87654321X'],
  ['Asociación Juvenil Sierra Viva', 'María José Ortega', '11111111H'],
  ['Grupo Scout Trafalgar 340', 'Javier Moreno Díaz', '22222222J'],
  ['Club de Montaña Ubrique', 'Rocío Barrera León', '33333333P'],
  ['Grupo Scout Atlántida', 'Pablo Ramírez Sanz', '44444444A'],
  ['Colegio Salesianos Cádiz', 'Inmaculada Torres', '55555555K'],
  ['Grupo Scout Medina 79', 'Daniel Castro Vega', '66666666Q'],
  ['Asociación Educativa Albero', 'Carmen Navarro Gil', '77777777B'],
  ['Grupo Scout San Fernando 5', 'Sergio Domínguez', '88888888Y'],
] as const

const activities = [
  'Acampada de ronda con rutas por la Sierra del Caíllo, taller de orientación y velada.',
  'Convivencia de catequistas: dinámicas de grupo, ruta al Llano de Líbar y celebración.',
  'Fin de semana de naturaleza con talleres de flora local y visita a la quesería del pueblo.',
  'Salida de manada: juegos, construcciones con cuerdas y marcha corta por el entorno.',
  'Excursión de un día con ruta de senderismo y comida en la casa.',
]

function seed() {
  db.bookings = []
  db.ledger = []
  db.blocks = []
  db.banner = emptyBanner
  counter = 0
  const today = new Date()
  const plan: Array<{ off: number; nights: number; status: BookingStatus; kids: number; mons: number; keys?: Booking['keys']; created: number; free?: boolean; message?: string }> = [
    { off: -120, nights: 2, status: 'completed', kids: 24, mons: 5, created: -160 },
    { off: -85, nights: 0, status: 'completed', kids: 30, mons: 6, created: -110 },
    { off: -60, nights: 3, status: 'cancelled', kids: 18, mons: 4, created: -90 },
    { off: -34, nights: 2, status: 'refund', kids: 22, mons: 4, keys: 'returned', created: -70 },
    { off: -12, nights: 1, status: 'confirmed', kids: 15, mons: 3, keys: 'returned', created: -50 },
    { off: 9, nights: 2, status: 'confirmed', kids: 26, mons: 5, keys: 'handed', created: -40 },
    { off: 23, nights: 2, status: 'confirmed', kids: 20, mons: 4, created: -30, free: true },
    { off: 37, nights: 3, status: 'pending_payment', kids: 28, mons: 6, created: -10, message: 'Os esperamos. Recordad traer el parte de incidencias impreso.' },
    { off: 51, nights: 2, status: 'pending', kids: 19, mons: 4, created: -3 },
    { off: 52, nights: 1, status: 'pending', kids: 12, mons: 2, created: -1 },
    { off: 72, nights: 0, status: 'pending', kids: 34, mons: 6, created: 0 },
  ]

  plan.forEach((p, i) => {
    const [org, name, dni] = groups[i % groups.length]!
    const arrival = alignToFriday(addDays(today, p.off), p.nights)
    const departure = addDays(arrival, p.nights)
    const created = addDays(today, p.created)
    const req = {
      arrivalDate: iso(arrival),
      departureDate: iso(departure),
      arrivalTime: p.nights === 0 ? '10:00' : '18:00',
      departureTime: p.nights === 0 ? '19:00' : '16:00',
      organization: org,
      responsibleName: name,
      dni,
      phone: `6${String(10000000 + i * 7654321).slice(0, 8)}`,
      email: `${name.split(' ')[0]!.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')}@example.org`,
      children: p.kids,
      monitors: p.mons,
      totalGuests: p.kids + p.mons,
      activity: activities[i % activities.length]!,
    }
    {
      const { booking: b } = createBooking(req, created)
      const by = 'Carlos'
      b.free = !!p.free
      const step = (payload: TransitionPayload, dayOffset: number) => applyTransition(b, payload, by, addDays(created, dayOffset))
      const due = suggestedAmountDue(b)
      const reached = (s: BookingStatus) => ORDER.indexOf(p.status) >= ORDER.indexOf(s)

      if (p.status === 'cancelled') {
        step({ to: 'pending_payment', amountDue: due }, 2)
        step({ to: 'cancelled', reason: 'El grupo cambió la fecha de la salida y no podía venir.' }, 9)
      } else {
        if (reached('pending_payment')) step({ to: 'pending_payment', amountDue: due, note: p.message }, 2)
        if (reached('confirmed')) {
          const paid = addDays(created, 6)
          step({ to: 'confirmed', amountPaid: due, paidAt: iso(paid) }, 6)
          b.paymentProof = { fileName: 'justificante-transferencia.pdf', uploadedAt: paid.toISOString(), verified: true }
        }
        if (p.status === 'refund') {
          step({ to: 'refund', deposit: prices.deposit, payment: 0, reason: 'Devolución de fianza tras la estancia' }, 2 + (p.off - p.created))
        }
        if (p.status === 'completed') {
          step({ to: 'refund', deposit: prices.deposit, payment: 0, reason: 'Devolución de fianza tras la estancia' }, 1 + (p.off - p.created) + p.nights)
          step({ to: 'completed', note: 'Fianza devuelta por transferencia' }, 4 + (p.off - p.created) + p.nights)
          b.keys = 'returned'
        }
      }
      if (p.keys) b.keys = p.keys
    }
  })
  // Oldest first while seeding keeps references chronological; newest first for the UI.
  db.bookings.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))

  db.blocks.push({
    id: uid(),
    start: iso(addDays(today, 62)),
    end: iso(addDays(today, 65)),
    reason: 'Revisión de la instalación eléctrica',
    createdBy: 'Carlos',
    createdAt: today.toISOString(),
  })

  // Some running costs so the finance view has data.
  const costs: Array<[number, string, number, string]> = [
    [-150, 'Luz', 64.3, 'Factura Endesa'],
    [-120, 'Agua', 21.8, 'Recibo agua municipal'],
    [-118, 'Limpieza', 90, 'Limpieza a fondo tras temporada'],
    [-95, 'Mantenimiento y reparaciones', 145, 'Cambio de cisterna baño planta alta'],
    [-90, 'Luz', 58.75, 'Factura Endesa'],
    [-62, 'Seguros', 310, 'Seguro de responsabilidad civil anual'],
    [-60, 'Agua', 19.4, 'Recibo agua municipal'],
    [-40, 'Material y equipamiento', 120, 'Colchones para literas (4 uds.)'],
    [-30, 'Luz', 71.2, 'Factura Endesa'],
    [-15, 'Gas / leña', 85, 'Leña para la chimenea'],
    [-5, 'Comisiones bancarias', 6, 'Mantenimiento cuenta'],
  ]
  for (const [off, category, amount, description] of costs) {
    db.ledger.push({
      id: uid(),
      date: iso(addDays(today, off)),
      kind: 'expense',
      category,
      amount,
      description,
      bookingId: null,
      bookingReference: null,
      createdBy: 'Carlos',
      automatic: false,
    })
  }
  db.ledger.push({
    id: uid(),
    date: iso(subDays(today, 75)),
    kind: 'income',
    category: 'Donativos',
    amount: 200,
    description: 'Donativo de la hermandad',
    bookingId: null,
    bookingReference: null,
    createdBy: 'Carlos',
    automatic: false,
  })
  db.ledger.sort((a, b) => (a.date < b.date ? 1 : -1))
}

const ORDER: BookingStatus[] = ['pending', 'pending_payment', 'confirmed', 'refund', 'completed']

function alignToFriday(d: Date, nights: number) {
  if (nights < 2) return d
  const delta = (5 - d.getDay() + 7) % 7
  return addDays(d, delta)
}

export const isPast = (isoDate: string) => isBefore(parseISO(isoDate), new Date())

init()
