import { useCallback, useRef, useState } from 'react'
import { Link, useParams } from 'react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, Download, FileUp, Copy, MapPin } from 'lucide-react'
import { publicApi } from '@/api/public'
import { ApiError } from '@/api/client'
import { documents, site, transferConcept } from '@/config/site'
import { statusMeta, type BookingStatus, type PublicBooking } from '@/domain/booking'
import { fmtDate, fmtRange, money } from '@/lib/format'
import { cn } from '@/lib/cn'
import { Alert, Button, Spinner, StatusBadge } from '@/components/ui'
import { Captcha, type CaptchaHandle } from './Captcha'

const MAX_BYTES = 5 * 1024 * 1024
const ACCEPTED = ['application/pdf', 'image/jpeg', 'image/png']

export function TrackingPage() {
  const { token = '' } = useParams()
  const q = useQuery({ queryKey: ['tracking', token], queryFn: () => publicApi.trackedBooking(token) })

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
      {q.isLoading && <Spinner label="Buscando tu reserva" />}
      {q.isError && (
        <div className="py-12 text-center">
          <h1 className="text-3xl font-bold">No encontramos la reserva</h1>
          <p className="mt-3 text-ink-soft">
            {q.error instanceof ApiError && q.error.status === 404
              ? 'Comprueba que has copiado el enlace completo del correo.'
              : 'No hemos podido conectar. Inténtalo de nuevo en unos minutos.'}
          </p>
          <Link to="/" className="mt-6 inline-block font-medium text-encina-600 underline">
            Volver al inicio
          </Link>
        </div>
      )}
      {q.data && <Tracking booking={q.data} token={token} />}
    </div>
  )
}

const steps: { status: BookingStatus; label: string }[] = [
  { status: 'pending', label: 'Solicitud recibida' },
  { status: 'pending_payment', label: 'Aceptada, falta el pago' },
  { status: 'confirmed', label: 'Confirmada' },
  { status: 'completed', label: 'Estancia completada' },
]

function Tracking({ booking: b, token }: { booking: PublicBooking; token: string }) {
  const stepIndex = b.status === 'refund' ? 3 : steps.findIndex((s) => s.status === b.status)
  return (
    <>
      <p className="text-sm text-ink-soft">
        Reserva <span className="font-medium text-ink tabular">{b.reference}</span>
      </p>
      <h1 className="mt-1 text-4xl font-bold tracking-tight">{b.organization}</h1>
      <p className="mt-2 text-lg text-ink-soft">
        {fmtRange(b.arrivalDate, b.departureDate)} · {b.totalGuests} personas
      </p>
      <div className="mt-4">
        <StatusBadge status={b.status} />
      </div>

      {b.status === 'cancelled' ? (
        <Alert className="mt-8">Esta reserva está cancelada. Si crees que es un error, escríbenos a {site.contactEmail}.</Alert>
      ) : (
        <ol className="mt-10 grid gap-3 sm:grid-cols-4" aria-label="Progreso de la reserva">
          {steps.map((s, i) => {
            const done = i < stepIndex || (i === stepIndex && s.status === 'completed')
            const current = i === stepIndex && !done
            return (
              <li key={s.status} className={cn('rounded-xl border p-4 text-sm', current ? 'border-encina-600 bg-encina-50' : 'border-piedra-200 bg-paper')} aria-current={current ? 'step' : undefined}>
                <span
                  className={cn(
                    'grid size-7 place-items-center rounded-full text-xs font-semibold',
                    done ? 'bg-encina-600 text-white' : current ? 'bg-paper text-encina-700 ring-2 ring-encina-600' : 'bg-piedra-100 text-piedra-500',
                  )}
                >
                  {done ? <Check className="size-4" aria-hidden /> : i + 1}
                </span>
                <p className={cn('mt-3 font-medium', !done && !current && 'text-ink-soft')}>{s.label}</p>
              </li>
            )
          })}
        </ol>
      )}

      <div className="mt-10 space-y-6">
        {b.status === 'pending' && (
          <p className="leading-relaxed text-ink-soft">{statusMeta.pending.description} Te escribiremos en cuanto la revisemos, normalmente en pocos días.</p>
        )}
        {b.status === 'pending_payment' && <PaymentStep booking={b} token={token} />}
        {b.status === 'confirmed' && (
          <div className="rounded-2xl border border-encina-100 bg-encina-50 p-6">
            <h2 className="text-xl font-semibold">Todo listo</h2>
            <p className="mt-2 leading-relaxed text-ink-soft">
              Llegada el {fmtDate(b.arrivalDate, "EEEE d 'de' MMMM")} a las {b.arrivalTime}. Salida a las {b.departureTime}. Antes de venir te
              contactaremos para la entrega de llaves.
            </p>
            <a href={site.mapsUrl} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-encina-600 hover:underline">
              <MapPin className="size-4" aria-hidden />
              Ver la casa en Google Maps
            </a>
          </div>
        )}
        {b.status === 'refund' && <p className="leading-relaxed text-ink-soft">Estamos tramitando la devolución. La recibirás por transferencia en la cuenta desde la que pagaste.</p>}
        <div className="flex flex-wrap gap-3">
          {documents.map((d) => (
            <a key={d.id} href={d.href} download className="inline-flex h-10 items-center gap-2 rounded-lg px-4 text-sm font-medium ring-1 ring-inset ring-piedra-300 hover:bg-piedra-100">
              <Download className="size-4" aria-hidden />
              {d.title}
            </a>
          ))}
        </div>
      </div>
    </>
  )
}

