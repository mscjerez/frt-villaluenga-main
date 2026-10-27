import { http, HttpResponse, delay, type JsonBodyType } from 'msw'
import { addLedgerEntry, applyTransition, availability, createBooking, db, overlapsBusy, persist, RuleError } from './db'
import { MOCK_ADMIN } from './seed-credentials'
import type { BookingRequest, PublicBooking, TransitionPayload, Booking } from '@/domain/booking'
import type { NewLedgerEntry } from '@/domain/finance'
import { isValidDniNie, isValidPhone } from '@/lib/validation'

const SESSION_KEY = 'rcc-mock-session'
const LOGIN_FAILS_KEY = 'rcc-mock-login-fails'
const MAX_FAILS = 5
const LOCK_MS = 15 * 60_000

const err = (status: number, code: string, message: string, extra: Record<string, unknown> = {}, headers?: HeadersInit) =>
  HttpResponse.json({ code, message, ...extra }, { status, headers })

const challenges = new Map<string, { email: string; expires: number }>()

function sessionUser() {
  const raw = sessionStorage.getItem(SESSION_KEY)
  if (!raw) return null
  const s = JSON.parse(raw) as { email: string; name: string; expires: number }
  if (s.expires < Date.now()) {
    sessionStorage.removeItem(SESSION_KEY)
    return null
  }
  return s
}

function requireAdmin() {
  const u = sessionUser()
  if (!u) return { error: err(401, 'unauthenticated', 'Tu sesión ha caducado. Vuelve a entrar.') }
  return { user: u }
}

function toPublic(b: Booking): PublicBooking {
  return {
    reference: b.reference,
    status: b.status,
    organization: b.organization,
    arrivalDate: b.arrivalDate,
    departureDate: b.departureDate,
    arrivalTime: b.arrivalTime,
    departureTime: b.departureTime,
    totalGuests: b.totalGuests,
    estimatedTotal: b.estimatedTotal,
    amountDue: b.amountDue,
    paymentProofUploaded: !!b.paymentProof,
  }
}

const seenIdempotency = new Map<string, unknown>()

