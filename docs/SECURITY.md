# Security

What the frontend already does, and what the backend and hosting must do for the whole thing to be secure.

## Done in the frontend

- No tokens in `localStorage`/`sessionStorage`: the admin session is an HttpOnly cookie; requests use `credentials: 'include'`.
- CSRF double-submit header (`X-XSRF-TOKEN`) on every non-GET request.
- Two-step admin login (password, then TOTP code); generic error messages; lockout message with `Retry-After`.
- Auto logout after 20 minutes without activity; cached admin data is wiped on logout or `401`.
- Admin code is a separate lazy bundle; `/admin` is `noindex` and disallowed in `robots.txt`.
- Public form: Turnstile captcha, honeypot field, minimum fill time, idempotency key, strict validation and length limits; DNI/NIE checksum.
- Public availability exposes dates only, no personal data; closures look like any busy day.
- Booking lookup needs the reference and a captcha.
- File upload limited to PDF/JPEG/PNG ≤ 5 MB on the client.
- CSP meta tag injected in production builds (`vite.config.ts`); fonts self-hosted; no third-party scripts besides Turnstile.
- CSV export escapes formula injection (`=`, `+`, `-`, `@`).
- Mock backend and demo credentials are excluded from production builds.

## Required in the backend

- **Passwords**: Argon2id (or bcrypt cost ≥ 12). Run the hash even for unknown emails to avoid user enumeration by timing.
- **2FA**: TOTP (RFC 6238) mandatory for every admin, secrets encrypted at rest, replay protection, reset procedure. Step by step in [2FA.md](2FA.md). Consider WebAuthn/passkeys as a stronger option.
- **Rate limiting**: login per IP and per account (e.g. 5 failures → 15 min lock), MFA attempts per challenge (max 5), public form per IP.
- **Sessions**: random ID ≥ 128 bits, `HttpOnly; Secure; SameSite=Strict`, rotate on login, idle timeout ~20 min, absolute timeout ~8 h, server-side revocation on logout.
- **CSRF**: verify `X-XSRF-TOKEN` against the cookie on every mutating admin request; also check `Origin`.
- **Turnstile**: verify every token server side, single use.
- **Validation**: re-validate everything server side; recalculate prices; never trust `amountPaid` from the public endpoint.
- **Uploads**: check magic bytes, not just MIME; store outside the web root with random names; serve only to admins through an authenticated endpoint with `Content-Disposition: attachment`.
- **Tracking tokens**: ≥ 192 random bits, encrypted at rest (admins can see the link again, so it can't be a one-way hash), allow regeneration.
- **Booking lookup** (`/mi-reserva`): by reference only, so Turnstile and a per-IP rate limit are the only protection against enumeration; prefer non-sequential references.
- **Authorization**: every `/api/v1/admin/*` route behind the session middleware; audit log of admin actions (already modelled as booking `history`).
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

The API is served at `https://api.mscjerez.es/v1/rcc` through the gateway in `../gateway` (Cloudflare Tunnel + Traefik on the Raspberry Pi): no open ports at home, CORS limited to the site origin, per-IP rate limits (strict on login, 2FA, booking, lookup and upload), body limits and security headers. Cookies are host-only on `api.mscjerez.es` (no `Domain`), so the WordPress site and other `*.mscjerez.es` hosts never receive them. Build the frontend with `VITE_API_URL=https://api.mscjerez.es/v1/rcc` so the CSP `connect-src` allows it.

Configure the SPA fallback (`/*` → `index.html`) so deep links like `/reservas/…`, `/mi-reserva` and `/admin/…` work.