function PaymentStep({ booking: b, token }: { booking: PublicBooking; token: string }) {
  const qc = useQueryClient()
  const [file, setFile] = useState<File | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)
  const [captcha, setCaptcha] = useState<string | null>(null)
  const onToken = useCallback((t: string | null) => setCaptcha(t), [])
  const captchaRef = useRef<CaptchaHandle>(null)

  const upload = useMutation({
    mutationFn: () => publicApi.uploadPaymentProof(token, file!, captcha ?? ''),
    onSuccess: (data) => qc.setQueryData(['tracking', token], data),
    onError: () => captchaRef.current?.reset(),
  })

  const pick = (f: File | undefined) => {
    setFileError(null)
    setFile(null)
    if (!f) return
    if (!ACCEPTED.includes(f.type)) return setFileError('Sube un PDF, JPG o PNG.')
    if (f.size > MAX_BYTES) return setFileError('El archivo pesa más de 5 MB.')
    setFile(f)
  }

  const amount = b.amountDue ?? b.estimatedTotal
  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-piedra-200 bg-paper p-6">
        <h2 className="text-xl font-semibold">Haz la transferencia</h2>
        <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
          <Copyable label="Importe" value={money(amount)} big />
          <Copyable label="Concepto" value={transferConcept(b.reference, b.organization)} />
          <Copyable label={`IBAN (${site.bankAccount.bank})`} value={site.bankAccount.iban} />
          <Copyable label="Titular" value={site.bankAccount.holder} />
        </dl>
        <p className="mt-4 text-xs text-ink-soft">
          Escribe el concepto tal cual: la referencia y el nombre del grupo nos permiten identificar el pago. El importe incluye la fianza, que te
          devolvemos después de la estancia.
        </p>
      </div>

      <form
        className="rounded-2xl border border-piedra-200 bg-paper p-6"
        onSubmit={(e) => {
          e.preventDefault()
          if (file && captcha) upload.mutate()
        }}
      >
        <h2 className="text-xl font-semibold">Sube el justificante</h2>
        <p className="mt-1 text-sm text-ink-soft">PDF, JPG o PNG de hasta 5 MB. Al subirlo, la reserva queda confirmada.</p>
        <label className="mt-5 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-piedra-300 px-4 py-8 text-center hover:border-encina-500 hover:bg-encina-50 focus-within:border-encina-600">
          <FileUp className="size-7 text-encina-600" aria-hidden />
          <span className="text-sm font-medium">{file ? file.name : 'Elegir archivo'}</span>
          <input type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" className="sr-only" onChange={(e) => pick(e.target.files?.[0])} />
        </label>
        {fileError && (
          <p role="alert" className="mt-2 text-sm text-busy">
            {fileError}
          </p>
        )}
        <div className="mt-5 space-y-4">
          <Captcha ref={captchaRef} onToken={onToken} />
          {upload.isError && <Alert>{upload.error instanceof ApiError ? upload.error.message : 'No se ha podido subir el archivo.'}</Alert>}
          <Button type="submit" loading={upload.isPending} disabled={!file || !captcha}>
            Enviar justificante
          </Button>
        </div>
      </form>
    </div>
  )
}

function Copyable({ label, value, big }: { label: string; value: string; big?: boolean }) {
  const [ok, setOk] = useState(false)
  return (
    <div>
      <dt className="text-ink-soft">{label}</dt>
      <dd className="mt-1 flex items-center gap-2">
        <span className={cn('tabular', big ? 'font-display text-2xl font-bold text-encina-700' : 'font-medium')}>{value}</span>
        <button
          type="button"
          className="rounded p-1 text-piedra-500 hover:bg-piedra-100 hover:text-ink"
          aria-label={`Copiar ${label.toLowerCase()}`}
          onClick={() => navigator.clipboard?.writeText(value).then(() => setOk(true), () => {})}
        >
          {ok ? <Check className="size-4 text-free" /> : <Copy className="size-4" />}
        </button>
      </dd>
    </div>
  )
}
