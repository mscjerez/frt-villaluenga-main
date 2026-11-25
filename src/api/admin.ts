import { api } from './client'
import type { Booking, BookingComment, DateBlock, KeysStatus, ManualBookingRequest, NewDateBlock, TransitionPayload } from '@/domain/booking'
import type { SiteBanner, SiteBannerInput } from '@/domain/settings'
import type { LedgerEntry, NewLedgerEntry } from '@/domain/finance'

export interface AdminUser {
  id: string
  email: string
  name: string
}

export type MfaMethod = 'totp' | 'email'

/** `method` says where the code comes from: the authenticator app or an email we just sent. */
export type LoginResponse = { mfaRequired: true; challengeId: string; method: MfaMethod }

export interface AdminAccount {
  id: string
  email: string
  name: string
  mfaMethod: MfaMethod
  /** invited: the email link hasn't been used yet; expired: the link ran out, resend it. */
  status: 'active' | 'invited' | 'expired'
  invitedBy: string | null
  createdAt: string
  isMe: boolean
}

export interface BookingPatch {
  keys?: KeysStatus
  internalNotes?: string
  paymentProofVerified?: boolean
  free?: boolean
}

export interface SystemInfo {
  api: { version: string; commit: string; startedAt: string; node: string }
}

export const adminApi = {
  login: (email: string, password: string) => api.post<LoginResponse>('/admin/auth/login', { email, password }),
  verifyMfa: (challengeId: string, code: string) => api.post<{ user: AdminUser }>('/admin/auth/mfa', { challengeId, code }),
  session: () => api.get<{ user: AdminUser }>('/admin/auth/session'),
  logout: () => api.post<void>('/admin/auth/logout'),
  invitation: (token: string) => api.post<{ email: string; name: string }>('/admin/auth/invitation', { token }),
  acceptInvitation: (token: string, password: string) => api.post<{ email: string }>('/admin/auth/invitation/accept', { token, password }),

  admins: () => api.get<AdminAccount[]>('/admin/admins'),
  inviteAdmin: (name: string, email: string) => api.post<AdminAccount>('/admin/admins', { name, email }),
  resendInvitation: (id: string) => api.post<void>(`/admin/admins/${id}/invitation`),
  deleteAdmin: (id: string) => api.del<void>(`/admin/admins/${id}`),

  bookings: () => api.get<Booking[]>('/admin/bookings'),
  booking: (id: string) => api.get<Booking>(`/admin/bookings/${id}`),
  createBooking: (data: ManualBookingRequest) => api.post<Booking>('/admin/bookings', data as unknown as Record<string, unknown>),
  transition: (id: string, payload: TransitionPayload) => api.post<Booking>(`/admin/bookings/${id}/transitions`, payload),
  updateBooking: (id: string, patch: BookingPatch) => api.patch<Booking>(`/admin/bookings/${id}`, patch as Record<string, unknown>),

  addComment: (id: string, text: string) => api.post<Booking>(`/admin/bookings/${id}/comments`, { text }),
  deleteComment: (id: string, commentId: BookingComment['id']) => api.del<Booking>(`/admin/bookings/${id}/comments/${commentId}`),

  blocks: () => api.get<DateBlock[]>('/admin/blocks'),
  addBlock: (block: NewDateBlock) => api.post<DateBlock>('/admin/blocks', block as unknown as Record<string, unknown>),
  deleteBlock: (id: string) => api.del<void>(`/admin/blocks/${id}`),

  banner: () => api.get<SiteBanner>('/admin/banner'),
  saveBanner: (banner: SiteBannerInput) => api.put<SiteBanner>('/admin/banner', banner as unknown as Record<string, unknown>),

  system: () => api.get<SystemInfo>('/admin/system'),

  ledger: () => api.get<LedgerEntry[]>('/admin/ledger'),
  addLedgerEntry: (entry: NewLedgerEntry) => api.post<LedgerEntry>('/admin/ledger', entry as unknown as Record<string, unknown>),
  deleteLedgerEntry: (id: string) => api.del<void>(`/admin/ledger/${id}`),
}
