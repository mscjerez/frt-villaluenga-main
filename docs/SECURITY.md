# Security

What the frontend already does, and what the backend and hosting must do for the whole thing to be secure.

## Done in the frontend

- No tokens in `localStorage`/`sessionStorage`: the admin session is an HttpOnly cookie; requests use `credentials: 'include'`.
- CSRF double-submit header (`X-XSRF-TOKEN`) on every non-GET request.
- Two-step admin login (password, then TOTP code); generic error messages; lockout message with `Retry-After`.
- Auto logout after 20 minutes without activity; cached admin data is wiped on logout or `401`.
- Admin code is a separate lazy bundle; `/admin` is `noindex` and disallowed in `robots.txt`.
- Public form: Turnstile captcha, honeypot field, minimum fill time, idempotency key, strict validation and length limits; DNI/NIE checksum.
- Public availability exposes dates only, no personal data.
- File upload limited to PDF/JPEG/PNG ≤ 5 MB on the client.
- CSP meta tag injected in production builds (`vite.config.ts`); fonts self-hosted; no third-party scripts besides Turnstile.
- CSV export escapes formula injection (`=`, `+`, `-`, `@`).
- Mock backend and demo credentials are excluded from production builds.

## Required in the backend

- **Passwords**: Argon2id (or bcrypt cost ≥ 12). Run the hash even for unknown emails to avoid user enumeration by timing.
- **2FA**: TOTP (RFC 6238) mandatory for every admin, secrets encrypted at rest, one-time recovery codes. Consider WebAuthn/passkeys as a stronger option.
- **Rate limiting**: login per IP and per account (e.g. 5 failures → 15 min lock), MFA attempts per challenge (max 5), public form per IP.
- **Sessions**: random ID ≥ 128 bits, `HttpOnly; Secure; SameSite=Strict`, rotate on login, idle timeout ~20 min, absolute timeout ~8 h, server-side revocation on logout.
- **CSRF**: verify `X-XSRF-TOKEN` against the cookie on every mutating admin request; also check `Origin`.
- **Turnstile**: verify every token server side, single use.
- **Validation**: re-validate everything server side; recalculate prices; never trust `amountPaid` from the public endpoint.
- **Uploads**: check magic bytes, not just MIME; store outside the web root with random names; serve only to admins through an authenticated endpoint with `Content-Disposition: attachment`.
- **Tracking tokens**: ≥ 192 random bits, store only a hash, allow revocation.
- **Authorization**: every `/api/admin/*` route behind the session middleware; audit log of admin actions (already modelled as booking `history`).
- **Personal data (RGPD/LOPDGDD)**: encrypt DNI at rest, retention policy (delete unconfirmed requests after a year), access log, data processing records.

## Required in hosting

Send these headers for the site (the meta CSP cannot set `frame-ancestors`):

```
Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
Content-Security-Policy: default-src 'self'; script-src 'self' https://challenges.cloudflare.com; frame-src https://challenges.cloudflare.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self' https://challenges.cloudflare.com; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=()
```

Serve the API on the same domain (e.g. `/api` reverse-proxied) so cookies stay first-party and CORS is not needed. If it must be cross-origin, allow only the site origin with credentials.

Configure the SPA fallback (`/*` → `index.html`) so deep links like `/reserva/…` and `/admin/…` work.
