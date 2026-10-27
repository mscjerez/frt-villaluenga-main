import { Link } from 'react-router'

export function NotFound() {
  return (
    <div className="mx-auto max-w-xl px-4 py-24 text-center">
      <h1 className="text-4xl font-bold">Esta página no existe</h1>
      <p className="mt-3 text-ink-soft">Puede que el enlace esté mal copiado o que la página se haya movido.</p>
      <Link to="/" className="mt-8 inline-flex h-11 items-center rounded-lg bg-encina-600 px-5 font-medium text-white hover:bg-encina-700">
        Ir al inicio
      </Link>
    </div>
  )
}
