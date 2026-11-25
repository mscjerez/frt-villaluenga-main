import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router'
import { eachDayOfInterval, parseISO, startOfToday } from 'date-fns'
import type { DateRange } from 'react-day-picker'
import { Check, Copy, AlertTriangle } from 'lucide-react'
import { publicApi, type CreateBookingResponse } from '@/api/public'
import { ApiError } from '@/api/client'
import { site } from '@/config/site'
import { cleanText, isValidDniNie, isValidPhone, normalizeDni } from '@/lib/validation'
import { toISODate } from '@/lib/format'
import { useAvailability } from '@/hooks/useAvailability'
import { Alert, Button, Field, Input, Textarea } from '@/components/ui'
import { AvailabilityCalendar } from './AvailabilityCalendar'
import { PriceSummary } from './PriceSummary'
import { Captcha, type CaptchaHandle } from './Captcha'
import { trackingUrl, withBase } from '@/lib/base'

const int = (msg: string) => z.number({ error: msg }).int({ error: 'Usa un número entero.' })
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, { error: 'Indica la hora.' })
const text = (min: number, max: number, minMsg: string) =>
  z
    .string()
    .transform(cleanText)
    .pipe(z.string().min(min, { error: minMsg }).max(max, { error: `Máximo ${max} caracteres.` }))

const schema = z
  .object({
    arrivalDate: z.string().min(1, { error: 'Elige el día de llegada en el calendario.' }),
    departureDate: z.string().min(1, { error: 'Elige el día de salida.' }),
    arrivalTime: time,
    departureTime: time,
    organization: text(2, 120, 'Indica el nombre del grupo o entidad.'),
    responsibleName: text(3, 120, 'Indica el nombre y apellidos.'),
    dni: z.string().refine(isValidDniNie, { error: 'DNI o NIE no válido. Revisa los números y la letra.' }).transform(normalizeDni),
    phone: z.string().refine(isValidPhone, { error: 'Teléfono no válido. Ejemplo: 600 123 456.' }),
    email: z.email({ error: 'Correo electrónico no válido.' }).max(160),
    children: int('Indica cuántos niños y niñas vienen.').min(0, { error: 'No puede ser negativo.' }),
    monitors: int('Indica cuántos responsables vienen.').min(1, { error: 'Debe venir al menos una persona responsable.' }),
    totalGuests: int('Indica el total de personas.').min(1, { error: 'Debe haber al menos una persona.' }).max(site.maxGuests, {
      error: `La casa admite un máximo de ${site.maxGuests} personas.`,
    }),
    activity: text(20, 2000, 'Cuéntanos un poco más sobre la actividad (mínimo 20 caracteres).'),
    acceptPrivacy: z.boolean().refine((v) => v, { error: 'Necesitamos tu consentimiento para tramitar la reserva.' }),
    acceptRules: z.boolean().refine((v) => v, { error: 'Debes aceptar las normas de la casa.' }),
  })
  .superRefine((v, ctx) => {
    if (v.arrivalDate && v.departureDate && v.departureDate < v.arrivalDate)
      ctx.addIssue({ code: 'custom', path: ['departureDate'], message: 'La salida no puede ser antes de la llegada.' })
    if (v.arrivalDate && v.arrivalDate < toISODate(startOfToday()))
      ctx.addIssue({ code: 'custom', path: ['arrivalDate'], message: 'La llegada no puede ser en el pasado.' })
    if (v.arrivalDate === v.departureDate && v.departureTime <= v.arrivalTime)
      ctx.addIssue({ code: 'custom', path: ['departureTime'], message: 'Si venís un solo día, la salida debe ser después de la llegada.' })
    if (Number.isFinite(v.children) && Number.isFinite(v.monitors) && v.totalGuests < v.children + v.monitors)
      ctx.addIssue({ code: 'custom', path: ['totalGuests'], message: 'No puede ser menor que niños + responsables.' })
  })

type FormIn = z.input<typeof schema>
type FormOut = z.output<typeof schema>

const defaults: Partial<FormIn> = {
  arrivalDate: '',
  departureDate: '',
  arrivalTime: '17:00',
  departureTime: '16:00',
  organization: '',
  responsibleName: '',
  dni: '',
  phone: '',
  email: '',
  activity: '',
  acceptPrivacy: false,
  acceptRules: false,
}

export function BookingSection() {
  const [done, setDone] = useState<CreateBookingResponse | null>(null)
  return (
    <section id="reservar" className="border-y border-piedra-200 bg-paper py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <h2 className="text-4xl font-bold tracking-tight">Disponibilidad y reserva</h2>
        <p className="mt-4 max-w-[62ch] leading-relaxed text-ink-soft">
          Elige las fechas en el calendario y rellena la solicitud. La revisamos en unos días y te escribimos para confirmar el importe y el
          pago.
        </p>
        <div className="mt-10">{done ? <BookingSuccess result={done} onAnother={() => setDone(null)} /> : <BookingForm onDone={setDone} />}</div>
      </div>
    </section>
  )
}

