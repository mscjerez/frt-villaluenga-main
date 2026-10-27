import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { adminApi, type BookingPatch } from '@/api/admin'
import type { Booking, TransitionPayload } from '@/domain/booking'
import type { NewLedgerEntry } from '@/domain/finance'

export const useBookings = () => useQuery({ queryKey: ['admin', 'bookings'], queryFn: adminApi.bookings })

export const useBooking = (id: string) => {
  const qc = useQueryClient()
  return useQuery({
    queryKey: ['admin', 'booking', id],
    queryFn: () => adminApi.booking(id),
    initialData: () => qc.getQueryData<Booking[]>(['admin', 'bookings'])?.find((b) => b.id === id),
  })
}

export const useLedger = () => useQuery({ queryKey: ['admin', 'ledger'], queryFn: adminApi.ledger })

function useBookingUpdated() {
  const qc = useQueryClient()
  return (b: Booking) => {
    qc.setQueryData(['admin', 'booking', b.id], b)
    qc.setQueryData<Booking[]>(['admin', 'bookings'], (list) => list?.map((x) => (x.id === b.id ? b : x)))
    qc.invalidateQueries({ queryKey: ['admin', 'ledger'] })
    qc.invalidateQueries({ queryKey: ['availability'] })
  }
}

export const useTransition = (id: string) => {
  const onSuccess = useBookingUpdated()
  return useMutation({ mutationFn: (p: TransitionPayload) => adminApi.transition(id, p), onSuccess })
}

export const useUpdateBooking = (id: string) => {
  const onSuccess = useBookingUpdated()
  return useMutation({ mutationFn: (p: BookingPatch) => adminApi.updateBooking(id, p), onSuccess })
}

export const useAddEntry = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (e: NewLedgerEntry) => adminApi.addLedgerEntry(e),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'ledger'] }),
  })
}

export const useDeleteEntry = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => adminApi.deleteLedgerEntry(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'ledger'] }),
  })
}
