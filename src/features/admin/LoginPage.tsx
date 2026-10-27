import { useEffect, useRef, useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router'
import { useMutation } from '@tanstack/react-query'
import { ShieldCheck, LockKeyhole } from 'lucide-react'
import { adminApi } from '@/api/admin'
import { ApiError } from '@/api/client'
import { site } from '@/config/site'
import { Alert, Button, Field, Input, Spinner } from '@/components/ui'
import { useAuth } from './auth'

export function LoginPage() {
  const { user, loading, signedIn } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from ?? '/admin'
  const [challenge, setChallenge] = useState<string | null>(null)
  const [notice] = useState(() => {
    const r = sessionStorage.getItem('rcc-logout-reason')
    sessionStorage.removeItem('rcc-logout-reason')
    return r === 'idle' ? 'Hemos cerrado la sesión por inactividad.' : r === 'expired' ? 'Tu sesión ha caducado. Vuelve a entrar.' : null
  })

  if (loading) return <Spinner />
  if (user) return <Navigate to={from} replace />

  return (
    <div className="grid min-h-dvh bg-cal lg:grid-cols-2">
      <div className="hidden flex-col justify-between bg-encina-700 p-12 text-encina-50 lg:flex">
        <p className="font-display text-xl font-bold text-white">{site.name}</p>
        <div>
          <p className="font-display text-4xl font-bold leading-tight text-white">Gestión de reservas</p>
          <p className="mt-3 max-w-[40ch] text-encina-100">Solicitudes, pagos, llaves y cuentas de la casa en un solo sitio.</p>
        </div>
        <div aria-hidden className="h-2 w-24 rounded-full bg-albero-500" />
      </div>
      <div className="flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm">
          <p className="font-display text-lg font-bold text-encina-700 lg:hidden">{site.name}</p>
          {notice && !challenge && (
            <Alert tone="amber" className="mb-6">
              {notice}
            </Alert>
          )}
          {challenge ? (
            <MfaStep
              challengeId={challenge}
              onBack={() => setChallenge(null)}
              onDone={(u) => {
                signedIn(u)
                navigate(from, { replace: true })
              }}
            />
          ) : (
            <PasswordStep onChallenge={setChallenge} />
          )}
        </div>
      </div>
    </div>
  )
}

function PasswordStep({ onChallenge }: { onChallenge: (id: string) => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const login = useMutation({
    mutationFn: () => adminApi.login(email.trim(), password),
    onSuccess: (r) => {
      setPassword('')
      onChallenge(r.challengeId)
    },
  })
  const e = login.error instanceof ApiError ? login.error : null
  return (
    <form
      className="mt-6"
      onSubmit={(ev) => {
        ev.preventDefault()
        login.mutate()
      }}
    >
      <h1 className="flex items-center gap-2 text-2xl font-bold">
        <LockKeyhole className="size-6 text-encina-600" aria-hidden />
        Entrar
      </h1>
      <p className="mt-1 text-sm text-ink-soft">Acceso solo para la gestión de la casa.</p>
      <div className="mt-8 space-y-4">
        <Field label="Correo electrónico">
          {(p) => <Input type="email" autoComplete="username" required autoFocus value={email} onChange={(e) => setEmail(e.target.value)} {...p} />}
        </Field>
        <Field label="Contraseña">
          {(p) => <Input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} {...p} />}
        </Field>
        {login.isError && (
          <Alert>
            {e?.message ?? 'No se ha podido iniciar sesión.'}
            {e?.retryAfter ? ` Podrás volver a intentarlo en ${Math.ceil(e.retryAfter / 60)} min.` : ''}
          </Alert>
        )}
        <Button type="submit" className="w-full" size="lg" loading={login.isPending}>
          Continuar
        </Button>
      </div>
    </form>
  )
}

function MfaStep({ challengeId, onBack, onDone }: { challengeId: string; onBack: () => void; onDone: (u: { id: string; email: string; name: string }) => void }) {
  const [code, setCode] = useState('')
  const input = useRef<HTMLInputElement>(null)
  const verify = useMutation({
    mutationFn: (c: string) => adminApi.verifyMfa(challengeId, c),
    onSuccess: (r) => onDone(r.user),
    onError: (e) => {
      setCode('')
      if (e instanceof ApiError && e.code === 'challenge_expired') onBack()
      input.current?.focus()
    },
  })
  useEffect(() => {
    if (code.length === 6 && !verify.isPending) verify.mutate(code)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code])

  return (
    <form
      className="mt-6"
      onSubmit={(e) => {
        e.preventDefault()
        if (code.length === 6) verify.mutate(code)
      }}
    >
      <h1 className="flex items-center gap-2 text-2xl font-bold">
        <ShieldCheck className="size-6 text-encina-600" aria-hidden />
        Verificación en dos pasos
      </h1>
      <p className="mt-1 text-sm text-ink-soft">Escribe el código de 6 cifras de tu app de autenticación.</p>
      <div className="mt-8 space-y-4">
        <Field label="Código">
          {(p) => (
            <Input
              ref={input}
              autoFocus
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="\d{6}"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              className="h-14 text-center font-mono text-2xl tracking-[0.5em]"
              {...p}
            />
          )}
        </Field>
        {verify.isError && <Alert>{verify.error instanceof ApiError ? verify.error.message : 'No se ha podido verificar el código.'}</Alert>}
        <Button type="submit" className="w-full" size="lg" loading={verify.isPending} disabled={code.length !== 6}>
          Verificar y entrar
        </Button>
        <Button variant="ghost" className="w-full" onClick={onBack}>
          Usar otra cuenta
        </Button>
      </div>
    </form>
  )
}
