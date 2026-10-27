import { api } from './client'
import type { AvailabilityRange, BookingRequest, PublicBooking } from '@/domain/booking'

export interface CreateBookingResponse {
  reference: string
  trackingToken: string
}

export const publicApi = {
  availability: (from: string, to: string) =>
    api.get<AvailabilityRange[]>(`/api/public/availability?from=${from}&to=${to}`),

  createBooking: (data: BookingRequest, captchaToken: string, idempotencyKey: string, website: string, elapsedMs: number) =>
    api.post<CreateBookingResponse>(
      '/api/public/bookings',
      // `website` is a honeypot (must stay empty); `elapsedMs` lets the backend reject instant bot submissions.
      { ...data, captchaToken, website, elapsedMs },
      { 'Idempotency-Key': idempotencyKey },
    ),

  trackedBooking: (token: string) => api.get<PublicBooking>(`/api/public/bookings/${encodeURIComponent(token)}`),

  uploadPaymentProof: (token: string, file: File, captchaToken: string) => {
    const form = new FormData()
    form.append('file', file)
    form.append('captchaToken', captchaToken)
    return api.post<PublicBooking>(`/api/public/bookings/${encodeURIComponent(token)}/payment-proof`, form)
  },
}
