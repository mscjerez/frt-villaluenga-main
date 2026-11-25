import { useCallback, useRef, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import { useMutation } from '@tanstack/react-query'
import { Search } from 'lucide-react'
import { publicApi } from '@/api/public'
import { ApiError } from '@/api/client'
import { site } from '@/config/site'
import { Alert, Button, Field, Input } from '@/components/ui'
import { Captcha, type CaptchaHandle } from './Captcha'

/** Finds a booking by its reference and opens its tracking page. */
export function LookupPage() {
  const navigate = useNavigate()
  const [reference, setReference] = useState('')
  const [error, setError] = useState<string>()
  const [captcha, setCaptcha] = useState<string | null>(null)
  const onToken = useCallback((t: string | null) => setCaptcha(t), [])
  const captchaRef = useRef<CaptchaHandle>(null)

  const find = useMutation({
    mutationFn: () => publicApi.lookup(reference.trim(), captcha ?? ''),
    onSuccess: ({ trackingToken }) => navigate(`/reservas/${trackingToken}`),
    onError: () => captchaRef.current?.reset(),
  })

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const invalid = !/^[a-z]{3}\W*\d{2}\W*\d{1,4}$/i.test(reference.trim())
    setError(invalid ? 'Escribe la referencia completa, por ejemplo RCC-26-0012.' : undefined)
    if (!invalid && captcha) find.mutate()
  }

  return (
    <div className="mx-auto max-w-xl px-4 py-12 sm:px-6 sm:py-16">
      <h1 className="text-4xl font-bold tracking-tight">Mi reserva</h1>
      <p className="mt-3 leading-relaxed text-ink-soft">
        Consulta el estado de tu reserva, lee los mensajes de la casa y sube el justificante de pago. Encontrarás la referencia en el correo que te
        enviamos al hacer la solicitud.
      </p>

      <form onSubmit={submit} noValidate className="mt-8 space-y-5 rounded-2xl border border-piedra-200 bg-paper p-6">
        <Field label="Referencia de la reserva" hint="Empieza por RCC, por ejemplo RCC-26-0012." error={error}>
          {(p) => (
            <Input
              value={reference}
              onChange={(e) => setReference(e.target.value.toUpperCase())}
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              placeholder="RCC-26-0012"
              className="font-mono uppercase"
              {...p}
            />
          )}
        </Field>
        <Captcha ref={captchaRef} onToken={onToken} />
        {find.isError && (
          <Alert>
            {find.error instanceof ApiError ? find.error.message : 'No se ha podido buscar la reserva.'}
            {find.error instanceof ApiError && find.error.status === 429 && ' Has hecho demasiadas búsquedas; espera unos minutos.'}
          </Alert>
        )}
        <Button type="submit" loading={find.isPending} disabled={!captcha} className="w-full sm:w-auto">
          <Search className="size-4" aria-hidden />
          Buscar mi reserva
        </Button>
      </form>

      <p className="mt-6 text-sm text-ink-soft">
        ¿No tienes la referencia? Escríbenos a{' '}
        <a className="font-medium text-encina-600 underline" href={`mailto:${site.contactEmail}`}>
          {site.contactEmail}
        </a>
        .
      </p>
    </div>
  )
}
