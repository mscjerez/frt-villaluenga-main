# Rincón Cura Carlos · Reservas

Web de reservas de la casa Rincón Cura Carlos (Villaluenga del Rosario, Cádiz) y panel de gestión.

- **Web pública** (`/`): disponibilidad en calendario (libre / pendiente de confirmar / ocupado), precios con cálculo automático, formulario de solicitud con anti-spam, fotos, documentos descargables y preguntas frecuentes.
- **Seguimiento** (`/reserva/:token`): enlace personal donde el grupo ve el estado y sube el justificante de pago.
- **Gestión** (`/admin`): panel con tareas pendientes, listado de reservas, ciclo de estados, control de llaves, calendario de ocupación y finanzas.

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

Scripts: `npm run dev`, `npm run build`, `npm run preview`, `npm run typecheck`, `npm run lint`.

## Qué tienes que personalizar

- `src/config/site.ts`: datos de contacto, IBAN, responsable del tratamiento (RGPD), aforo, precios, textos de FAQ.
- `public/photos/*.webp`: fotos de la casa (WebP, calidad ~85). Se listan en `site.ts`; si falta una, se muestra un hueco neutro.
- `public/docs/normas-de-la-casa.pdf` y `public/docs/parte-de-incidencias.pdf`: ahora son documentos de ejemplo.
- `src/features/public/PrivacyPage.tsx`: texto base de la política de privacidad; revísalo antes de publicar.
- `.env`: `VITE_TURNSTILE_SITE_KEY` con tu clave real de Turnstile, `VITE_API_MOCK=false` y `VITE_API_URL` si la API va en otro dominio.

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

## Backend

El contrato de la API que espera el frontend está en [docs/API.md](docs/API.md) y los requisitos de seguridad en [docs/SECURITY.md](docs/SECURITY.md). Los handlers de `src/mocks/` sirven de implementación de referencia.