export const handlers = [
  // ---------------- public ----------------
  http.get('/api/public/availability', async ({ request }) => {
    await delay(250)
    const url = new URL(request.url)
    return HttpResponse.json(availability(url.searchParams.get('from') ?? '0000', url.searchParams.get('to') ?? '9999'))
  }),

  http.post('/api/public/bookings', async ({ request }) => {
    await delay(700)
    const key = request.headers.get('Idempotency-Key')
    if (key && seenIdempotency.has(key)) return HttpResponse.json(seenIdempotency.get(key) as JsonBodyType, { status: 201 })

    const body = (await request.json()) as BookingRequest & { captchaToken?: string; website?: string; elapsedMs?: number }
    if (!body.captchaToken) return err(400, 'captcha', 'Completa la verificación anti-spam.')
    // Bots: honeypot filled or form sent too fast. Pretend success so they don't adapt.
    if (body.website || (body.elapsedMs ?? 0) < 3000) return HttpResponse.json({ reference: 'RCC-00-0000', trackingToken: 'x' }, { status: 201 })

    const fieldErrors: Record<string, string> = {}
    if (!isValidDniNie(body.dni)) fieldErrors.dni = 'DNI o NIE no válido.'
    if (!isValidPhone(body.phone)) fieldErrors.phone = 'Teléfono no válido.'
    if (body.departureDate < body.arrivalDate) fieldErrors.departureDate = 'La salida no puede ser antes de la llegada.'
    if (Object.keys(fieldErrors).length) return err(422, 'validation', 'Revisa los campos marcados.', { fieldErrors })
    if (overlapsBusy(body.arrivalDate, body.departureDate))
      return err(409, 'dates_taken', 'Alguna de las fechas elegidas ya está ocupada. Elige otras en el calendario.')

    const { acceptPrivacy: _a, acceptRules: _r, captchaToken: _c, website: _w, elapsedMs: _e, ...data } = body
    const { booking, token } = createBooking(data)
    persist()
    const res = { reference: booking.reference, trackingToken: token }
    if (key) seenIdempotency.set(key, res)
    console.info('[mock] Enlace de seguimiento:', `${location.origin}/reserva/${token}`)
    return HttpResponse.json(res, { status: 201 })
  }),

  http.get('/api/public/bookings/:token', async ({ params }) => {
    await delay(300)
    const b = db.bookings.find((x) => x.id === db.tokens[String(params.token)])
    if (!b) return err(404, 'not_found', 'No encontramos ninguna reserva con este enlace.')
    return HttpResponse.json(toPublic(b))
  }),

  http.post('/api/public/bookings/:token/payment-proof', async ({ params, request }) => {
    await delay(900)
    const b = db.bookings.find((x) => x.id === db.tokens[String(params.token)])
    if (!b) return err(404, 'not_found', 'No encontramos ninguna reserva con este enlace.')
    if (b.status !== 'pending_payment') return err(409, 'invalid_state', 'Esta reserva no está esperando un pago.')
    const form = await request.formData()
    const file = form.get('file')
    if (!form.get('captchaToken')) return err(400, 'captcha', 'Completa la verificación anti-spam.')
    if (!(file instanceof File)) return err(422, 'validation', 'Adjunta el justificante.')
    if (file.size > 5 * 1024 * 1024) return err(413, 'too_large', 'El archivo supera 5 MB.')
    if (!['application/pdf', 'image/jpeg', 'image/png'].includes(file.type)) return err(415, 'type', 'Solo PDF, JPG o PNG.')
    applyTransition(b, { to: 'confirmed', amountPaid: b.amountDue ?? b.estimatedTotal, paidAt: new Date().toISOString().slice(0, 10), note: 'Justificante subido por el grupo' }, 'Grupo (enlace de seguimiento)')
    b.paymentProof = { fileName: file.name, uploadedAt: new Date().toISOString(), verified: false }
    persist()
    return HttpResponse.json(toPublic(b))
  }),

  // ---------------- admin auth ----------------
  http.post('/api/admin/auth/login', async ({ request }) => {
    await delay(600) // constant-ish delay, the real backend should also hash even for unknown users
    const fails = JSON.parse(localStorage.getItem(LOGIN_FAILS_KEY) ?? '{"n":0,"until":0}') as { n: number; until: number }
    if (fails.until > Date.now()) {
      const secs = Math.ceil((fails.until - Date.now()) / 1000)
      return err(429, 'locked', 'Demasiados intentos fallidos. Espera unos minutos antes de volver a probar.', {}, { 'Retry-After': String(secs) })
    }
    const { email, password } = (await request.json()) as { email: string; password: string }
    if (email.trim().toLowerCase() !== MOCK_ADMIN.email || password !== MOCK_ADMIN.password) {
      fails.n++
      if (fails.n >= MAX_FAILS) Object.assign(fails, { n: 0, until: Date.now() + LOCK_MS })
      localStorage.setItem(LOGIN_FAILS_KEY, JSON.stringify(fails))
      return err(401, 'invalid_credentials', 'Correo o contraseña incorrectos.')
    }
    localStorage.removeItem(LOGIN_FAILS_KEY)
    const challengeId = crypto.randomUUID()
    challenges.set(challengeId, { email, expires: Date.now() + 5 * 60_000 })
    return HttpResponse.json({ mfaRequired: true, challengeId })
  }),

  http.post('/api/admin/auth/mfa', async ({ request }) => {
    await delay(400)
    const { challengeId, code } = (await request.json()) as { challengeId: string; code: string }
    const ch = challenges.get(challengeId)
    if (!ch || ch.expires < Date.now()) return err(401, 'challenge_expired', 'El inicio de sesión ha caducado. Vuelve a introducir tu contraseña.')
    if (code !== MOCK_ADMIN.totp) return err(401, 'invalid_code', 'Código incorrecto. Usa el código actual de tu app de autenticación.')
    challenges.delete(challengeId)
    const user = { id: 'u1', email: MOCK_ADMIN.email, name: MOCK_ADMIN.name }
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({ ...user, expires: Date.now() + 8 * 3600_000 }))
    return HttpResponse.json({ user })
  }),

  http.get('/api/admin/auth/session', async () => {
    await delay(150)
    const u = sessionUser()
    if (!u) return err(401, 'unauthenticated', 'No hay sesión.')
    return HttpResponse.json({ user: { id: 'u1', email: u.email, name: u.name } })
  }),

  http.post('/api/admin/auth/logout', () => {
    sessionStorage.removeItem(SESSION_KEY)
    return new HttpResponse(null, { status: 204 })
  }),

  // ---------------- admin bookings ----------------
  http.get('/api/admin/bookings', async () => {
    await delay(300)
    const a = requireAdmin()
    if (a.error) return a.error
    return HttpResponse.json(db.bookings)
  }),

  http.get('/api/admin/bookings/:id', async ({ params }) => {
    await delay(200)
    const a = requireAdmin()
    if (a.error) return a.error
    const b = db.bookings.find((x) => x.id === params.id)
    return b ? HttpResponse.json(b) : err(404, 'not_found', 'Reserva no encontrada.')
  }),

  http.post('/api/admin/bookings/:id/transitions', async ({ params, request }) => {
    await delay(400)
    const a = requireAdmin()
    if (a.error) return a.error
    const b = db.bookings.find((x) => x.id === params.id)
    if (!b) return err(404, 'not_found', 'Reserva no encontrada.')
    try {
      applyTransition(b, (await request.json()) as TransitionPayload, a.user.name)
    } catch (e) {
      if (e instanceof RuleError) return err(409, e.code, e.message)
      throw e
    }
    persist()
    return HttpResponse.json(b)
  }),

  http.patch('/api/admin/bookings/:id', async ({ params, request }) => {
    await delay(250)
    const a = requireAdmin()
    if (a.error) return a.error
    const b = db.bookings.find((x) => x.id === params.id)
    if (!b) return err(404, 'not_found', 'Reserva no encontrada.')
    const patch = (await request.json()) as { keys?: Booking['keys']; internalNotes?: string; paymentProofVerified?: boolean }
    if (patch.keys) b.keys = patch.keys
    if (patch.internalNotes !== undefined) b.internalNotes = patch.internalNotes.slice(0, 4000)
    if (patch.paymentProofVerified !== undefined && b.paymentProof) b.paymentProof.verified = patch.paymentProofVerified
    b.updatedAt = new Date().toISOString()
    persist()
    return HttpResponse.json(b)
  }),

  // ---------------- admin ledger ----------------
  http.get('/api/admin/ledger', async () => {
    await delay(250)
    const a = requireAdmin()
    if (a.error) return a.error
    return HttpResponse.json(db.ledger)
  }),

  http.post('/api/admin/ledger', async ({ request }) => {
    await delay(300)
    const a = requireAdmin()
    if (a.error) return a.error
    const entry = (await request.json()) as NewLedgerEntry
    if (!(entry.amount > 0)) return err(422, 'validation', 'El importe debe ser mayor que 0.')
    const created = addLedgerEntry(entry, a.user.name)
    persist()
    return HttpResponse.json(created, { status: 201 })
  }),

  http.delete('/api/admin/ledger/:id', async ({ params }) => {
    await delay(200)
    const a = requireAdmin()
    if (a.error) return a.error
    const i = db.ledger.findIndex((e) => e.id === params.id)
    if (i < 0) return err(404, 'not_found', 'Movimiento no encontrado.')
    if (db.ledger[i]!.automatic) return err(409, 'automatic', 'Los movimientos generados por reservas no se pueden borrar.')
    db.ledger.splice(i, 1)
    persist()
    return new HttpResponse(null, { status: 204 })
  }),
]
