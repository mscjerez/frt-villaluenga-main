import { api } from './client'
import type { Booking, KeysStatus, TransitionPayload } from '@/domain/booking'
import type { LedgerEntry, NewLedgerEntry } from '@/domain/finance'

export interface AdminUser {
  id: string
  email: string
  name: string
}

export type LoginResponse = { mfaRequired: true; challengeId: string }

export interface BookingPatch {
  keys?: KeysStatus
  internalNotes?: string
  paymentProofVerified?: boolean
}

export const adminApi = {
  login: (email: string, password: string) => api.post<LoginResponse>('/api/admin/auth/login', { email, password }),
  verifyMfa: (challengeId: string, code: string) => api.post<{ user: AdminUser }>('/api/admin/auth/mfa', { challengeId, code }),
  session: () => api.get<{ user: AdminUser }>('/api/admin/auth/session'),
  logout: () => api.post<void>('/api/admin/auth/logout'),

  bookings: () => api.get<Booking[]>('/api/admin/bookings'),
  booking: (id: string) => api.get<Booking>(`/api/admin/bookings/${id}`),
  transition: (id: string, payload: TransitionPayload) => api.post<Booking>(`/api/admin/bookings/${id}/transitions`, payload),
  updateBooking: (id: string, patch: BookingPatch) => api.patch<Booking>(`/api/admin/bookings/${id}`, patch as Record<string, unknown>),

  ledger: () => api.get<LedgerEntry[]>('/api/admin/ledger'),
  addLedgerEntry: (entry: NewLedgerEntry) => api.post<LedgerEntry>('/api/admin/ledger', entry as unknown as Record<string, unknown>),
  deleteLedgerEntry: (id: string) => api.del<void>(`/api/admin/ledger/${id}`),
}
