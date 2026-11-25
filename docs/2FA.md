# Two-step verification (Google Authenticator)

The admin login already has two steps: password, then a 6-digit code (`LoginPage.tsx`, `POST /api/v1/admin/auth/mfa`). The code is a standard **TOTP** (RFC 6238), so it works with Google Authenticator, Microsoft Authenticator, Authy, 1Password, Bitwarden, Aegis, etc.

This guide covers:

1. [Guide for the admin team](#1-guía-para-el-equipo-de-gestión) (Spanish, ready to send).
2. [Backend: enrolling an admin](#2-backend-enrolling-an-admin).
3. [Backend: verifying the code at login](#3-backend-verifying-the-code-at-login).
4. [Lost phone and resets](#4-lost-phone-and-resets).
5. [Local development](#5-local-development).

There is no enrollment screen in the panel: admins are enrolled from the server with the `rcc-api` command line (step 2), in person or over a video call.

---

## 1. Guía para el equipo de gestión

> Para entrar en el panel de gestión necesitas tu contraseña y un código de 6 cifras que genera una app en tu móvil. Así, aunque alguien averigüe tu contraseña, no puede entrar sin tu teléfono.

**Antes de empezar**

1. Instala **Google Authenticator** en tu móvil ([Android](https://play.google.com/store/apps/details?id=com.google.android.apps.authenticator2) · [iPhone](https://apps.apple.com/app/google-authenticator/id388497605)). Sirve cualquier app compatible (Microsoft Authenticator, Authy…).
2. Ten a mano la persona que gestiona el servidor: te enseñará un código QR. Es personal: no lo compartas ni le hagas foto.

**Activarlo (una sola vez)**

1. Abre Google Authenticator y pulsa **+** → **Escanear un código QR**.
2. Apunta la cámara al QR. Aparecerá «Rincón Scout Cura Carlos» con tu correo y un número de 6 cifras que cambia cada 30 segundos.
3. Dile a la persona que te da de alta el número que ves en ese momento, para comprobar que funciona.

Si no puedes escanear, elige **Introducir una clave de configuración**, escribe tu correo como nombre de cuenta, la clave que te den y deja **Basada en tiempo**.

**Entrar en el panel**

1. Ve a `https://rinconscout.mscjerez.es/admin` y escribe tu correo y contraseña.
2. Abre Google Authenticator y escribe el código de 6 cifras de «Rincón Scout Cura Carlos». Entra solo al completarlo.
3. Si el código está a punto de cambiar (el círculo casi vacío), espera al siguiente.

**Si algo falla**

- *«Código incorrecto»*: comprueba que la hora del móvil está en automático (Ajustes → Fecha y hora → automática). Un reloj desajustado genera códigos no válidos.
- *Cambias de móvil*: usa la opción de **Transferir cuentas** de Google Authenticator antes de borrar el antiguo, o pide que te den de alta de nuevo.
- *Pierdes el móvil*: avisa enseguida a quien gestiona el servidor para que desactive tu verificación y te dé de alta otra vez.

---

## 2. Backend: enrolling an admin

Implemented in `../rcc-api` (`src/cli.ts`, `src/auth/totp.ts`). On the Pi, from the `rcc-api` folder:

```bash
docker compose exec rcc-api node dist/cli.js admin:create carlos@mscjerez.es "Carlos"
```

It asks for the password twice (hidden, 12+ characters), then shows the QR in the terminal and the key for manual entry, and asks for the code the app shows. 2FA is saved only after a correct code. Other commands: `admin:list`, `admin:password <email>`, `admin:mfa-reset <email>`, `admin:delete <email>`.

What it does, for reference:

1. **Secret**: 20 random bytes from a CSPRNG, Base32 (32 characters).
2. **`otpauth://` URI** in the QR, with `SHA1`, `6` digits and `30` seconds (Google Authenticator ignores other values):

   ```
   otpauth://totp/Rinc%C3%B3n%20Scout%20Cura%20Carlos:carlos%40mscjerez.es?secret=…&issuer=Rinc%C3%B3n%20Scout%20Cura%20Carlos&algorithm=SHA1&digits=6&period=30
   ```

3. **Confirmation** with a real code before saving, which catches a bad scan or a phone with the wrong time.
4. **Storage**: the secret encrypted with AES-256-GCM (`APP_ENCRYPTION_KEY`, outside the database) in `admins.totp_secret_enc`, plus `mfa_enabled_at`.

Never send the QR or the key by email or chat.

---

## 3. Backend: verifying the code at login

`POST /api/v1/admin/auth/login` checks the password and returns `{ mfaRequired: true, challengeId }` without creating a session. `POST /api/v1/admin/auth/mfa` with `{ challengeId, code }` then:

1. Loads the challenge (random ID, valid **5 minutes**, single use, bound to the user). Expired or unknown → `401 challenge_expired` (the UI sends the user back to the password step).
2. Accepts only `^\d{6}$`.
3. Computes the TOTP for the current 30-second step and **one step either side** (±30 s for clock drift). Compare in constant time.
4. **Rejects replays**: the matched step must be greater than `totp_last_step`; then store it. A code can't be used twice, even within its 30 seconds.
5. Counts failures per challenge (max **5**, then the challenge stops working). Password failures lock the account for 15 minutes after 5 attempts, and the gateway limits these endpoints to 10 requests per minute per IP.
6. On success: delete the challenge, rotate the session ID, set the session cookie and return `{ user }`.
7. On failure: `401 invalid_code` with `{ "message": "Código incorrecto. Usa el código actual de tu app de autenticación." }`.

In `rcc-api` this is `verifyTotp` in `src/auth/totp.ts` (checked against the RFC 6238 test vectors in `test/unit.test.ts`) and the `/mfa` route in `src/routes/auth.ts`.

The server's clock must be synced (NTP; it is by default on most hosts), otherwise every code fails.

**Every admin must have 2FA.** An account without `mfa_enabled_at` must not be able to log in at all (never skip the second step for it).

---

## 4. Lost phone and resets

Without recovery codes in the UI, a reset is done on the server:

1. Verify the person's identity outside the website (call them).
2. Run `docker compose exec rcc-api node dist/cli.js admin:mfa-reset carlos@mscjerez.es`: it deletes the secret, **closes all their sessions** and starts a new enrollment right away (QR + code), so do it with the person present or on a call.

Optional improvement: one-time **recovery codes** (10 codes of 10 characters, stored hashed with Argon2, each usable once). That needs a small change to the login screen, which today only accepts 6 digits.

---

## 5. Local development

The mock backend (`src/mocks/`) doesn't run real TOTP: it accepts the fixed code in `src/mocks/seed-credentials.ts`. To try a real authenticator, run the real backend with `VITE_API_MOCK=false` and `API_PROXY_TARGET` (see the README), enroll a test admin with `npm run cli -- admin:create you@example.org "You"` from `rcc-api`, and scan the QR with your phone. Outside production the QR is labelled `Rincón Scout Cura Carlos (dev)`, so test and real entries don't get mixed up in the app.
