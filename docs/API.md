# API contract

All endpoints are JSON under `/api`. Types are defined in `src/domain/booking.ts`, `src/domain/finance.ts` and `src/api/*.ts`. The mock implementation in `src/mocks/handlers.ts` + `src/mocks/db.ts` is the executable reference.

## Errors

Any non-2xx response:

```json
{ "code": "dates_taken", "message": "Texto para mostrar al usuario", "fieldErrors": { "dni": "DNI no válido." } }
```

`message` is shown as-is (Spanish). `fieldErrors` keys match form field names. `429` responses should include `Retry-After` (seconds).

## Public

### `GET /api/public/availability?from=yyyy-MM-dd&to=yyyy-MM-dd`

Returns only date ranges and a state, **never** names or any personal data.

```json
[{ "start": "2026-11-06", "end": "2026-11-08", "status": "busy" }, { "start": "2026-12-18", "end": "2026-12-20", "status": "pending" }]
```

- `busy`: bookings in `pending_payment` or `confirmed`.
- `pending`: bookings in `pending`.
- Ranges are inclusive (arrival day to departure day).

### `POST /api/public/bookings`

Headers: `Idempotency-Key: <uuid>` (return the same response for a repeated key).

Body: `BookingRequest` plus:

| Field | Meaning |
|---|---|
| `captchaToken` | Turnstile token. Verify with `https://challenges.cloudflare.com/turnstile/v0/siteverify` before anything else. |
| `website` | Honeypot. If not empty, reply `201` with a fake body and drop the request. |
| `elapsedMs` | Time the form was open. Under ~3 s, treat as a bot (same fake `201`). |

Server must: re-validate every field (same rules as the Zod schema in `BookingSection.tsx`), recalculate the price (`src/lib/pricing.ts`), reject overlaps with `busy` ranges (`409 dates_taken`), store the booking as `pending`, generate a tracking token (≥ 192 bits, store only its hash), and email the tracking link to the responsible person.

Response `201`: `{ "reference": "RCC-26-0012", "trackingToken": "…" }`

### `GET /api/public/bookings/:token`

Returns `PublicBooking` (no DNI, phone or email). `404` if unknown.

### `POST /api/public/bookings/:token/payment-proof`

`multipart/form-data` with `file` (PDF/JPEG/PNG, ≤ 5 MB) and `captchaToken`. Only allowed in `pending_payment` (`409` otherwise). Moves the booking to `confirmed` with `amountPaid = amountDue`, stores the proof with `verified: false`, writes the ledger entries and returns the updated `PublicBooking`.

## Admin auth

Session in a cookie: `HttpOnly; Secure; SameSite=Strict; Path=/api/admin`. Mutating requests carry `X-XSRF-TOKEN` matching a readable `XSRF-TOKEN` cookie.

| Endpoint | Body | Response |
|---|---|---|
| `POST /api/admin/auth/login` | `{ email, password }` | `{ mfaRequired: true, challengeId }` — never sets the session yet |
| `POST /api/admin/auth/mfa` | `{ challengeId, code }` | `{ user }` + sets the session cookie |
| `GET /api/admin/auth/session` | — | `{ user }` or `401` |
| `POST /api/admin/auth/logout` | — | `204`, clears the session server-side |

Any other admin endpoint returning `401` makes the UI drop the session and show the login.

## Admin bookings

| Endpoint | Notes |
|---|---|
| `GET /api/admin/bookings` | `Booking[]`, newest first |
| `GET /api/admin/bookings/:id` | `Booking` |
| `POST /api/admin/bookings/:id/transitions` | Body `TransitionPayload`. Enforce the `transitions` table; `409` with a message when not allowed. Returns `Booking`. |
| `PATCH /api/admin/bookings/:id` | `{ keys?, internalNotes?, paymentProofVerified? }`. Returns `Booking`. |

Transition side effects (see `applyTransition` in `src/mocks/db.ts`):

- `pending → pending_payment`: requires `amountDue > 0`; rejects if dates overlap another `busy` booking. Email the group the amount and IBAN.
- `→ confirmed`: ledger `deposit_in` (min(deposit, paid)) + `income` (rest).
- `→ refund`: stores `{ deposit, payment, reason }`, nothing in the ledger yet.
- `refund → completed | cancelled`: marks the refund done; ledger `deposit_out` + `refund`.
- `confirmed → completed`: optional `depositRetained`; ledger `income` (retained) + `deposit_out` (full deposit).
- `→ cancelled`: requires `reason`.

Every transition appends to `history` with the admin's name and timestamp.

## Admin ledger

| Endpoint | Notes |
|---|---|
| `GET /api/admin/ledger` | `LedgerEntry[]` |
| `POST /api/admin/ledger` | `NewLedgerEntry` (manual `income` or `expense`) |
| `DELETE /api/admin/ledger/:id` | Only manual entries (`409` for automatic ones) |
