import { useState, type FormEvent } from 'react'
import { MailCheck, Smartphone, UserPlus, Users } from 'lucide-react'
import { ApiError } from '@/api/client'
import type { AdminAccount } from '@/api/admin'
import { fmtDate } from '@/lib/format'
import { Alert, Badge, Button, Dialog, Field, Input, Panel, Spinner } from '@/components/ui'
import { useAdmins, useDeleteAdmin, useInviteAdmin, useResendInvitation } from './queries'

const errorText = (e: unknown, fallback: string) => (e instanceof ApiError ? e.message : fallback)

/** Who can enter the admin panel. New people are invited by email and confirm each sign-in with an emailed code. */
export function AdminsPanel() {
  const admins = useAdmins()
  const [inviting, setInviting] = useState(false)
  const [removing, setRemoving] = useState<AdminAccount | null>(null)
  const resend = useResendInvitation()
  const [resent, setResent] = useState<string | null>(null)

  return (
    <Panel
      title={
        <span className="flex items-center gap-2">
          <Users className="size-4.5 text-ink-soft" aria-hidden />
          Administradores
        </span>
      }
      action={
        <Button size="sm" variant="secondary" onClick={() => setInviting(true)}>
          <UserPlus className="size-4" aria-hidden />
          Añadir
        </Button>
      }
    >
      {admins.isLoading ? (
        <Spinner />
      ) : admins.isError ? (
        <div className="p-5">
          <Alert>No se ha podido cargar la lista.</Alert>
        </div>
      ) : (
        <ul className="divide-y divide-piedra-200">
          {admins.data!.map((a) => (
            <li key={a.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3 text-sm">
              <div className="min-w-0 flex-1">
                <p className="font-medium">
                  {a.name}
                  {a.isMe && <span className="font-normal text-ink-soft"> (tú)</span>}
                </p>
                <p className="truncate text-ink-soft">{a.email}</p>
              </div>
              <AccountState account={a} />
              <div className="flex gap-1">
                {a.status !== 'active' && (
                  <Button
                    size="sm"
                    variant="ghost"
                    loading={resend.isPending && resend.variables === a.id}
                    onClick={() => resend.mutate(a.id, { onSuccess: () => setResent(a.email) })}
                  >
                    Reenviar invitación
                  </Button>
                )}
                {!a.isMe && (
                  <Button size="sm" variant="ghost" onClick={() => setRemoving(a)}>
                    Quitar
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      {resend.isError && (
        <div className="px-5 pb-4">
          <Alert>{errorText(resend.error, 'No se ha podido reenviar la invitación.')}</Alert>
        </div>
      )}
      {resent && !resend.isError && (
        <p className="px-5 pb-4 text-sm text-free" role="status">
          Invitación enviada de nuevo a {resent}. El enlace anterior ya no sirve.
        </p>
      )}
      <p className="border-t border-piedra-200 px-5 py-3 text-xs text-ink-soft">
        Las personas que añadas aquí reciben un correo para activar su cuenta y elegir su contraseña. Cada vez que entren, les enviamos un código de 6 cifras a ese correo.
      </p>

      <Dialog
        open={inviting}
        onClose={() => setInviting(false)}
        title="Añadir administrador"
        description="Le enviaremos un correo con un enlace para activar la cuenta. Caduca en 24 horas."
      >
        {inviting && <InviteForm onClose={() => setInviting(false)} />}
      </Dialog>
      <Dialog open={!!removing} onClose={() => setRemoving(null)} title="Quitar administrador">
        {removing && <RemoveConfirm account={removing} onClose={() => setRemoving(null)} />}
      </Dialog>
    </Panel>
  )
}

function AccountState({ account: a }: { account: AdminAccount }) {
  if (a.status === 'invited') return <Badge tone="amber">Invitación enviada</Badge>
  if (a.status === 'expired') return <Badge tone="red">Invitación caducada</Badge>
  return (
    <span className="flex items-center gap-1.5 text-xs text-ink-soft" title={`Alta: ${fmtDate(a.createdAt.slice(0, 10))}`}>
      {a.mfaMethod === 'email' ? <MailCheck className="size-4" aria-hidden /> : <Smartphone className="size-4" aria-hidden />}
      {a.mfaMethod === 'email' ? 'Código por correo' : 'App de autenticación'}
    </span>
  )
}

function InviteForm({ onClose }: { onClose: () => void }) {
  const invite = useInviteAdmin()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const fieldErrors = invite.error instanceof ApiError ? invite.error.fieldErrors : {}

  const submit = (e: FormEvent) => {
    e.preventDefault()
    invite.mutate({ name: name.trim(), email: email.trim() }, { onSuccess: onClose })
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="Nombre" error={fieldErrors.name}>
        {(p) => <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} required autoFocus autoComplete="off" {...p} />}
      </Field>
      <Field label="Correo electrónico" error={fieldErrors.email} hint="Ahí recibirá la invitación y los códigos para entrar.">
        {(p) => <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={160} required autoComplete="off" {...p} />}
      </Field>
      {invite.isError && !Object.keys(fieldErrors).length && <Alert>{errorText(invite.error, 'No se ha podido enviar la invitación.')}</Alert>}
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="ghost" onClick={onClose}>
          Volver
        </Button>
        <Button type="submit" loading={invite.isPending}>
          Enviar invitación
        </Button>
      </div>
    </form>
  )
}

function RemoveConfirm({ account, onClose }: { account: AdminAccount; onClose: () => void }) {
  const remove = useDeleteAdmin()
  return (
    <div className="space-y-4">
      <p className="text-sm">
        <strong>{account.name}</strong> ({account.email}) dejará de poder entrar en la gestión y se cerrarán sus sesiones abiertas. Lo que haya hecho en las reservas se conserva.
      </p>
      {remove.isError && <Alert>{errorText(remove.error, 'No se ha podido quitar.')}</Alert>}
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="ghost" onClick={onClose}>
          Volver
        </Button>
        <Button variant="danger" loading={remove.isPending} onClick={() => remove.mutate(account.id, { onSuccess: onClose })}>
          Quitar acceso
        </Button>
      </div>
    </div>
  )
}