function BookingForm({ onDone }: { onDone: (r: CreateBookingResponse) => void }) {
  const qc = useQueryClient()
  const { busyKeys, pendingKeys } = useAvailability()
  const captchaRef = useRef<CaptchaHandle>(null)
  const [captcha, setCaptcha] = useState<string | null>(null)
  const onToken = useCallback((t: string | null) => setCaptcha(t), [])
  const [mountedAt] = useState(() => Date.now())
  const idempotencyKey = useRef(crypto.randomUUID())
  const honeypot = useRef<HTMLInputElement>(null)
  const totalTouched = useRef(false)

  const {
    register,
    handleSubmit,
    setValue,
    setError,
    control,
    formState: { errors, isSubmitted },
  } = useForm<FormIn, unknown, FormOut>({ resolver: zodResolver(schema), defaultValues: defaults, mode: 'onTouched' })

  const [arrivalDate, departureDate, children, monitors, totalGuests] = useWatch({
    control,
    name: ['arrivalDate', 'departureDate', 'children', 'monitors', 'totalGuests'],
  })

  // Keep the total in sync with children + monitors until the user edits it by hand.
  useEffect(() => {
    if (totalTouched.current) return
    const sum = (Number.isFinite(children) ? children! : 0) + (Number.isFinite(monitors) ? monitors! : 0)
    if (sum > 0) setValue('totalGuests', sum, { shouldValidate: isSubmitted })
  }, [children, monitors, setValue, isSubmitted])

  const selected: DateRange | undefined = arrivalDate ? { from: parseISO(arrivalDate), to: departureDate ? parseISO(departureDate) : undefined } : undefined

  const onSelect = (r: DateRange | undefined) => {
    const opts = { shouldValidate: isSubmitted, shouldDirty: true }
    setValue('arrivalDate', r?.from ? toISODate(r.from) : '', opts)
    setValue('departureDate', r?.to ? toISODate(r.to) : r?.from ? toISODate(r.from) : '', opts)
  }

  const conflict = useMemo(() => {
    if (!arrivalDate || !departureDate || departureDate < arrivalDate) return { busy: false, pending: false }
    const keys = eachDayOfInterval({ start: parseISO(arrivalDate), end: parseISO(departureDate) }).map(toISODate)
    return { busy: keys.some((k) => busyKeys.has(k)), pending: keys.some((k) => pendingKeys.has(k)) }
  }, [arrivalDate, departureDate, busyKeys, pendingKeys])

  const mutation = useMutation({
    mutationFn: (data: FormOut) =>
      publicApi.createBooking(
        { ...data, acceptPrivacy: true, acceptRules: true },
        captcha ?? '',
        idempotencyKey.current,
        honeypot.current?.value ?? '',
        Date.now() - mountedAt,
      ),
    onSuccess: (res) => {
      idempotencyKey.current = crypto.randomUUID()
      qc.invalidateQueries({ queryKey: ['availability'] })
      onDone(res)
      document.getElementById('reservar')?.scrollIntoView({ behavior: 'smooth' })
    },
    onError: (e) => {
      captchaRef.current?.reset()
      if (e instanceof ApiError) {
        for (const [field, message] of Object.entries(e.fieldErrors)) setError(field as keyof FormIn, { message })
        if (e.code === 'dates_taken') qc.invalidateQueries({ queryKey: ['availability'] })
      }
    },
  })

  const onSubmit = (data: FormOut) => {
    if (conflict.busy) return
    mutation.mutate(data)
  }

  const err = (k: keyof FormIn) => errors[k]?.message as string | undefined

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="grid gap-10 lg:grid-cols-[minmax(0,auto)_1fr] lg:gap-14">
      {/* Calendar + price, sticky on large screens */}
      <div className="lg:sticky lg:top-24 lg:self-start">
        <div className="rounded-2xl border border-piedra-200 bg-cal p-4 sm:p-5">
          <AvailabilityCalendar selected={selected} onSelect={onSelect} />
        </div>
        {conflict.busy && (
          <Alert className="mt-4">Alguno de los días elegidos ya está ocupado. Elige otras fechas en el calendario.</Alert>
        )}
        {!conflict.busy && conflict.pending && (
          <Alert tone="amber" className="mt-4 flex gap-2">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>Hay otra solicitud pendiente para alguno de estos días. Puedes enviar la tuya: si la otra no sigue adelante, serás la siguiente.</span>
          </Alert>
        )}
        <div className="mt-4">
          <PriceSummary arrival={arrivalDate ?? ''} departure={departureDate ?? ''} guests={Number.isFinite(totalGuests) ? totalGuests! : 0} />
        </div>
      </div>

      <div className="space-y-10">
        <Fieldset legend="Fechas y horarios">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Día de llegada" error={err('arrivalDate')}>
              {(p) => <Input type="date" min={toISODate(startOfToday())} {...p} {...register('arrivalDate')} />}
            </Field>
            <Field label="Hora de llegada" error={err('arrivalTime')}>
              {(p) => <Input type="time" step={900} {...p} {...register('arrivalTime')} />}
            </Field>
            <Field label="Día de salida" error={err('departureDate')} hint="El mismo día que la llegada si no pasáis la noche.">
              {(p) => <Input type="date" min={arrivalDate || toISODate(startOfToday())} {...p} {...register('departureDate')} />}
            </Field>
            <Field label="Hora de salida" error={err('departureTime')}>
              {(p) => <Input type="time" step={900} {...p} {...register('departureTime')} />}
            </Field>
          </div>
        </Fieldset>

        <Fieldset legend="Grupo">
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Nombre del grupo scout o entidad" error={err('organization')} className="sm:col-span-3">
              {(p) => <Input autoComplete="organization" maxLength={120} placeholder="Grupo Scout…" {...p} {...register('organization')} />}
            </Field>
            <Field label="Niños y niñas" error={err('children')}>
              {(p) => <Input type="number" inputMode="numeric" min={0} max={site.maxGuests} {...p} {...register('children', { valueAsNumber: true })} />}
            </Field>
            <Field label="Monitores" error={err('monitors')} hint="Adultos responsables.">
              {(p) => <Input type="number" inputMode="numeric" min={1} max={site.maxGuests} {...p} {...register('monitors', { valueAsNumber: true })} />}
            </Field>
            <Field label="Total de personas" error={err('totalGuests')} hint={`Máximo ${site.maxGuests}.`}>
              {(p) => (
                <Input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={site.maxGuests}
                  {...p}
                  {...register('totalGuests', { valueAsNumber: true, onChange: () => (totalTouched.current = true) })}
                />
              )}
            </Field>
          </div>
        </Fieldset>

        <Fieldset legend="Persona responsable de la actividad">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nombre y apellidos" error={err('responsibleName')} className="sm:col-span-2">
              {(p) => <Input autoComplete="name" maxLength={120} {...p} {...register('responsibleName')} />}
            </Field>
            <Field label="DNI o NIE" error={err('dni')}>
              {(p) => <Input autoComplete="off" maxLength={12} placeholder="12345678Z" className="uppercase" {...p} {...register('dni')} />}
            </Field>
            <Field label="Teléfono" error={err('phone')}>
              {(p) => <Input type="tel" autoComplete="tel" maxLength={20} placeholder="600 123 456" {...p} {...register('phone')} />}
            </Field>
            <Field label="Correo electrónico" error={err('email')} hint="Te enviaremos aquí el enlace para seguir tu reserva." className="sm:col-span-2">
              {(p) => <Input type="email" autoComplete="email" maxLength={160} {...p} {...register('email')} />}
            </Field>
          </div>
        </Fieldset>

        <Fieldset legend="Actividad">
          <Field label="¿Qué vais a hacer durante la estancia?" error={err('activity')} hint="Tipo de actividad, rutas previstas, si habrá cocina, fuego, etc.">
            {(p) => <Textarea rows={5} maxLength={2000} {...p} {...register('activity')} />}
          </Field>
        </Fieldset>

        {/* Honeypot: invisible to people, bots tend to fill it */}
        <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
          <label>
            Web
            <input ref={honeypot} type="text" name="website" tabIndex={-1} autoComplete="off" />
          </label>
        </div>

        <Fieldset legend="Protección de datos">
          <div className="space-y-4">
            <Consent id="acceptPrivacy" error={err('acceptPrivacy')} {...register('acceptPrivacy')}>
              He leído la{' '}
              <Link to="/privacidad" target="_blank" className="font-medium text-encina-600 underline">
                política de privacidad
              </Link>{' '}
              y consiento el tratamiento de mis datos y los del grupo para gestionar esta reserva, conforme al RGPD y la LOPDGDD.
            </Consent>
            <Consent id="acceptRules" error={err('acceptRules')} {...register('acceptRules')}>
              He leído y acepto las{' '}
              <a href={withBase('/docs/normas-de-la-casa.pdf')} target="_blank" rel="noopener" className="font-medium text-encina-600 underline">
                normas de la casa
              </a>{' '}
              y me hago responsable del grupo durante la estancia.
            </Consent>
            <p className="rounded-lg bg-cal p-4 text-xs leading-relaxed text-ink-soft">
              Responsable: {site.dataController.name}. Finalidad: gestionar la reserva y la estancia. Legitimación: tu consentimiento y la
              ejecución de la reserva. Conservación: mientras dure la relación y los plazos legales. Derechos: acceso, rectificación, supresión,
              oposición, limitación y portabilidad escribiendo a {site.dataController.email}. Más información en la política de privacidad.
            </p>
          </div>
        </Fieldset>

        <div className="space-y-4 border-t border-piedra-200 pt-8">
          <Captcha ref={captchaRef} onToken={onToken} />
          {mutation.isError && <Alert>{mutation.error instanceof ApiError ? mutation.error.message : 'No se ha podido enviar la solicitud.'}</Alert>}
          <Button type="submit" size="lg" loading={mutation.isPending} disabled={!captcha || conflict.busy} className="w-full sm:w-auto">
            Enviar solicitud de reserva
          </Button>
          {!captcha && <p className="text-xs text-ink-soft">Completa la verificación anti-spam para poder enviar.</p>}
        </div>
      </div>
    </form>
  )
}

