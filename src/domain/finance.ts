export type LedgerKind = 'income' | 'expense' | 'refund' | 'deposit_in' | 'deposit_out'

export interface LedgerEntry {
  id: string
  date: string // yyyy-MM-dd
  kind: LedgerKind
  category: string
  amount: number // always positive; kind gives the sign
  description: string
  bookingId: string | null
  bookingReference: string | null
  createdBy: string
  automatic: boolean
}

export type NewLedgerEntry = Pick<LedgerEntry, 'date' | 'kind' | 'category' | 'amount' | 'description'>

export const expenseCategories = [
  'Luz',
  'Agua',
  'Gas / leña',
  'Limpieza',
  'Mantenimiento y reparaciones',
  'Material y equipamiento',
  'Seguros',
  'Impuestos y tasas',
  'Comisiones bancarias',
  'Otros gastos',
] as const

export const incomeCategories = ['Estancias', 'Donativos', 'Subvenciones', 'Fianza retenida', 'Otros ingresos'] as const

export const kindLabel: Record<LedgerKind, string> = {
  income: 'Ingreso',
  expense: 'Gasto',
  refund: 'Devolución',
  deposit_in: 'Fianza cobrada',
  deposit_out: 'Fianza devuelta',
}

export interface FinanceSummary {
  income: number
  refunds: number
  expenses: number
  net: number
  depositsHeld: number
}

export function summarize(entries: LedgerEntry[]): FinanceSummary {
  let income = 0
  let refunds = 0
  let expenses = 0
  let depIn = 0
  let depOut = 0
  for (const e of entries) {
    if (e.kind === 'income') income += e.amount
    else if (e.kind === 'refund') refunds += e.amount
    else if (e.kind === 'expense') expenses += e.amount
    else if (e.kind === 'deposit_in') depIn += e.amount
    else depOut += e.amount
  }
  return { income, refunds, expenses, net: income - refunds - expenses, depositsHeld: depIn - depOut }
}
