import { format } from 'date-fns'
import { http, HttpResponse, delay, type JsonBodyType } from 'msw'
import { addBlock, addComment, addLedgerEntry, applyTransition, availability, createBooking, db, findByToken, lookup, overlapsBlock, overlapsBusy, persist, RuleError } from './db'
import { MOCK_ADMIN } from './seed-credentials'
import type { BookingRequest, ManualBookingRequest, NewDateBlock, PublicBooking, TransitionPayload, Booking } from '@/domain/booking'
import { isBannerActive, type SiteBannerInput } from '@/domain/settings'
import { API_BASE as P } from '@/api/client'
import type { NewLedgerEntry } from '@/domain/finance'
import { isValidDniNie, isValidPhone } from '@/lib/validation'

const SESSION_KEY = 'rcc-mock-session'
const LOGIN_FAILS_KEY = 'rcc-mock-login-fails'
const MAX_FAILS = 5
const LOCK_MS = 15 * 60_000

const err = (status: number, code: string, message: string, extra: Record<string, unknown> = {}, headers?: HeadersInit) =>
  HttpResponse.json({ code, message, ...extra }, { status, headers })

const challenges = new Map<string, { email: string; expires: number; code?: string; attempts?: number }>()

// Admin accounts for the "Administradores" panel. Invited accounts log in with an emailed code; in the mock the
// "email" is the browser console.
interface MockAdmin {
  id: string
  email: string
  name: string
  password: string | null
  mfaMethod: 'totp' | 'email'
  inviteToken: string | null
  inviteExpires: number
  invitedBy: string | null
  createdAt: string
}
const mockAdmins: MockAdmin[] = [
  {
    id: 'u1',
    email: MOCK_ADMIN.email,
    name: MOCK_ADMIN.name,
    password: MOCK_ADMIN.password,
    mfaMethod: 'totp',
    inviteToken: null,
    inviteExpires: 0,
    invitedBy: null,
    createdAt: '2026-01-01T10:00:00.000Z',
  },
]
const accountView = (a: MockAdmin, meEmail: string) => ({
  id: a.id,
  email: a.email,
  name: a.name,
  mfaMethod: a.mfaMethod,
  status: a.password ? 'active' : a.inviteExpires > Date.now() ? 'invited' : 'expired',
  invitedBy: a.invitedBy,
  createdAt: a.createdAt,
  isMe: a.email === meEmail,
})
function mockInvite(a: MockAdmin, by: string) {
  a.inviteToken = crypto.randomUUID()
  a.inviteExpires = Date.now() + 24 * 3600_000
  a.invitedBy = by
  console.info(`[mock email] Invitación para ${a.email}: ${location.origin}${import.meta.env.BASE_URL}admin/activar#${a.inviteToken}`)
}
const invitationErr = () => err(410, 'invitation_invalid', 'El enlace de activación no es válido o ha caducado. Pide que te envíen uno nuevo.')

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
    free: b.free,
    cancelReason: b.status === 'cancelled' ? b.cancelReason : null,
    paymentProof: b.paymentProof,
    timeline: b.history.filter((h) => h.from !== h.to).map((h) => ({ at: h.at, status: h.to })),
    comments: b.comments.map((c) => ({ at: c.at, text: c.text })),
  }
}

const seenIdempotency = new Map<string, unknown>()

