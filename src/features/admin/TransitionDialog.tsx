import { useState, type FormEvent } from 'react'
import { prices } from '@/config/site'
import { statusMeta, transitionLabel, type Booking, type BookingStatus, type TransitionPayload } from '@/domain/booking'
import { ApiError } from '@/api/client'
import { money, toISODate } from '@/lib/format'
import { Alert, Button, Dialog, Field, Input, Select, Textarea } from '@/components/ui'
import { useTransition } from './queries'

const cancelReasons = ['El grupo cancela la estancia', 'Fechas no disponibles', 'No se recibió el pago a tiempo', 'Actividad no adecuada para la casa', 'Otro motivo']

export function TransitionDialog({ booking: b, to, onClose }: { booking: Booking; to: BookingStatus | null; onClose: () => void }) {
  return (
    <Dialog open={!!to} onClose={onClose} title={to ? transitionLabel[to] : ''} description={to ? `${b.organization}. Pasará a "${statusMeta[to].label}".` : undefined}>
      {to && <TransitionForm key={to} booking={b} to={to} onClose={onClose} />}
    </Dialog>
  )
}

function TransitionForm({ booking: b, to, onClose }: { booking: Booking; to: BookingStatus; onClose: () => void }) {
  const mutation = useTransition(b.id)
  const paid = b.amountPaid ?? 0
  const [amount, setAmount] = useState(() => {
    if (to === 'pending_payment') return String(b.estimatedTotal)
    if (to === 'confirmed') return String(b.amountDue ?? b.estimatedTotal)
    return ''
  })
  const [date, setDate] = useState(toISODate(new Date()))
  const [note, setNote] = useState('')
  const [reasonPick, setReasonPick] = useState(cancelReasons[0]!)
  const [deposit, setDeposit] = useState(String(paid > 0 ? Math.min(prices.deposit, paid) : 0))
  const [payment, setPayment] = useState(String(b.status === 'cancelled' ? Math.max(0, paid - prices.deposit) : 0))
  const [retained, setRetained] = useState('0')
  const [error, setError] = useState<string | null>(null)

  const num = (s: string) => Number(s.replace(',', '.'))

  const submit = (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    let payload: TransitionPayload
    switch (to) {
      case 'pending_payment':
        if (!(num(amount) > 0)) return setError('Indica un importe mayor que 0.')
        payload = { to, amountDue: num(amount), note: note.trim() || undefined }
        break
      case 'confirmed':
        if (!(num(amount) > 0)) return setError('Indica el importe recibido.')
        payload = { to, amountPaid: num(amount), paidAt: date, note: note.trim() || undefined }
        break
      case 'cancelled': {
        const reason = reasonPick === 'Otro motivo' ? note.trim() : [reasonPick, note.trim()].filter(Boolean).join('. ')
        if (!reason) return setError('Explica el motivo de la cancelación.')
        payload = { to, reason }
        break
      }
      case 'refund':
        if (num(deposit) < 0 || num(payment) < 0 || num(deposit) + num(payment) <= 0) return setError('Indica qué importe hay que devolver.')
        if (num(deposit) + num(payment) > paid) return setError(`No se puede devolver más de lo cobrado (${money(paid)}).`)
        if (!note.trim()) return setError('Indica el motivo de la devolución.')
        payload = { to, deposit: num(deposit), payment: num(payment), reason: note.trim() }
        break
      case 'completed':
        if (num(retained) < 0 || num(retained) > prices.deposit) return setError(`La fianza retenida debe estar entre 0 y ${prices.deposit} €.`)
        payload = { to, depositRetained: b.status === 'confirmed' ? num(retained) : undefined, note: note.trim() || undefined }
        break
      default:
        return
    }
    mutation.mutate(payload, { onSuccess: onClose })
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {to === 'pending_payment' && (
        <>
          <Field label="Importe que debe pagar el grupo (€)" hint={`Estimación de la web: ${money(b.estimatedTotal)}, fianza incluida.`}>
            {(p) => <Input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus {...p} />}
          </Field>
          <Field label="Mensaje para el grupo" optional>
            {(p) => <Textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} {...p} />}
          </Field>
        </>
      )}

      {to === 'confirmed' && (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Importe recibido (€)">{(p) => <Input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus {...p} />}</Field>
            <Field label="Fecha del pago">{(p) => <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} {...p} />}</Field>
          </div>
          <p className="text-xs text-ink-soft">Se registran automáticamente en finanzas: {money(Math.min(prices.deposit, num(amount) || 0))} como fianza y el resto como ingreso.</p>
          <Field label="Nota" optional>
            {(p) => <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} {...p} />}
          </Field>
        </>
      )}

      {to === 'cancelled' && (
        <>
          <Field label="Motivo">
            {(p) => (
              <Select value={reasonPick} onChange={(e) => setReasonPick(e.target.value)} {...p}>
                {cancelReasons.map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </Select>
            )}
          </Field>
          <Field label={reasonPick === 'Otro motivo' ? 'Explica el motivo' : 'Detalles'} optional={reasonPick !== 'Otro motivo'}>
            {(p) => <Textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} {...p} />}
          </Field>
          {paid > 0 && <Alert tone="amber">El grupo ya pagó {money(paid)}. Después de cancelar podrás iniciar la devolución.</Alert>}
        </>
      )}

      {to === 'refund' && (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Fianza a devolver (€)">{(p) => <Input inputMode="decimal" value={deposit} onChange={(e) => setDeposit(e.target.value)} {...p} />}</Field>
            <Field label="Pago a devolver (€)">{(p) => <Input inputMode="decimal" value={payment} onChange={(e) => setPayment(e.target.value)} {...p} />}</Field>
          </div>
          <p className="text-xs text-ink-soft">Cobrado: {money(paid)}. El movimiento se registra en finanzas al marcar la devolución como hecha.</p>
          <Field label="Motivo">
            {(p) => <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Devolución de fianza tras la estancia" {...p} />}
          </Field>
        </>
      )}

      {to === 'completed' && (
        <>
          {b.status === 'refund' && b.refund && (
            <Alert tone="violet">
              Confirmas que ya has devuelto {money(b.refund.deposit + b.refund.payment)} por transferencia. Se anotará en finanzas con fecha de hoy.
            </Alert>
          )}
          {b.status === 'confirmed' && (
            <Field label="Fianza retenida por daños (€)" hint="Déjalo en 0 si la fianza se devolvió en mano. Si hay que hacer una transferencia, usa 'Iniciar devolución'.">
              {(p) => <Input inputMode="decimal" value={retained} onChange={(e) => setRetained(e.target.value)} {...p} />}
            </Field>
          )}
          <Field label="Nota" optional>
            {(p) => <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} {...p} />}
          </Field>
        </>
      )}

      {(error || mutation.isError) && <Alert>{error ?? (mutation.error instanceof ApiError ? mutation.error.message : 'No se ha podido guardar.')}</Alert>}
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="ghost" onClick={onClose}>
          Volver
        </Button>
        <Button type="submit" variant={to === 'cancelled' ? 'danger' : 'primary'} loading={mutation.isPending}>
          {transitionLabel[to]}
        </Button>
      </div>
    </form>
  )
}
