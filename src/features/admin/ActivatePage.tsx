import { useState, type FormEvent, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router'
import { useMutation, useQuery } from '@tanstack/react-query'
import { KeyRound } from 'lucide-react'
import { adminApi } from '@/api/admin'
import { ApiError } from '@/api/client'
import { site } from '@/config/site'
import { Alert, Button, Field, Input, Spinner } from '@/components/ui'
import { useAuth } from './auth'

/**
 * Read once and dropped from the address bar, so the token doesn't stay in history or get shared by accident.
 * Kept in the module so a second read (React StrictMode runs state initializers twice) still finds it.
 */
let pendingToken = ''
function takeToken() {
  const fromUrl = window.location.hash.slice(1)
  if (fromUrl) {
    pendingToken = fromUrl
    window.history.replaceState(window.history.state, '', window.location.pathname)
  }
  return pendingToken
}

/** Invitation link from the email: shows whose account it is and sets the password. */
export function ActivatePage() {
  const [token] = useState(takeToken)
  const invitation = useQuery({
    queryKey: ['invitation', token],
    queryFn: () => adminApi.invitation(token),
    enabled: !!token,
    retry: false,
    staleTime: Infinity,
  })

  return (
    <Shell>
      {!token || invitation.isError ? (
        <>
          <h1 className="text-2xl font-bold">Enlace no válido</h1>
          <Alert className="mt-6">
            {invitation.error instanceof ApiError
              ? invitation.error.message
              : 'El enlace de activación no es válido o ha caducado. Pide que te envíen uno nuevo.'}
          </Alert>
          <Link to="/admin/login" className="mt-6 inline-block text-sm font-medium text-encina-700 underline">
            Ir a la página de entrada
          </Link>
        </>
      ) : invitation.isLoading ? (
        <Spinner />
      ) : (
        <PasswordForm token={token} name={invitation.data!.name} email={invitation.data!.email} />
      )}
    </Shell>
  )
}

function PasswordForm({ token, name, email }: { token: string; name: string; email: string }) {
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const [password, setPassword] = useState('')
  const [repeat, setRepeat] = useState('')
  const [mismatch, setMismatch] = useState(false)
  const accept = useMutation({
    mutationFn: () => adminApi.acceptInvitation(token, password),
    onSuccess: async () => {
      pendingToken = ''
      if (user) {
        // Another account was open in this browser: close it and reload, so nothing of it stays in memory and the
        // login page doesn't send this person straight to the panel as someone else.
        await logout()
        sessionStorage.setItem('rcc-logout-reason', 'activated')
        sessionStorage.setItem('rcc-login-email', email)
        window.location.replace(`${import.meta.env.BASE_URL}admin/login`)
        return
      }
      sessionStorage.setItem('rcc-logout-reason', 'activated')
      navigate('/admin/login', { replace: true, state: { email } })
    },
  })
  const e = accept.error instanceof ApiError ? accept.error : null

  const submit = (ev: FormEvent) => {
    ev.preventDefault()
    if (password !== repeat) return setMismatch(true)
    setMismatch(false)
    accept.mutate()
  }

  return (
    <form onSubmit={submit}>
      <h1 className="flex items-center gap-2 text-2xl font-bold">
        <KeyRound className="size-6 text-encina-600" aria-hidden />
        Activa tu cuenta
      </h1>
      <p className="mt-1 text-sm text-ink-soft">
        Hola, {name}. Elige la contraseña con la que entrarás como <strong className="font-medium text-ink">{email}</strong>.
      </p>
      <div className="mt-8 space-y-4">
        {/* Lets password managers save the pair under the right account. */}
        <input type="email" autoComplete="username" value={email} readOnly hidden />
        <Field label="Contraseña" hint="Al menos 12 caracteres. Una frase de varias palabras es fácil de recordar y difícil de adivinar." error={e?.fieldErrors.password}>
          {(p) => (
            <Input type="password" autoComplete="new-password" required minLength={12} maxLength={256} autoFocus value={password} onChange={(ev) => setPassword(ev.target.value)} {...p} />
          )}
        </Field>
        <Field label="Repite la contraseña" error={mismatch ? 'Las contraseñas no coinciden.' : undefined}>
          {(p) => <Input type="password" autoComplete="new-password" required value={repeat} onChange={(ev) => setRepeat(ev.target.value)} {...p} />}
        </Field>
        {accept.isError && !e?.fieldErrors.password && <Alert>{e?.message ?? 'No se ha podido activar la cuenta.'}</Alert>}
        <Button type="submit" className="w-full" size="lg" loading={accept.isPending}>
          Activar cuenta
        </Button>
        <p className="text-xs text-ink-soft">Cada vez que entres te enviaremos a este correo un código de 6 cifras para confirmar que eres tú.</p>
      </div>
    </form>
  )
}

function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-cal px-4 py-12">
      <div className="w-full max-w-sm">
        <p className="mb-6 font-display text-lg font-bold text-encina-700">{site.name}</p>
        {children}
      </div>
    </div>
  )
}
