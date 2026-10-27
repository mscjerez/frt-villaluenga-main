import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import { Turnstile, type TurnstileInstance } from '@marsidev/react-turnstile'

const SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined
const MOCK = import.meta.env.DEV && import.meta.env.VITE_API_MOCK === 'true'

export interface CaptchaHandle {
  reset: () => void
}

/**
 * Cloudflare Turnstile: free, no image puzzles and no tracking cookies.
 * The token must be verified server side (https://challenges.cloudflare.com/turnstile/v0/siteverify).
 */
export const Captcha = forwardRef<CaptchaHandle, { onToken: (t: string | null) => void }>(function Captcha({ onToken }, ref) {
  const inner = useRef<TurnstileInstance>(null)
  useImperativeHandle(ref, () => ({
    reset: () => {
      onToken(null)
      inner.current?.reset()
    },
  }))

  const bypass = !SITE_KEY && MOCK
  useEffect(() => {
    if (bypass) onToken('dev-bypass')
  }, [bypass, onToken])

  if (bypass) return <p className="text-xs text-piedra-500">Verificación anti-spam desactivada en modo de desarrollo.</p>
  if (!SITE_KEY) return <p className="text-xs text-busy">Falta configurar VITE_TURNSTILE_SITE_KEY.</p>

  return (
    <Turnstile
      ref={inner}
      siteKey={SITE_KEY}
      onSuccess={onToken}
      onExpire={() => onToken(null)}
      onError={() => onToken(null)}
      options={{ language: 'es', theme: 'light', size: 'flexible' }}
    />
  )
})
