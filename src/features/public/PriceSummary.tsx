import { estimatePrice } from '@/lib/pricing'
import { fmtRange, money } from '@/lib/format'

export function PriceSummary({ arrival, departure, guests }: { arrival: string; departure: string; guests: number }) {
  const est = estimatePrice(arrival, departure, guests)
  return (
    <div className="rounded-xl bg-encina-700 p-5 text-encina-50" aria-live="polite">
      <p className="text-sm text-encina-100">Precio estimado</p>
      {!est ? (
        <p className="mt-2 text-sm leading-relaxed text-encina-100">Elige las fechas en el calendario e indica cuántas personas venís para ver el precio.</p>
      ) : (
        <>
          <p className="mt-1 text-sm">
            {fmtRange(arrival, departure)} · {est.nights === 0 ? 'sin noche' : `${est.nights} ${est.nights === 1 ? 'noche' : 'noches'}`} · {guests}{' '}
            {guests === 1 ? 'persona' : 'personas'}
          </p>
          <dl className="mt-4 space-y-2 text-sm tabular">
            {est.lines.map((l) => (
              <div key={l.label} className="flex justify-between gap-4">
                <dt>
                  {l.units > 1 && `${l.units} × `}
                  {l.label} <span className="text-encina-100">({l.guests} × {money(l.unitPrice)})</span>
                </dt>
                <dd>{money(l.amount)}</dd>
              </div>
            ))}
            <div className="flex justify-between gap-4">
              <dt>Fianza (se devuelve)</dt>
              <dd>{money(est.deposit)}</dd>
            </div>
          </dl>
          <div className="mt-4 flex items-end justify-between border-t border-white/15 pt-4">
            <span className="text-sm">Total a pagar</span>
            <span className="font-display text-4xl font-bold tabular text-white">{money(est.total)}</span>
          </div>
          <p className="mt-3 text-xs leading-relaxed text-encina-100">Te confirmamos el importe final al aceptar la solicitud.</p>
        </>
      )}
    </div>
  )
}