export const handlers = [
  // ---------------- public ----------------
  http.get(`${P}/public/availability`, async ({ request }) => {
    await delay(250)
    const url = new URL(request.url)
    return HttpResponse.json(availability(url.searchParams.get('from') ?? '0000', url.searchParams.get('to') ?? '9999'))
  }),

  http.get(`${P}/public/banner`, async () => {
    await delay(150)
    const b = db.banner
    return HttpResponse.json({ banner: isBannerActive(b, format(new Date(), 'yyyy-MM-dd')) ? { tone: b.tone, title: b.title, message: b.message } : null })
  }),

  http.post(`${P}/public/bookings`, async ({ request }) => {
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
    if (overlapsBusy(body.arrivalDate, body.departureDate) || overlapsBlock(body.arrivalDate, body.departureDate))
      return err(409, 'dates_taken', 'Alguna de las fechas elegidas ya está ocupada. Elige otras en el calendario.')

    const { acceptPrivacy: _a, acceptRules: _r, captchaToken: _c, website: _w, elapsedMs: _e, ...data } = body
    const { booking, token } = createBooking(data)
    persist()
    const res = { reference: booking.reference, trackingToken: token }
    if (key) seenIdempotency.set(key, res)
    console.info('[mock] Enlace de seguimiento:', `${location.origin}${import.meta.env.BASE_URL}reservas/${token}`)
    return HttpResponse.json(res, { status: 201 })
  }),

  http.post(`${P}/public/bookings/lookup`, async ({ request }) => {
    await delay(500) // the real backend must also rate-limit this per IP (enumeration)
    const { reference = '', captchaToken } = (await request.json()) as { reference?: string; captchaToken?: string }
    if (!captchaToken) return err(400, 'captcha', 'Completa la verificación anti-spam.')
    const b = lookup(reference)
    if (!b) return err(404, 'not_found', 'No hay ninguna reserva con ese número. Revisa que esté completo.')
    return HttpResponse.json({ trackingToken: b.trackingToken })
  }),

  http.get(`${P}/public/bookings/:token`, async ({ params }) => {
    await delay(300)
    const b = findByToken(String(params.token))
    if (!b) return err(404, 'not_found', 'No encontramos ninguna reserva con este enlace.')
    return HttpResponse.json(toPublic(b))
  }),

  http.post(`${P}/public/bookings/:token/payment-proof`, async ({ params, request }) => {
    await delay(900)
    const b = findByToken(String(params.token))
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
  http.post(`${P}/admin/auth/login`, async ({ request }) => {
    await delay(600) // constant-ish delay, the real backend should also hash even for unknown users
    const fails = JSON.parse(localStorage.getItem(LOGIN_FAILS_KEY) ?? '{"n":0,"until":0}') as { n: number; until: number }
    if (fails.until > Date.now()) {
      const secs = Math.ceil((fails.until - Date.now()) / 1000)
      return err(429, 'locked', 'Demasiados intentos fallidos. Espera unos minutos antes de volver a probar.', {}, { 'Retry-After': String(secs) })
    }
    const { email, password } = (await request.json()) as { email: string; password: string }
    const account = mockAdmins.find((a) => a.email === email.trim().toLowerCase())
    if (!account?.password || password !== account.password) {
      fails.n++
      if (fails.n >= MAX_FAILS) Object.assign(fails, { n: 0, until: Date.now() + LOCK_MS })
      localStorage.setItem(LOGIN_FAILS_KEY, JSON.stringify(fails))
      return err(401, 'invalid_credentials', 'Correo o contraseña incorrectos.')
    }
    localStorage.removeItem(LOGIN_FAILS_KEY)
    const challengeId = crypto.randomUUID()
    if (account.mfaMethod === 'email') {
      const code = String(Math.floor(Math.random() * 1_000_000)).padStart(6, '0')
      challenges.set(challengeId, { email: account.email, expires: Date.now() + 3 * 60_000, code })
      console.info(`[mock email] Código de acceso para ${account.email}: ${code}`)
      return HttpResponse.json({ mfaRequired: true, challengeId, method: 'email' })
    }
    challenges.set(challengeId, { email: account.email, expires: Date.now() + 5 * 60_000 })
    return HttpResponse.json({ mfaRequired: true, challengeId, method: 'totp' })
  }),

  http.post(`${P}/admin/auth/mfa`, async ({ request }) => {
    await delay(400)
    const { challengeId, code } = (await request.json()) as { challengeId: string; code: string }
    const ch = challenges.get(challengeId)
    if (!ch || ch.expires < Date.now()) return err(401, 'challenge_expired', 'El inicio de sesión ha caducado. Vuelve a introducir tu contraseña.')
    if (ch.code && code !== ch.code) {
      const left = 3 - (ch.attempts = (ch.attempts ?? 0) + 1)
      if (left <= 0) {
        challenges.delete(challengeId)
        return err(401, 'challenge_expired', 'Has agotado los intentos. Vuelve a introducir tu contraseña para recibir un código nuevo.')
      }
      return err(401, 'invalid_code', `Código incorrecto. Usa el último código que te hemos enviado por correo. Te ${left === 1 ? 'queda 1 intento' : `quedan ${left} intentos`}.`)
    }
    if (!ch.code && code !== MOCK_ADMIN.totp) return err(401, 'invalid_code', 'Código incorrecto. Usa el código actual de tu app de autenticación.')
    challenges.delete(challengeId)
    const account = mockAdmins.find((a) => a.email === ch.email)!
    const user = { id: account.id, email: account.email, name: account.name }
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({ ...user, expires: Date.now() + 8 * 3600_000 }))
    return HttpResponse.json({ user })
  }),

  http.get(`${P}/admin/auth/session`, async () => {
    await delay(150)
    const u = sessionUser()
    if (!u) return err(401, 'unauthenticated', 'No hay sesión.')
    return HttpResponse.json({ user: { id: mockAdmins.find((a) => a.email === u.email)?.id ?? 'u1', email: u.email, name: u.name } })
  }),

  http.post(`${P}/admin/auth/logout`, () => {
    sessionStorage.removeItem(SESSION_KEY)
    return new HttpResponse(null, { status: 204 })
  }),

  http.post(`${P}/admin/auth/invitation`, async ({ request }) => {
    await delay(300)
    const { token } = (await request.json()) as { token: string }
    const a = mockAdmins.find((x) => x.inviteToken === token && x.inviteExpires > Date.now() && !x.password)
    return a ? HttpResponse.json({ email: a.email, name: a.name }) : invitationErr()
  }),

  http.post(`${P}/admin/auth/invitation/accept`, async ({ request }) => {
    await delay(500)
    const { token, password } = (await request.json()) as { token: string; password: string }
    const a = mockAdmins.find((x) => x.inviteToken === token && x.inviteExpires > Date.now() && !x.password)
    if (!a) return invitationErr()
    if (password.length < 12) return err(422, 'validation', 'Usa al menos 12 caracteres.', { fieldErrors: { password: 'Usa al menos 12 caracteres.' } })
    Object.assign(a, { password, inviteToken: null, inviteExpires: 0 })
    return HttpResponse.json({ email: a.email })
  }),

  // ---------------- admin accounts ----------------
  http.get(`${P}/admin/admins`, async () => {
    await delay(250)
    const auth = requireAdmin()
    if (auth.error) return auth.error
    return HttpResponse.json(mockAdmins.map((a) => accountView(a, auth.user.email)))
  }),

  http.post(`${P}/admin/admins`, async ({ request }) => {
    await delay(500)
    const auth = requireAdmin()
    if (auth.error) return auth.error
    const body = (await request.json()) as { name: string; email: string }
    const email = body.email.trim().toLowerCase()
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return err(422, 'validation', 'Revisa los campos marcados.', { fieldErrors: { email: 'Correo electrónico no válido.' } })
    if (body.name.trim().length < 2) return err(422, 'validation', 'Revisa los campos marcados.', { fieldErrors: { name: 'Escribe el nombre.' } })
    if (mockAdmins.some((a) => a.email === email)) return err(409, 'admin_exists', 'Ya existe un administrador con ese correo.')
    const a: MockAdmin = {
      id: crypto.randomUUID(),
      email,
      name: body.name.trim(),
      password: null,
      mfaMethod: 'email',
      inviteToken: null,
      inviteExpires: 0,
      invitedBy: null,
      createdAt: new Date().toISOString(),
    }
    mockAdmins.push(a)
    mockInvite(a, auth.user.name)
    return HttpResponse.json(accountView(a, auth.user.email), { status: 201 })
  }),

  http.post(`${P}/admin/admins/:id/invitation`, async ({ params }) => {
    await delay(400)
    const auth = requireAdmin()
    if (auth.error) return auth.error
    const a = mockAdmins.find((x) => x.id === params.id)
    if (!a) return err(404, 'not_found', 'Administrador no encontrado.')
    if (a.password) return err(409, 'already_active', 'Esa cuenta ya está activada.')
    mockInvite(a, auth.user.name)
    return new HttpResponse(null, { status: 204 })
  }),

  http.delete(`${P}/admin/admins/:id`, async ({ params }) => {
    await delay(300)
    const auth = requireAdmin()
    if (auth.error) return auth.error
    const i = mockAdmins.findIndex((x) => x.id === params.id)
    if (i < 0) return err(404, 'not_found', 'Administrador no encontrado.')
    if (mockAdmins[i]!.email === auth.user.email) return err(409, 'self_delete', 'No puedes eliminar tu propia cuenta.')
    mockAdmins.splice(i, 1)
    return new HttpResponse(null, { status: 204 })
  }),

  // ---------------- admin bookings ----------------
  http.get(`${P}/admin/bookings`, async () => {
    await delay(300)
    const a = requireAdmin()
    if (a.error) return a.error
    return HttpResponse.json(db.bookings)
  }),

  http.post(`${P}/admin/bookings`, async ({ request }) => {
    await delay(500)
    const a = requireAdmin()
    if (a.error) return a.error
    const { free, internalNotes, notifyGroup, ...data } = (await request.json()) as ManualBookingRequest
    const fieldErrors: Record<string, string> = {}
    if (data.dni && !isValidDniNie(data.dni)) fieldErrors.dni = 'DNI o NIE no válido.'
    if (!isValidPhone(data.phone)) fieldErrors.phone = 'Teléfono no válido.'
    if (notifyGroup && !data.email) fieldErrors.email = 'Hace falta un correo para enviar el enlace.'
    if (data.departureDate < data.arrivalDate) fieldErrors.departureDate = 'La salida no puede ser antes de la llegada.'
    if (Object.keys(fieldErrors).length) return err(422, 'validation', 'Revisa los campos marcados.', { fieldErrors })
    if (overlapsBusy(data.arrivalDate, data.departureDate) || overlapsBlock(data.arrivalDate, data.departureDate))
      return err(409, 'dates_taken', 'Alguna de las fechas elegidas ya está ocupada. Elige otras en el calendario.')
    const { booking } = createBooking(data, new Date(), { by: a.user.name, note: 'Creada desde el panel', free, internalNotes })
    persist()
    if (notifyGroup) console.info('[mock] Enlace enviado a', data.email, `${location.origin}${import.meta.env.BASE_URL}reservas/${booking.trackingToken}`)
    return HttpResponse.json(booking, { status: 201 })
  }),

  http.get(`${P}/admin/bookings/:id`, async ({ params }) => {
    await delay(200)
    const a = requireAdmin()
    if (a.error) return a.error
    const b = db.bookings.find((x) => x.id === params.id)
    return b ? HttpResponse.json(b) : err(404, 'not_found', 'Reserva no encontrada.')
  }),

  http.post(`${P}/admin/bookings/:id/transitions`, async ({ params, request }) => {
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

  http.patch(`${P}/admin/bookings/:id`, async ({ params, request }) => {
    await delay(250)
    const a = requireAdmin()
    if (a.error) return a.error
    const b = db.bookings.find((x) => x.id === params.id)
    if (!b) return err(404, 'not_found', 'Reserva no encontrada.')
    const patch = (await request.json()) as { keys?: Booking['keys']; internalNotes?: string; paymentProofVerified?: boolean; free?: boolean }
    if (patch.free !== undefined && patch.free !== b.free) {
      // Once paid, the ledger already holds the income: switching would leave finances inconsistent.
      if (b.status !== 'pending' && b.status !== 'pending_payment')
        return err(409, 'invalid_state', 'Solo se puede cambiar antes de registrar el pago.')
      b.free = patch.free
      b.history.push({ at: new Date().toISOString(), from: b.status, to: b.status, by: a.user.name, note: b.free ? 'Marcada como gratuita' : 'Ya no es gratuita' })
    }
    if (patch.keys) b.keys = patch.keys
    if (patch.internalNotes !== undefined) b.internalNotes = patch.internalNotes.slice(0, 4000)
    if (patch.paymentProofVerified !== undefined && b.paymentProof) b.paymentProof.verified = patch.paymentProofVerified
    b.updatedAt = new Date().toISOString()
    persist()
    return HttpResponse.json(b)
  }),

  http.get(`${P}/admin/bookings/:id/payment-proof`, async ({ params }) => {
    const a = requireAdmin()
    if (a.error) return a.error
    const b = db.bookings.find((x) => x.id === params.id)
    if (!b?.paymentProof) return err(404, 'not_found', 'Esta reserva no tiene justificante.')
    // The mock keeps no files: it serves a placeholder PDF.
    return new HttpResponse('%PDF-1.4\n% justificante de ejemplo\n', {
      headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="${b.paymentProof.fileName}"` },
    })
  }),

  http.post(`${P}/admin/bookings/:id/comments`, async ({ params, request }) => {
    await delay(250)
    const a = requireAdmin()
    if (a.error) return a.error
    const b = db.bookings.find((x) => x.id === params.id)
    if (!b) return err(404, 'not_found', 'Reserva no encontrada.')
    const { text = '' } = (await request.json()) as { text?: string }
    if (!text.trim()) return err(422, 'validation', 'Escribe el comentario.')
    addComment(b, text, a.user.name)
    persist()
    return HttpResponse.json(b, { status: 201 })
  }),

  http.delete(`${P}/admin/bookings/:id/comments/:commentId`, async ({ params }) => {
    await delay(200)
    const a = requireAdmin()
    if (a.error) return a.error
    const b = db.bookings.find((x) => x.id === params.id)
    if (!b) return err(404, 'not_found', 'Reserva no encontrada.')
    b.comments = b.comments.filter((c) => c.id !== params.commentId)
    persist()
    return HttpResponse.json(b)
  }),

  // ---------------- admin date blocks ----------------
  http.get(`${P}/admin/blocks`, async () => {
    await delay(200)
    const a = requireAdmin()
    if (a.error) return a.error
    return HttpResponse.json(db.blocks)
  }),

  http.post(`${P}/admin/blocks`, async ({ request }) => {
    await delay(300)
    const a = requireAdmin()
    if (a.error) return a.error
    try {
      const created = addBlock((await request.json()) as NewDateBlock, a.user.name)
      persist()
      return HttpResponse.json(created, { status: 201 })
    } catch (e) {
      if (e instanceof RuleError) return err(422, e.code, e.message)
      throw e
    }
  }),

  http.delete(`${P}/admin/blocks/:id`, async ({ params }) => {
    await delay(200)
    const a = requireAdmin()
    if (a.error) return a.error
    const i = db.blocks.findIndex((k) => k.id === params.id)
    if (i < 0) return err(404, 'not_found', 'Cierre no encontrado.')
    db.blocks.splice(i, 1)
    persist()
    return new HttpResponse(null, { status: 204 })
  }),

  // ---------------- admin settings ----------------
  http.get(`${P}/admin/banner`, async () => {
    await delay(200)
    const a = requireAdmin()
    if (a.error) return a.error
    return HttpResponse.json(db.banner)
  }),

  http.put(`${P}/admin/banner`, async ({ request }) => {
    await delay(300)
    const a = requireAdmin()
    if (a.error) return a.error
    const b = (await request.json()) as SiteBannerInput
    if (b.enabled && !b.message.trim()) return err(422, 'validation', 'Revisa los campos marcados.', { fieldErrors: { message: 'Escribe el texto del aviso.' } })
    if (b.startsOn && b.endsOn && b.endsOn < b.startsOn)
      return err(422, 'validation', 'Revisa los campos marcados.', { fieldErrors: { endsOn: 'La fecha final no puede ser anterior a la inicial.' } })
    db.banner = { ...b, title: b.title.trim(), message: b.message.trim(), updatedAt: new Date().toISOString(), updatedBy: a.user.name }
    persist()
    return HttpResponse.json(db.banner)
  }),

  http.get(`${P}/admin/system`, async () => {
    await delay(150)
    const a = requireAdmin()
    if (a.error) return a.error
    return HttpResponse.json({ api: { version: '0.0.0-mock', commit: '', startedAt: new Date().toISOString(), node: 'mock' } })
  }),

  // ---------------- admin ledger ----------------
  http.get(`${P}/admin/ledger`, async () => {
    await delay(250)
    const a = requireAdmin()
    if (a.error) return a.error
    return HttpResponse.json(db.ledger)
  }),

  http.post(`${P}/admin/ledger`, async ({ request }) => {
    await delay(300)
    const a = requireAdmin()
    if (a.error) return a.error
    const entry = (await request.json()) as NewLedgerEntry
    if (!(entry.amount > 0)) return err(422, 'validation', 'El importe debe ser mayor que 0.')
    const created = addLedgerEntry(entry, a.user.name)
    persist()
    return HttpResponse.json(created, { status: 201 })
  }),

  http.delete(`${P}/admin/ledger/:id`, async ({ params }) => {
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
