const DNI_LETTERS = 'TRWAGMYFPDXBNJZSQVHLCKE'

/** Validates Spanish DNI and NIE, including the control letter. */
export function isValidDniNie(raw: string): boolean {
  const value = raw.toUpperCase().replace(/[\s-]/g, '')
  const m = /^([XYZ]|\d)(\d{7})([A-Z])$/.exec(value)
  if (!m) return false
  const [, first = '', rest = '', letter] = m
  const prefix = first === 'X' ? '0' : first === 'Y' ? '1' : first === 'Z' ? '2' : first
  const num = Number(prefix + rest)
  return DNI_LETTERS[num % 23] === letter
}

export const normalizeDni = (raw: string) => raw.toUpperCase().replace(/[\s-]/g, '')

/** Spanish numbers (9 digits starting 6/7/8/9) with optional +34, or any international +XX number. */
export function isValidPhone(raw: string): boolean {
  const v = raw.replace(/[\s().-]/g, '')
  if (/^(\+34|0034)?[6789]\d{8}$/.test(v)) return true
  return /^\+(?!34)\d{8,15}$/.test(v)
}

/** Strips control characters; React escapes output, the backend must still sanitize and validate. */
// eslint-disable-next-line no-control-regex
export const cleanText = (s: string) => s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim()
