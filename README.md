# Rincón Cura Carlos · Reservas

Web de reservas de la casa Rincón Cura Carlos (Villaluenga del Rosario, Cádiz) y panel de gestión.

- **Web pública** (`/`): disponibilidad en calendario (libre / pendiente de confirmar / ocupado), precios con cálculo automático, formulario de solicitud con anti-spam, fotos, documentos descargables y preguntas frecuentes.
- **Seguimiento** (`/reservas/:token`): enlace personal, enviado por correo, donde el grupo ve el estado, los mensajes de la casa y sube el justificante de pago.
- **Mi reserva** (`/mi-reserva`): busca la reserva por su referencia y lleva al seguimiento.
- **Gestión** (`/admin`): panel con tareas pendientes, listado de reservas, ciclo de estados, control de llaves, reservas gratuitas, mensajes al grupo, cierre de fechas, calendario de ocupación y finanzas.

Producción: **https://rinconscout.mscjerez.es** (GitHub Pages), con la API en **https://api.mscjerez.es/v1/rcc** (Raspberry Pi, a través de la pasarela de `../gateway`). Desarrollo: http://localhost:5173.

## Stack

| Pieza | Elección | Por qué |
|---|---|---|
| Build | Vite + React 19 + TypeScript | SPA estática, se despliega en cualquier hosting; el backend va aparte |
| Rutas | React Router 8 (data router) | El panel de gestión se carga en un bundle aparte (lazy) |
| Datos | TanStack Query | Caché, reintentos e invalidación tras cada acción |
| Formularios | React Hook Form + Zod | Validación tipada (DNI/NIE con letra de control, teléfono, fechas, aforo) |
| Estilos | Tailwind CSS 4 | Tokens en `src/index.css` |
| Calendario | react-day-picker | Accesible, rango de fechas, días bloqueados |
| Gráficos | Recharts | Informe de finanzas |
| Anti-spam | Cloudflare Turnstile | Gratuito, sin puzles y sin cookies de seguimiento |
| Mock API | MSW | Simula el backend en el navegador mientras no existe |
| Fuentes | Fontsource (autoalojadas) | Sin peticiones a Google Fonts (RGPD) |

## Desarrollo

```bash
npm install
cp .env.example .env
npm run dev
```

Con `VITE_API_MOCK=true` (por defecto) la API se simula en el navegador con datos de ejemplo guardados en `localStorage`. Para reiniciarlos, borra la clave `rcc-mock-db-v1` del almacenamiento local.

Las credenciales de prueba del panel (usuario, contraseña y código 2FA fijo) están en `src/mocks/seed-credentials.ts`. Solo existen en desarrollo: el mock no se incluye en `npm run build`.

Para probar contra un backend local, pon `VITE_API_MOCK=false` y `API_PROXY_TARGET=http://localhost:8080` en `.env`: Vite reenvía `/api/*` al backend y el navegador sigue viendo el mismo origen, igual que en producción.

Scripts: `npm run dev`, `npm run build`, `npm run preview`, `npm run typecheck`, `npm run lint`.

## Qué tienes que personalizar

- `src/config/site.ts`: datos de contacto, IBAN, responsable del tratamiento (RGPD), aforo, precios, textos de FAQ.
- `public/photos/*.webp`: fotos de la casa (WebP, calidad ~85). Se listan en `site.ts`; si falta una, se muestra un hueco neutro.
- `public/docs/normas-de-la-casa.pdf` y `public/docs/parte-de-incidencias.pdf`: ahora son documentos de ejemplo.
- `src/features/public/PrivacyPage.tsx`: texto base de la política de privacidad; revísalo antes de publicar.
- `.env`: `VITE_TURNSTILE_SITE_KEY` con tu clave real de Turnstile (con `rinconscout.mscjerez.es` y `localhost` como dominios). `VITE_API_URL` solo si la API no va en `/api/v1` del mismo dominio.

## Ciclo de vida de una reserva

```
pending ──► pending_payment ──► confirmed ──► refund ──► completed
   │               │                │  │          │
   └──► cancelled ◄┘◄───────────────┘  └──────────┴──► completed / cancelled
            │
            └──► refund (si había pago)
```

| Estado | Entra cuando | Datos obligatorios |
|---|---|---|
| Pendiente | El grupo envía el formulario | — |
| Pendiente de pago | La gestión acepta | Importe a pagar |
| Confirmada | El grupo sube el justificante, o la gestión registra el pago | Importe y fecha de pago |
| Devolución | Hay que devolver fianza y/o pago | Importes y motivo |
| Cancelada | Por cualquier motivo | Motivo |
| Completada | Estancia cerrada (devolución hecha o fianza resuelta) | — |

Dentro de *Confirmada* se controla el subestado de llaves: sin entregar → entregadas → devueltas. Las tablas de transiciones están en `src/domain/booking.ts`; el backend debe aplicar exactamente las mismas.

Cada paso queda en el historial de la reserva y los cobros/devoluciones generan movimientos automáticos en finanzas. Las fianzas se contabilizan aparte (no son ingreso hasta que se retienen).

## Reservas gratuitas y cierres

- **Gratuita**: interruptor en el detalle de la reserva (solo antes de registrar el pago). Se pide solo la fianza y el cobro no cuenta como ingreso; la fianza sí se registra porque entra y sale de la cuenta.
- **Cerrar fechas**: en *Calendario*. Esos días salen como ocupados en la web (sin mostrar el motivo) y no se pueden pedir ni aceptar. No cancela reservas que ya existan: avisa de ellas.

## Despliegue en rinconscout.mscjerez.es

1. DNS: registro `CNAME rinconscout` → el hosting de la web (para GitHub Pages, `<usuario>.github.io`) y dominio personalizado configurado en el repositorio (*Settings → Pages*). Con dominio propio, el workflow compila con `BASE_PATH=/` automáticamente.
2. En el repositorio, *Settings → Secrets and variables → Actions → Variables*: `VITE_API_URL=https://api.mscjerez.es/v1/rcc` y `VITE_TURNSTILE_SITE_KEY` con la clave real. El workflow las usa al compilar.
   La API pasa por la pasarela de la Raspberry Pi (Cloudflare Tunnel + Traefik), que reescribe `/v1/rcc/…` a `/api/v1/…`: el backend implementa las rutas tal cual están en [docs/API.md](docs/API.md). Instalación en `../gateway/README.md`.
3. El backend necesita la URL pública para los enlaces de los correos (`https://rinconscout.mscjerez.es/reservas/<token>`; `http://localhost:5173` en desarrollo).
4. Cabeceras de seguridad: ver [docs/SECURITY.md](docs/SECURITY.md).

## Backend

El contrato de la API que espera el frontend está en [docs/API.md](docs/API.md) y los requisitos de seguridad en [docs/SECURITY.md](docs/SECURITY.md). Cómo activar la verificación en dos pasos con Google Authenticator (guía para el equipo y para el backend): [docs/2FA.md](docs/2FA.md). El backend real está en **`../rcc-api`** (Node + Fastify + PostgreSQL, en Docker para la Raspberry Pi); los handlers de `src/mocks/` aplican las mismas reglas para desarrollar sin backend.
