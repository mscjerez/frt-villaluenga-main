import { api } from './client'
import type { AvailabilityRange, BookingRequest, PublicBooking } from '@/domain/booking'
import type { PublicBanner } from '@/domain/settings'

export interface CreateBookingResponse {
  reference: string
  trackingToken: string
}

export const publicApi = {
  availability: (from: string, to: string) =>
    api.get<AvailabilityRange[]>(`/public/availability?from=${from}&to=${to}`),

  banner: () => api.get<{ banner: PublicBanner | null }>('/public/banner'),

  createBooking: (data: BookingRequest, captchaToken: string, idempotencyKey: string, website: string, elapsedMs: number) =>
    api.post<CreateBookingResponse>(
      '/public/bookings',
      // `website` is a honeypot (must stay empty); `elapsedMs` lets the backend reject instant bot submissions.
      { ...data, captchaToken, website, elapsedMs },
      { 'Idempotency-Key': idempotencyKey },
    ),

  /** Finds a booking by its reference; returns its tracking token. */
  lookup: (reference: string, captchaToken: string) =>
    api.post<{ trackingToken: string }>('/public/bookings/lookup', { reference, captchaToken }),

  trackedBooking: (token: string) => api.get<PublicBooking>(`/public/bookings/${encodeURIComponent(token)}`),

  uploadPaymentProof: (token: string, file: File, captchaToken: string) => {
    const form = new FormData()
    form.append('file', file)
    form.append('captchaToken', captchaToken)
    return api.post<PublicBooking>(`/public/bookings/${encodeURIComponent(token)}/payment-proof`, form)
  },
}
