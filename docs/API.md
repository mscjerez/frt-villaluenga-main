# API contract

In production the browser calls **`https://api.mscjerez.es/v1/rcc/…`** (the frontend is built with `VITE_API_URL=https://api.mscjerez.es/v1/rcc`). The gateway (`../gateway`) rewrites that prefix, so **the backend serves `/api/v1/…`** exactly as written below. On localhost the same `/api/v1` path is served by the MSW mocks or proxied by Vite to a local backend (`API_PROXY_TARGET`).

The gateway already handles CORS (only `https://rinconscout.mscjerez.es`, with credentials), rate limits per client IP, request size limits and security headers. The backend must still validate everything and apply its own per-account limits. Client IP: `CF-Connecting-IP` (set by Cloudflare), never a value from the request body.

All endpoints are JSON under `/api/v1`. Paths below are written in full. Types are defined in `src/domain/booking.ts`, `src/domain/finance.ts`, `src/domain/settings.ts` and `src/api/*.ts`. The real implementation is **`../rcc-api`** (Node + Fastify + PostgreSQL); the in-browser mock in `src/mocks/` follows the same rules for development without a backend.

## Errors

Any non-2xx response:

```json
{ "code": "dates_taken", "message": "Texto para mostrar al usuario", "fieldErrors": { "dni": "DNI no válido." } }
```

`message` is shown as-is (Spanish). `fieldErrors` keys match form field names. `429` responses should include `Retry-After` (seconds).

## Public

### `GET /api/v1/public/availability?from=yyyy-MM-dd&to=yyyy-MM-dd`

Returns only date ranges and a state, **never** names or any personal data.

```json
[{ "start": "2026-11-06", "end": "2026-11-08", "status": "busy" }, { "start": "2026-12-18", "end": "2026-12-20", "status": "pending" }]
```

- `busy`: bookings in `pending_payment` or `confirmed`, and dates closed by the admins (`DateBlock`). Closures are not distinguished from bookings and their reason is never exposed.
- `pending`: bookings in `pending`.
- Ranges are inclusive (arrival day to departure day).

### `GET /api/v1/public/banner`

The notice for the top of the home page, or `null` when there is none to show: `{ "banner": { "tone": "warning", "title": "Casa cerrada", "message": "…" } }`. Only returned while it is enabled, has text and today (Europe/Madrid) is between `startsOn` and `endsOn` (both optional, inclusive). Plain text: render it as text, never as HTML.

### `POST /api/v1/public/bookings`

Headers: `Idempotency-Key: <uuid>` (return the same response for a repeated key).

Body: `BookingRequest` plus:

| Field | Meaning |
|---|---|
| `captchaToken` | Turnstile token. Verify with `https://challenges.cloudflare.com/turnstile/v0/siteverify` before anything else. |
| `website` | Honeypot. If not empty, reply `201` with a fake body and drop the request. |
| `elapsedMs` | Time the form was open. Under ~3 s, treat as a bot (same fake `201`). |

Server must: re-validate every field (same rules as the Zod schema in `BookingSection.tsx`), recalculate the price (`src/lib/pricing.ts`), reject overlaps with `busy` ranges, closures included (`409 dates_taken`), store the booking as `pending`, generate a tracking token (≥ 192 random bits) and email the tracking link `https://rinconscout.mscjerez.es/reservas/<token>` to the responsible person. The site URL comes from backend config (e.g. `PUBLIC_SITE_URL`, `http://localhost:5173` in development). Admins can see the link again (`Booking.trackingToken`), so store the token encrypted, not hashed.

Response `201`: `{ "reference": "RCC-26-0012", "trackingToken": "…" }`

### `POST /api/v1/public/bookings/lookup`

Body `{ reference, captchaToken }`. Lets a group find its booking without the email link (page `/mi-reserva`). Match the reference ignoring case and separators.

- `200 { "trackingToken": "…" }` when it exists, `404` otherwise.
- The reference is the only key, so anyone who knows or guesses one can open that booking. Verify Turnstile first and rate-limit per IP (e.g. 10 lookups/hour), answering `429` with `Retry-After`. Consider non-sequential references (e.g. `RCC-26-K7Q3`) so they can't be guessed by counting.

### `GET /api/v1/public/bookings/:token`

Returns `PublicBooking` (no DNI, phone, email, internal notes or admin names). `404` if unknown.

- `timeline`: real status changes (`history` entries where `from !== to`), oldest first.
- `comments`: `Booking.comments` as `{ at, text }`.
- `cancelReason`: only when `status === 'cancelled'`.

### `POST /api/v1/public/bookings/:token/payment-proof`

`multipart/form-data` with `file` (PDF/JPEG/PNG, ≤ 5 MB) and `captchaToken`. Only allowed in `pending_payment` (`409` otherwise). Moves the booking to `confirmed` with `amountPaid = amountDue`, stores the proof with `verified: false`, writes the ledger entries and returns the updated `PublicBooking`.

## Admin auth

Session in a cookie: `HttpOnly; Secure; SameSite=Strict; Path=/v1/rcc/admin`, no `Domain`. The path is the one **the browser sees** (`api.mscjerez.es/v1/rcc/admin/…`), not the rewritten `/api/v1/admin` the backend receives; otherwise the browser never sends it back. `SameSite=Strict` still works because `rinconscout.mscjerez.es` and `api.mscjerez.es` are the same site.

