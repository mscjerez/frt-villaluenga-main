import { forwardRef, useEffect, useId, useRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { Loader2, X } from 'lucide-react'
import { cn } from '@/lib/cn'
import { statusMeta, type BookingStatus, type Tone } from '@/domain/booking'
import { toneDot } from './tones'

// ---------- Button ----------

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'accent'

const variants: Record<Variant, string> = {
  primary: 'bg-encina-600 text-white hover:bg-encina-700 disabled:bg-piedra-300',
  accent: 'bg-albero-500 text-ink hover:bg-albero-100 hover:text-albero-700 disabled:bg-piedra-300',
  secondary: 'bg-paper text-ink ring-1 ring-inset ring-piedra-300 hover:bg-piedra-100 disabled:text-piedra-500',
  ghost: 'text-ink-soft hover:bg-piedra-100 hover:text-ink disabled:text-piedra-300',
  danger: 'bg-busy text-white hover:bg-[#8a362f] disabled:bg-piedra-300',
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', loading, className, children, disabled, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors disabled:cursor-not-allowed',
        size === 'sm' && 'h-8 px-3 text-sm',
        size === 'md' && 'h-10 px-4 text-sm',
        size === 'lg' && 'h-12 px-6 text-base',
        variants[variant],
        className,
      )}
      {...rest}
    >
      {loading && <Loader2 className="size-4 animate-spin" aria-hidden />}
      {children}
    </button>
  )
})

// ---------- Form fields ----------

const control =
  'block w-full rounded-lg border border-piedra-300 bg-paper px-3 text-ink placeholder:text-piedra-500 transition-colors ' +
  'hover:border-piedra-500 focus:border-encina-600 focus:outline-none focus:ring-2 focus:ring-encina-100 ' +
  'aria-[invalid=true]:border-busy aria-[invalid=true]:ring-busy-bg disabled:bg-piedra-100'

interface FieldProps {
  label: ReactNode
  hint?: ReactNode
  error?: string
  className?: string
  children: (props: { id: string; 'aria-invalid': boolean; 'aria-describedby'?: string }) => ReactNode
  optional?: boolean
}

export function Field({ label, hint, error, className, children, optional }: FieldProps) {
  const id = useId()
  const describedBy = [hint && `${id}-hint`, error && `${id}-err`].filter(Boolean).join(' ') || undefined
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={id} className="text-sm font-medium text-ink">
        {label}
        {optional && <span className="ml-1 font-normal text-piedra-500">(opcional)</span>}
      </label>
      {children({ id, 'aria-invalid': !!error, 'aria-describedby': describedBy })}
      {hint && !error && (
        <p id={`${id}-hint`} className="text-xs text-ink-soft">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-err`} role="alert" className="text-xs font-medium text-busy">
          {error}
        </p>
      )}
    </div>
  )
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...rest }, ref) {
  return <input ref={ref} className={cn(control, 'h-10', className)} {...rest} />
})

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea(
  { className, ...rest },
  ref,
) {
  return <textarea ref={ref} className={cn(control, 'min-h-28 py-2 leading-relaxed', className)} {...rest} />
})

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select({ className, ...rest }, ref) {
  return <select ref={ref} className={cn(control, 'h-10 pr-8', className)} {...rest} />
})

// ---------- Badges ----------

const tones: Record<Tone, string> = {
  amber: 'bg-tentative-bg text-tentative',
  blue: 'bg-[#e1ebf5] text-[#2f5d8a]',
  green: 'bg-free-bg text-free',
  violet: 'bg-[#ece6f5] text-[#5d4690]',
  red: 'bg-busy-bg text-busy',
  stone: 'bg-piedra-200 text-ink-soft',
}

export function Badge({ tone, children, className }: { tone: Tone; children: ReactNode; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium', tones[tone], className)}>
      {children}
    </span>
  )
}

export function StatusBadge({ status }: { status: BookingStatus }) {
  const m = statusMeta[status]
  return (
    <Badge tone={m.tone}>
      <span className={cn('size-1.5 rounded-full', toneDot[m.tone])} aria-hidden />
      {m.label}
    </Badge>
  )
}

// ---------- Dialog ----------

interface DialogProps {
  open: boolean
  onClose: () => void
  title: string
  description?: ReactNode
  children: ReactNode
  className?: string
}

export function Dialog({ open, onClose, title, description, children, className }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) d.showModal()
    if (!open && d.open) d.close()
  }, [open])
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      className={cn(
        'm-auto w-[min(32rem,calc(100vw-2rem))] rounded-2xl bg-paper p-0 text-ink shadow-2xl backdrop:bg-ink/40 backdrop:backdrop-blur-[2px]',
        className,
      )}
    >
      {open && (
        <div className="p-6">
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold">{title}</h2>
              {description && <div className="mt-1 text-sm text-ink-soft">{description}</div>}
            </div>
            <button onClick={onClose} className="-m-1 rounded-md p-1 text-piedra-500 hover:bg-piedra-100 hover:text-ink" aria-label="Cerrar">
              <X className="size-5" />
            </button>
          </div>
          {children}
        </div>
      )}
    </dialog>
  )
}

// ---------- Misc ----------

/** On/off control. `label` is the accessible name when no visible <label> wraps it. */
export function Switch({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label?: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-label={label}
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn('relative h-6 w-10 shrink-0 rounded-full transition-colors disabled:opacity-50', checked ? 'bg-encina-600' : 'bg-piedra-300')}
    >
      <span className={cn('absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow transition-transform', checked && 'translate-x-4')} />
    </button>
  )
}

export function Spinner({ label = 'Cargando' }: { label?: string }) {
  return (
    <div role="status" className="flex items-center justify-center gap-2 py-10 text-sm text-ink-soft">
      <Loader2 className="size-5 animate-spin" aria-hidden />
      {label}…
    </div>
  )
}

export function Alert({ tone = 'red', children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <div role={tone === 'red' ? 'alert' : 'status'} className={cn('rounded-lg px-4 py-3 text-sm', tones[tone], className)}>
      {children}
    </div>
  )
}

export function Panel({ title, action, children, className }: { title?: ReactNode; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn('rounded-xl border border-piedra-200 bg-paper', className)}>
      {(title || action) && (
        <header className="flex items-center justify-between gap-3 border-b border-piedra-200 px-5 py-3.5">
          {title && <h2 className="text-base font-semibold">{title}</h2>}
          {action}
        </header>
      )}
      {children}
    </section>
  )
}
