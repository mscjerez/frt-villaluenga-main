import { useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Plus, Download, Trash2 } from 'lucide-react'
import { expenseCategories, incomeCategories, kindLabel, summarize, type LedgerEntry, type LedgerKind } from '@/domain/finance'
import { ApiError } from '@/api/client'
import { fmtDate, money, toISODate } from '@/lib/format'
import { cn } from '@/lib/cn'
import { Alert, Button, Dialog, Field, Input, Panel, Select, Spinner } from '@/components/ui'
import { PageHeader } from './AdminLayout'
import { useAddEntry, useDeleteEntry, useLedger } from './queries'

// Validated categorical pair (CVD-safe on white): income blue, expenses ochre.
const INCOME = '#1f6fb2'
const EXPENSE = '#b9771a'
const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

type KindFilter = 'all' | LedgerKind

export function FinancePage() {
  const { data, isLoading } = useLedger()
  const thisYear = new Date().getFullYear()
  const [year, setYear] = useState(thisYear)
  const [kind, setKind] = useState<KindFilter>('all')
  const [adding, setAdding] = useState<'expense' | 'income' | null>(null)

  const years = useMemo(() => {
    const ys = new Set<number>([thisYear])
    for (const e of data ?? []) ys.add(Number(e.date.slice(0, 4)))
    return [...ys].sort((a, b) => b - a)
  }, [data, thisYear])

  const yearEntries = useMemo(() => (data ?? []).filter((e) => e.date.startsWith(String(year))), [data, year])
  const sum = summarize(yearEntries)

  const monthly = useMemo(
    () =>
      MONTHS.map((m, i) => {
        const prefix = `${year}-${String(i + 1).padStart(2, '0')}`
        const s = summarize(yearEntries.filter((e) => e.date.startsWith(prefix)))
        return { month: m, Ingresos: round(s.income - s.refunds), Gastos: round(s.expenses) }
      }),
    [yearEntries, year],
  )

  const byCategory = useMemo(() => {
    const map = new Map<string, number>()
    for (const e of yearEntries) if (e.kind === 'expense') map.set(e.category, (map.get(e.category) ?? 0) + e.amount)
    return [...map.entries()].sort((a, b) => b[1] - a[1])
  }, [yearEntries])
  const maxCat = byCategory[0]?.[1] ?? 0

  const rows = kind === 'all' ? yearEntries : yearEntries.filter((e) => e.kind === kind)

  if (isLoading) return <Spinner />

  return (
    <>
      <PageHeader
        title="Finanzas"
        description="Lo que entra y sale de la casa. Las fianzas se muestran aparte porque se devuelven."
        actions={
          <>
            <Select value={year} onChange={(e) => setYear(Number(e.target.value))} className="w-auto" aria-label="Año">
              {years.map((y) => (
                <option key={y}>{y}</option>
              ))}
            </Select>
            <Button variant="secondary" onClick={() => exportCsv(yearEntries, year)}>
              <Download className="size-4" aria-hidden />
              Exportar CSV
            </Button>
            <Button variant="secondary" onClick={() => setAdding('income')}>
              <Plus className="size-4" aria-hidden />
              Ingreso
            </Button>
            <Button onClick={() => setAdding('expense')}>
              <Plus className="size-4" aria-hidden />
              Gasto
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile label="Ingresos" value={money(sum.income - sum.refunds)} hint={sum.refunds ? `${money(sum.income)} cobrados − ${money(sum.refunds)} devueltos` : 'Estancias y otros ingresos'} swatch={INCOME} />
        <Tile label="Gastos" value={money(sum.expenses)} hint="Suministros, mantenimiento…" swatch={EXPENSE} />
        <Tile label="Balance" value={money(sum.net)} hint="Ingresos − gastos" className={sum.net >= 0 ? 'text-free' : 'text-busy'} />
        <Tile label="Fianzas en custodia" value={money(sum.depositsHeld)} hint="Cobradas y aún no devueltas" />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        <Panel title={`Ingresos y gastos por mes, ${year}`}>
          <div className="h-72 p-3 pr-5" role="img" aria-label={`Gráfico de ingresos y gastos mensuales de ${year}. Los datos están en la tabla de movimientos.`}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthly} barGap={2} barCategoryGap="22%">
                <CartesianGrid vertical={false} stroke="var(--color-piedra-200)" />
                <XAxis dataKey="month" tickLine={false} axisLine={{ stroke: 'var(--color-piedra-300)' }} tick={{ fill: 'var(--color-ink-soft)', fontSize: 12 }} />
                <YAxis tickLine={false} axisLine={false} width={56} tick={{ fill: 'var(--color-ink-soft)', fontSize: 12 }} tickFormatter={(v: number) => `${v} €`} />
                <Tooltip
                  cursor={{ fill: 'var(--color-piedra-100)' }}
                  formatter={(v) => money(Number(v))}
                  contentStyle={{ borderRadius: 10, border: '1px solid var(--color-piedra-200)', fontSize: 13 }}
                  labelStyle={{ color: 'var(--color-ink)', fontWeight: 600, textTransform: 'capitalize' }}
                />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 13, color: 'var(--color-ink-soft)' }} />
                <Bar dataKey="Ingresos" fill={INCOME} radius={[4, 4, 0, 0]} maxBarSize={18} isAnimationActive={false} />
                <Bar dataKey="Gastos" fill={EXPENSE} radius={[4, 4, 0, 0]} maxBarSize={18} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel title="Gastos por categoría">
          {byCategory.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-ink-soft">Sin gastos registrados en {year}.</p>
          ) : (
            <ul className="space-y-3 p-5">
              {byCategory.map(([cat, amount]) => (
                <li key={cat} className="text-sm">
                  <div className="flex justify-between gap-3">
                    <span>{cat}</span>
                    <span className="tabular text-ink-soft">{money(round(amount))}</span>
                  </div>
                  <div className="mt-1 h-2 rounded-full bg-piedra-100">
                    <div className="h-2 rounded-full" style={{ width: `${(amount / maxCat) * 100}%`, background: EXPENSE }} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <Panel
        className="mt-6"
        title="Movimientos"
        action={
          <Select value={kind} onChange={(e) => setKind(e.target.value as KindFilter)} className="h-8 w-auto text-sm" aria-label="Tipo de movimiento">
            <option value="all">Todos</option>
            {(Object.keys(kindLabel) as LedgerKind[]).map((k) => (
              <option key={k} value={k}>
                {kindLabel[k]}
              </option>
            ))}
          </Select>
        }
      >
        <LedgerTable rows={rows} />
      </Panel>

      <AddEntryDialog kind={adding} onClose={() => setAdding(null)} />
    </>
  )
}

const round = (n: number) => Math.round(n * 100) / 100

function Tile({ label, value, hint, className, swatch }: { label: string; value: string; hint: string; className?: string; swatch?: string }) {
  return (
    <div className="rounded-xl border border-piedra-200 bg-paper p-4">
      <p className="flex items-center gap-2 text-sm text-ink-soft">
        {swatch && <span className="size-2.5 rounded-full" style={{ background: swatch }} aria-hidden />}
        {label}
      </p>
      <p className={cn('mt-1 font-display text-2xl font-bold tabular sm:text-3xl', className)}>{value}</p>
      <p className="mt-1 text-xs text-ink-soft">{hint}</p>
    </div>
  )
}

const sign: Record<LedgerKind, 1 | -1> = { income: 1, deposit_in: 1, expense: -1, refund: -1, deposit_out: -1 }

function LedgerTable({ rows }: { rows: LedgerEntry[] }) {
  const del = useDeleteEntry()
  if (rows.length === 0) return <p className="px-5 py-10 text-center text-sm text-ink-soft">No hay movimientos.</p>
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-sm">
        <thead className="border-b border-piedra-200 bg-cal text-left text-xs text-ink-soft">
          <tr>
            <th className="px-5 py-2.5 font-medium">Fecha</th>
            <th className="px-3 py-2.5 font-medium">Concepto</th>
            <th className="px-3 py-2.5 font-medium">Categoría</th>
            <th className="px-3 py-2.5 text-right font-medium">Importe</th>
            <th className="px-5 py-2.5">
              <span className="sr-only">Acciones</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-piedra-200">
          {rows.map((e) => (
            <tr key={e.id}>
              <td className="whitespace-nowrap px-5 py-2.5 tabular text-ink-soft">{fmtDate(e.date)}</td>
              <td className="px-3 py-2.5">
                {e.description}
                {e.bookingId && (
                  <Link to={`/admin/reservas/${e.bookingId}`} className="ml-2 text-xs text-encina-600 hover:underline">
                    {e.bookingReference}
                  </Link>
                )}
              </td>
              <td className="px-3 py-2.5 text-ink-soft">
                {e.category}
                <span className="block text-xs">{kindLabel[e.kind]}</span>
              </td>
              <td className={cn('whitespace-nowrap px-3 py-2.5 text-right font-medium tabular', sign[e.kind] > 0 ? 'text-ink' : 'text-busy')}>
                {sign[e.kind] > 0 ? '+' : '−'}
                {money(e.amount)}
              </td>
              <td className="px-5 py-2.5 text-right">
                {!e.automatic && (
                  <button
                    className="rounded p-1 text-piedra-500 hover:bg-busy-bg hover:text-busy"
                    aria-label={`Borrar movimiento ${e.description}`}
                    onClick={() => confirm(`¿Borrar "${e.description}"?`) && del.mutate(e.id)}
                  >
                    <Trash2 className="size-4" />
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function AddEntryDialog({ kind, onClose }: { kind: 'expense' | 'income' | null; onClose: () => void }) {
  return (
    <Dialog open={!!kind} onClose={onClose} title={kind === 'income' ? 'Añadir ingreso' : 'Añadir gasto'}>
      {kind && <AddEntryForm key={kind} kind={kind} onClose={onClose} />}
    </Dialog>
  )
}

function AddEntryForm({ kind, onClose }: { kind: 'expense' | 'income'; onClose: () => void }) {
  const add = useAddEntry()
  const cats = kind === 'income' ? incomeCategories.filter((c) => c !== 'Estancias' && c !== 'Fianza retenida') : expenseCategories
  const [date, setDate] = useState(toISODate(new Date()))
  const [category, setCategory] = useState<string>(cats[0]!)
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [error, setError] = useState<string | null>(null)

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const n = Number(amount.replace(',', '.'))
    if (!(n > 0)) return setError('Indica un importe mayor que 0.')
    if (!description.trim()) return setError('Añade un concepto.')
    add.mutate({ date, kind, category, amount: round(n), description: description.trim().slice(0, 200) }, { onSuccess: onClose })
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Fecha">{(p) => <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} {...p} />}</Field>
        <Field label="Importe (€)">{(p) => <Input inputMode="decimal" autoFocus value={amount} onChange={(e) => setAmount(e.target.value)} {...p} />}</Field>
      </div>
      <Field label="Categoría">
        {(p) => (
          <Select value={category} onChange={(e) => setCategory(e.target.value)} {...p}>
            {cats.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </Select>
        )}
      </Field>
      <Field label="Concepto">
        {(p) => <Input value={description} maxLength={200} onChange={(e) => setDescription(e.target.value)} placeholder={kind === 'expense' ? 'Factura de la luz de marzo' : 'Donativo'} {...p} />}
      </Field>
      {(error || add.isError) && <Alert>{error ?? (add.error instanceof ApiError ? add.error.message : 'No se ha podido guardar.')}</Alert>}
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="ghost" onClick={onClose}>
          Cancelar
        </Button>
        <Button type="submit" loading={add.isPending}>
          {kind === 'income' ? 'Añadir ingreso' : 'Añadir gasto'}
        </Button>
      </div>
    </form>
  )
}

/** CSV with ; separator (Spanish Excel) and formula-injection protection. */
function exportCsv(entries: LedgerEntry[], year: number) {
  const cell = (v: string | number) => {
    let s = String(v)
    if (/^[=+\-@\t\r]/.test(s) && !/^-?[\d.,]+$/.test(s)) s = `'${s}`
    return `"${s.replace(/"/g, '""')}"`
  }
  const header = ['Fecha', 'Tipo', 'Categoría', 'Concepto', 'Reserva', 'Importe']
  const lines = entries.map((e) =>
    [e.date, kindLabel[e.kind], e.category, e.description, e.bookingReference ?? '', (sign[e.kind] * e.amount).toFixed(2).replace('.', ',')].map(cell).join(';'),
  )
  const blob = new Blob(['﻿' + [header.map(cell).join(';'), ...lines].join('\r\n')], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `finanzas-rincon-cura-carlos-${year}.csv`
  a.click()
  URL.revokeObjectURL(url)
}