CSRF (synchronizer token): each session has a random CSRF token, returned in the `X-XSRF-TOKEN` response header on `POST /admin/auth/mfa` and every authenticated admin response (the page can't read a cookie of another host, so there is no CSRF cookie). Mutating admin requests send it back in the `X-XSRF-TOKEN` header; the backend rejects a missing or different token (`403 csrf`) and an `Origin` outside `ALLOWED_ORIGINS` (`403 bad_origin`).

| Endpoint | Body | Response |
|---|---|---|
| `POST /api/v1/admin/auth/login` | `{ email, password }` | `{ mfaRequired: true, challengeId }` — never sets the session yet |
| `POST /api/v1/admin/auth/mfa` | `{ challengeId, code }` | `{ user }` + sets the session cookie. TOTP rules in [2FA.md](2FA.md#3-backend-verifying-the-code-at-login) |
| `GET /api/v1/admin/auth/session` | — | `{ user }` or `401` |
| `POST /api/v1/admin/auth/logout` | — | `204`, clears the session server-side |

Any other admin endpoint returning `401` makes the UI drop the session and show the login.

## Admin bookings

| Endpoint | Notes |
|---|---|
| `GET /api/v1/admin/bookings` | `Booking[]`, newest first |
| `GET /api/v1/admin/bookings/:id` | `Booking` |
| `POST /api/v1/admin/bookings` | Manual booking, `ManualBookingRequest`. Same validation as the web form except: past dates allowed; `dni`, `email` and `activity` may be empty; no captcha or consents. Created as `pending` with the admin as author of the first `history` entry (note "Creada desde el panel"), plus `free` and `internalNotes`. Still `409 dates_taken` over `busy` bookings or closures. `notifyGroup: true` emails the group its tracking link and requires `email` (`422` otherwise); the house is not notified. Returns `Booking` (`201`). |
| `POST /api/v1/admin/bookings/:id/transitions` | Body `TransitionPayload`. Enforce the `transitions` table; `409` with a message when not allowed. Returns `Booking`. |
| `PATCH /api/v1/admin/bookings/:id` | `{ keys?, internalNotes?, paymentProofVerified?, free? }`. Returns `Booking`. `free` can only change in `pending` or `pending_payment` (`409` otherwise) and adds a `history` entry with `from === to` and a note. |
| `POST /api/v1/admin/bookings/:id/comments` | `{ text }` (≤ 2000 chars). Message to the group, visible on the tracking page. Returns `Booking` (`201`). Optionally email the group. |
| `DELETE /api/v1/admin/bookings/:id/comments/:commentId` | Returns `Booking`. |
| `GET /api/v1/admin/bookings/:id/payment-proof` | The uploaded file, always as `Content-Disposition: attachment` with `nosniff`. The admin panel links to it directly. |

Transition side effects (see `applyTransition` in `src/mocks/db.ts`):

- `pending → pending_payment`: requires `amountDue > 0`; rejects if dates overlap another `busy` booking (`409 dates_taken`) or a closure (`409 dates_blocked`). A `note` is stored as a comment for the group. Email the group the amount and IBAN.
- `→ confirmed`: ledger `deposit_in` (min(deposit, paid)) + `income` (rest). **Free bookings** (`free: true`) only write `deposit_in`: they never count as income.
- `→ refund`: stores `{ deposit, payment, reason }`, nothing in the ledger yet.
- `refund → completed | cancelled`: marks the refund done; ledger `deposit_out` + `refund`.
- `confirmed → completed`: optional `depositRetained`; ledger `income` (retained) + `deposit_out` (full deposit).
- `→ cancelled`: requires `reason`.

Every transition appends to `history` with the admin's name and timestamp.

### Free bookings

`Booking.free` marks groups that stay for free. They pay only the deposit (the suggested `amountDue` is the deposit) and their payment is not income. The deposit is still tracked (`deposit_in` / `deposit_out`) because the money really goes in and out of the account; a retained deposit still counts as income since it pays for damage.

## Admin date blocks

Closed dates (maintenance, own use…). Inclusive ranges.

| Endpoint | Notes |
|---|---|
| `GET /api/v1/admin/blocks` | `DateBlock[]` sorted by `start` |
| `POST /api/v1/admin/blocks` | `NewDateBlock` `{ start, end, reason }`. `422` if `end < start` or no reason. Existing bookings are **not** cancelled; the UI warns about overlaps. Returns `DateBlock` (`201`). |
| `DELETE /api/v1/admin/blocks/:id` | `204` |

## Admin settings

| Endpoint | Notes |
|---|---|
| `GET /api/v1/admin/banner` | `SiteBanner` (all fields, with `updatedAt` / `updatedBy`; disabled and empty if never saved) |
| `PUT /api/v1/admin/banner` | `SiteBannerInput` `{ enabled, tone: 'info' \| 'warning', title (≤ 80), message (≤ 400), startsOn, endsOn }`. `422` if enabled without text or `endsOn < startsOn`; unknown fields are rejected. Returns `SiteBanner`. |
| `GET /api/v1/admin/system` | `{ api: { version, commit, startedAt, node } }`, shown in the panel next to the frontend's own version (`src/config/build.ts`). Admin-only so the public API doesn't reveal versions. |

## Admin ledger

| Endpoint | Notes |
|---|---|
| `GET /api/v1/admin/ledger` | `LedgerEntry[]` |
| `POST /api/v1/admin/ledger` | `NewLedgerEntry` (manual `income` or `expense`) |
| `DELETE /api/v1/admin/ledger/:id` | Only manual entries (`409` for automatic ones) |
