import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { adminApi, type BookingPatch } from '@/api/admin'
import type { Booking, ManualBookingRequest, NewDateBlock, TransitionPayload } from '@/domain/booking'
import type { SiteBannerInput } from '@/domain/settings'
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

export const useCreateBooking = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: ManualBookingRequest) => adminApi.createBooking(data),
    onSuccess: (b) => {
      qc.setQueryData(['admin', 'booking', b.id], b)
      qc.invalidateQueries({ queryKey: ['admin', 'bookings'] })
      qc.invalidateQueries({ queryKey: ['availability'] })
    },
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

export const useAddComment = (id: string) => {
  const onSuccess = useBookingUpdated()
  return useMutation({ mutationFn: (text: string) => adminApi.addComment(id, text), onSuccess })
}

export const useDeleteComment = (id: string) => {
  const onSuccess = useBookingUpdated()
  return useMutation({ mutationFn: (commentId: string) => adminApi.deleteComment(id, commentId), onSuccess })
}

export const useBlocks = () => useQuery({ queryKey: ['admin', 'blocks'], queryFn: adminApi.blocks })

function useBlocksChanged() {
  const qc = useQueryClient()
  return () => {
    qc.invalidateQueries({ queryKey: ['admin', 'blocks'] })
    qc.invalidateQueries({ queryKey: ['availability'] })
  }
}

export const useAddBlock = () => {
  const onSuccess = useBlocksChanged()
  return useMutation({ mutationFn: (b: NewDateBlock) => adminApi.addBlock(b), onSuccess })
}

export const useDeleteBlock = () => {
  const onSuccess = useBlocksChanged()
  return useMutation({ mutationFn: (id: string) => adminApi.deleteBlock(id), onSuccess })
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

export const useAdminBanner = () => useQuery({ queryKey: ['admin', 'banner'], queryFn: adminApi.banner })

export const useSaveBanner = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (b: SiteBannerInput) => adminApi.saveBanner(b),
    onSuccess: (b) => {
      qc.setQueryData(['admin', 'banner'], b)
      qc.invalidateQueries({ queryKey: ['banner'] })
    },
  })
}

export const useSystem = () => useQuery({ queryKey: ['admin', 'system'], queryFn: adminApi.system, staleTime: 5 * 60_000 })

export const useAdmins = () => useQuery({ queryKey: ['admin', 'admins'], queryFn: adminApi.admins })

export const useInviteAdmin = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ name, email }: { name: string; email: string }) => adminApi.inviteAdmin(name, email),
    // Also on error: a failed email still leaves the account created (resend from the list).
    onSettled: () => qc.invalidateQueries({ queryKey: ['admin', 'admins'] }),
  })
}

export const useResendInvitation = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => adminApi.resendInvitation(id),
    onSettled: () => qc.invalidateQueries({ queryKey: ['admin', 'admins'] }),
  })
}

export const useDeleteAdmin = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => adminApi.deleteAdmin(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'admins'] }),
  })
}