function Fieldset({ legend, children }: { legend: string; children: React.ReactNode }) {
  return (
    <fieldset>
      <legend className="mb-4 font-display text-xl font-semibold">{legend}</legend>
      {children}
    </fieldset>
  )
}

const Consent = ({ id, error, children, ...rest }: { id: string; error?: string; children: React.ReactNode } & React.InputHTMLAttributes<HTMLInputElement>) => (
  <div>
    <label htmlFor={id} className="flex cursor-pointer gap-3 text-sm leading-relaxed">
      <input
        id={id}
        type="checkbox"
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-err` : undefined}
        className="mt-0.5 size-5 shrink-0 accent-encina-600"
        {...rest}
      />
      <span>{children}</span>
    </label>
    {error && (
      <p id={`${id}-err`} role="alert" className="ml-8 mt-1 text-xs font-medium text-busy">
        {error}
      </p>
    )}
  </div>
)

function BookingSuccess({ result, onAnother }: { result: CreateBookingResponse; onAnother: () => void }) {
  const link = trackingUrl(result.trackingToken)
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
    } catch {
      /* clipboard blocked: the link is visible anyway */
    }
  }
  return (
    <div className="mx-auto max-w-2xl rounded-2xl border border-encina-100 bg-encina-50 p-6 sm:p-10" role="status">
      <span className="grid size-12 place-items-center rounded-full bg-encina-600 text-white">
        <Check className="size-6" aria-hidden />
      </span>
      <h3 className="mt-5 text-3xl font-bold">Solicitud enviada</h3>
      <p className="mt-2 text-ink-soft">
        Referencia <strong className="font-semibold text-ink tabular">{result.reference}</strong>. Te hemos enviado un correo con estos datos.
      </p>
      <ol className="mt-6 space-y-3 text-sm leading-relaxed">
        <li className="flex gap-3">
          <Step n={1} />
          Revisamos la solicitud y comprobamos las fechas.
        </li>
        <li className="flex gap-3">
          <Step n={2} />
          Si todo encaja, te escribimos con el importe y los datos para la transferencia.
        </li>
        <li className="flex gap-3">
          <Step n={3} />
          Subes el justificante desde el enlace de seguimiento y la reserva queda confirmada.
        </li>
      </ol>
      <div className="mt-8">
        <p className="text-sm font-medium">Enlace de seguimiento</p>
        <p className="mt-1 text-xs text-ink-soft">
          Guárdalo: es personal y sirve para ver el estado y subir el justificante de pago. Si lo pierdes, búscala en «Mi reserva» con la referencia.
        </p>
        <div className="mt-2 flex gap-2">
          <Input readOnly value={link} onFocus={(e) => e.currentTarget.select()} className="font-mono text-xs" aria-label="Enlace de seguimiento" />
          <Button variant="secondary" onClick={copy} aria-live="polite">
            {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
            {copied ? 'Copiado' : 'Copiar'}
          </Button>
        </div>
      </div>
      <div className="mt-8 flex flex-wrap gap-3">
        <Link to={`/reservas/${result.trackingToken}`} className="inline-flex h-10 items-center rounded-lg bg-encina-600 px-4 text-sm font-medium text-white hover:bg-encina-700">
          Ver mi reserva
        </Link>
        <Button variant="ghost" onClick={onAnother}>
          Hacer otra solicitud
        </Button>
      </div>
    </div>
  )
}

const Step = ({ n }: { n: number }) => (
  <span className="grid size-6 shrink-0 place-items-center rounded-full bg-paper text-xs font-semibold text-encina-700 ring-1 ring-encina-100">{n}</span>
)
