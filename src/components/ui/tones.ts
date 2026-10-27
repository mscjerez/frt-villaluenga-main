import type { Tone } from '@/domain/booking'

export const toneDot: Record<Tone, string> = {
  amber: 'bg-tentative',
  blue: 'bg-[#2f5d8a]',
  green: 'bg-free',
  violet: 'bg-[#5d4690]',
  red: 'bg-busy',
  stone: 'bg-piedra-500',
}
