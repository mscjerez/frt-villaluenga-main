import { useEffect, useMemo, useRef } from 'react'
import { Link, useNavigate } from 'react-router'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ArrowLeft } from 'lucide-react'
import { blockingStatuses, statusMeta, tentativeStatuses } from '@/domain/booking'
import { ApiError } from '@/api/client'
import { site } from '@/config/site'
import { cleanText, isValidDniNie, isValidPhone, normalizeDni } from '@/lib/validation'
import { fmtRange } from '@/lib/format'
import { Alert, Button, Field, Input, Panel, Switch, Textarea } from '@/components/ui'
import { PriceSummary } from '@/features/public/PriceSummary'
import { PageHeader } from './AdminLayout'
import { useBlocks, useBookings, useCreateBooking } from './queries'

const int = (msg: string) => z.number({ error: msg }).int({ error: 'Usa un número entero.' })
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, { error: 'Indica la hora.' })
const text = (min: number, max: number, minMsg: string) =>
  z
    .string()
    .transform(cleanText)
    .pipe(z.string().min(min, { error: minMsg }).max(max, { error: `Máximo ${max} caracteres.` }))

// Same rules as the public form, except: past dates are allowed and DNI, email and activity are optional.
// The backend applies the same schema (rcc-api/src/routes/admin.ts).
const schema = z
  .object({
    arrivalDate: z.string().min(1, { error: 'Indica el día de llegada.' }),
    departureDate: z.string().min(1, { error: 'Indica el día de salida.' }),
    arrivalTime: time,
    departureTime: time,
    organization: text(2, 120, 'Indica el nombre del grupo o entidad.'),
    responsibleName: text(3, 120, 'Indica el nombre y apellidos.'),
    dni: z.string().refine((v) => !v.trim() || isValidDniNie(v), { error: 'DNI o NIE no válido. Revisa los números y la letra.' }).transform((v) => (v.trim() ? normalizeDni(v) : '')),
    phone: z.string().refine(isValidPhone, { error: 'Teléfono no válido. Ejemplo: 600 123 456.' }),
    email: z.literal('').or(z.email({ error: 'Correo electrónico no válido.' }).max(160)),
    children: int('Indica cuántos niños y niñas vienen.').min(0, { error: 'No puede ser negativo.' }),
    monitors: int('Indica cuántos responsables vienen.').min(1, { error: 'Debe venir al menos una persona responsable.' }),
    totalGuests: int('Indica el total de personas.').min(1, { error: 'Debe haber al menos una persona.' }).max(site.maxGuests, {
      error: `La casa admite un máximo de ${site.maxGuests} personas.`,
    }),
    activity: z.string().transform(cleanText).pipe(z.string().max(2000, { error: 'Máximo 2000 caracteres.' })),
    free: z.boolean(),
    internalNotes: z.string().max(4000, { error: 'Máximo 4000 caracteres.' }),
    notifyGroup: z.boolean(),
  })
  .superRefine((v, ctx) => {
    if (v.arrivalDate && v.departureDate && v.departureDate < v.arrivalDate)
      ctx.addIssue({ code: 'custom', path: ['departureDate'], message: 'La salida no puede ser antes de la llegada.' })
    if (v.arrivalDate === v.departureDate && v.departureTime <= v.arrivalTime)
      ctx.addIssue({ code: 'custom', path: ['departureTime'], message: 'Si vienen un solo día, la salida debe ser después de la llegada.' })
    if (Number.isFinite(v.children) && Number.isFinite(v.monitors) && v.totalGuests < v.children + v.monitors)
      ctx.addIssue({ code: 'custom', path: ['totalGuests'], message: 'No puede ser menor que niños + responsables.' })
    if (v.notifyGroup && !v.email) ctx.addIssue({ code: 'custom', path: ['email'], message: 'Hace falta un correo para enviar el enlace.' })
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
  free: false,
  internalNotes: '',
  notifyGroup: true,
}

export function NewBookingPage() {
  const navigate = useNavigate()
  const create = useCreateBooking()
  const bookings = useBookings()
  const blocks = useBlocks()
  const totalTouched = useRef(false)

  const {
    register,
    handleSubmit,
    setValue,
    setError,
    control,
    formState: { errors, isSubmitted },
  } = useForm<FormIn, unknown, FormOut>({ resolver: zodResolver(schema), defaultValues: defaults, mode: 'onTouched' })

  const [arrivalDate, departureDate, children, monitors, totalGuests, free, notifyGroup] = useWatch({
    control,
    name: ['arrivalDate', 'departureDate', 'children', 'monitors', 'totalGuests', 'free', 'notifyGroup'],
  })

  // Keep the total in sync with children + monitors until it is edited by hand.
  useEffect(() => {
    if (totalTouched.current) return
    const sum = (Number.isFinite(children) ? children! : 0) + (Number.isFinite(monitors) ? monitors! : 0)
    if (sum > 0) setValue('totalGuests', sum, { shouldValidate: isSubmitted })
  }, [children, monitors, setValue, isSubmitted])

  const clashes = useMemo(() => {
    if (!arrivalDate || !departureDate || departureDate < arrivalDate) return { busy: [], pending: [], closed: [] }
    const overlaps = (start: string, end: string) => start <= departureDate && end >= arrivalDate
    const list = bookings.data ?? []
    return {
      busy: list.filter((b) => blockingStatuses.includes(b.status) && overlaps(b.arrivalDate, b.departureDate)),
      pending: list.filter((b) => tentativeStatuses.includes(b.status) && overlaps(b.arrivalDate, b.departureDate)),
      closed: (blocks.data ?? []).filter((k) => overlaps(k.start, k.end)),
    }
  }, [arrivalDate, departureDate, bookings.data, blocks.data])
  const blocked = clashes.busy.length > 0 || clashes.closed.length > 0

  const onSubmit = (data: FormOut) => {
    if (blocked) return
    create.mutate(data, {
      onSuccess: (b) => navigate(`/admin/reservas/${b.id}`, { replace: true }),
      onError: (e) => {
        if (e instanceof ApiError) for (const [field, message] of Object.entries(e.fieldErrors)) setError(field as keyof FormIn, { message })
      },
    })
  }

  const err = (k: keyof FormIn) => errors[k]?.message as string | undefined

  return (
    <>
      <Link to="/admin/reservas" className="mb-3 inline-flex items-center gap-1.5 text-sm text-ink-soft hover:text-ink">
        <ArrowLeft className="size-4" aria-hidden />
        Reservas
      </Link>
      <PageHeader
        title="Nueva reserva"
        description="Para reservas acordadas por teléfono, correo o en persona. Entra como pendiente y sigue el proceso de siempre."
      />

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <div className="space-y-6">
          <Panel title="Fechas y horarios">
            <div className="grid gap-4 p-5 sm:grid-cols-2">
              <Field label="Día de llegada" error={err('arrivalDate')}>
                {(p) => <Input type="date" {...p} {...register('arrivalDate')} />}
              </Field>
              <Field label="Hora de llegada" error={err('arrivalTime')}>
                {(p) => <Input type="time" step={900} {...p} {...register('arrivalTime')} />}
              </Field>
              <Field label="Día de salida" error={err('departureDate')} hint="El mismo día si no pasan la noche.">
                {(p) => <Input type="date" min={arrivalDate || undefined} {...p} {...register('departureDate')} />}
              </Field>
              <Field label="Hora de salida" error={err('departureTime')}>
                {(p) => <Input type="time" step={900} {...p} {...register('departureTime')} />}
              </Field>
            </div>
          </Panel>

          <Panel title="Grupo">
            <div className="grid gap-4 p-5 sm:grid-cols-3">
              <Field label="Grupo o entidad" error={err('organization')} className="sm:col-span-3">
                {(p) => <Input maxLength={120} {...p} {...register('organization')} />}
              </Field>
              <Field label="Niños y niñas" error={err('children')}>
                {(p) => <Input type="number" inputMode="numeric" min={0} max={site.maxGuests} {...p} {...register('children', { valueAsNumber: true })} />}
              </Field>
              <Field label="Monitores" error={err('monitors')}>
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
              <Field label="Actividad" optional error={err('activity')} className="sm:col-span-3">
                {(p) => <Textarea rows={3} maxLength={2000} {...p} {...register('activity')} />}
              </Field>
            </div>
          </Panel>

          <Panel title="Persona responsable">
            <div className="grid gap-4 p-5 sm:grid-cols-2">
              <Field label="Nombre y apellidos" error={err('responsibleName')} className="sm:col-span-2">
                {(p) => <Input maxLength={120} {...p} {...register('responsibleName')} />}
              </Field>
              <Field label="Teléfono" error={err('phone')}>
                {(p) => <Input type="tel" maxLength={20} placeholder="600 123 456" {...p} {...register('phone')} />}
              </Field>
              <Field label="DNI o NIE" optional error={err('dni')}>
                {(p) => <Input maxLength={12} className="uppercase" {...p} {...register('dni')} />}
              </Field>
              <Field label="Correo electrónico" optional={!notifyGroup} error={err('email')} className="sm:col-span-2">
                {(p) => <Input type="email" maxLength={160} {...p} {...register('email')} />}
              </Field>
            </div>
          </Panel>

          <Panel title="Gestión">
            <div className="space-y-5 p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-medium">
                    Estancia gratuita
                  </p>
                  <p className="text-xs text-ink-soft">Solo paga la fianza y no cuenta como ingreso en finanzas.</p>
                </div>
                <Switch label="Estancia gratuita" checked={!!free} onChange={(v) => setValue('free', v)} />
              </div>
              <label className="flex cursor-pointer gap-3 text-sm">
                <input type="checkbox" className="mt-0.5 size-5 shrink-0 accent-encina-600" {...register('notifyGroup')} />
                <span>
                  Enviar al grupo el enlace de seguimiento por correo
                  <span className="block text-xs text-ink-soft">El mismo correo que reciben las solicitudes hechas desde la web.</span>
                </span>
              </label>
              <Field label="Notas internas" optional hint="Solo las ve el equipo de gestión." error={err('internalNotes')}>
                {(p) => <Textarea rows={3} maxLength={4000} placeholder="Acordada por teléfono con…" {...p} {...register('internalNotes')} />}
              </Field>
            </div>
          </Panel>
        </div>

        <div className="space-y-4 lg:sticky lg:top-8 lg:self-start">
          <PriceSummary arrival={arrivalDate ?? ''} departure={departureDate ?? ''} guests={Number.isFinite(totalGuests) ? totalGuests! : 0} />
          {free && <p className="text-xs text-ink-soft">Gratuita: al aceptarla se pedirá solo la fianza.</p>}
          {clashes.busy.length > 0 && (
            <Alert>
              Las fechas se solapan con {clashes.busy.map((b) => `${b.organization} (${statusMeta[b.status].label.toLowerCase()})`).join(', ')}.
            </Alert>
          )}
          {clashes.closed.length > 0 && (
            <Alert>
              La casa está cerrada: {clashes.closed.map((k) => `${fmtRange(k.start, k.end)} · ${k.reason}`).join('; ')}. Reabre esas fechas en el calendario si
              hace falta.
            </Alert>
          )}
          {!blocked && clashes.pending.length > 0 && (
            <Alert tone="amber">
              Hay {clashes.pending.length === 1 ? 'otra solicitud pendiente' : `${clashes.pending.length} solicitudes pendientes`} en esas fechas:{' '}
              {clashes.pending.map((b) => b.organization).join(', ')}. Solo una podrá aceptarse.
            </Alert>
          )}
          {create.isError && !(create.error instanceof ApiError && Object.keys(create.error.fieldErrors).length) && (
            <Alert>{create.error instanceof ApiError ? create.error.message : 'No se ha podido guardar.'}</Alert>
          )}
          <Button type="submit" size="lg" loading={create.isPending} disabled={blocked} className="w-full">
            Crear reserva
          </Button>
        </div>
      </form>
    </>
  )
}
