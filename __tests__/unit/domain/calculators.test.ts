// @vitest-environment node
import { describe, it, expect } from 'vitest'
import {
  countBusinessDays,
  hasEnoughBalance,
  previewRemainingBalance,
} from '@/domain/leave/calculators'
import type { LeaveBalance } from '@/types/leave'

const balance: LeaveBalance = {
  annual: 10,
  sick: 5,
  unpaid: 999,
  compassionate: 3,
  lastSynced: new Date().toISOString(),
}

// ── countBusinessDays ─────────────────────────────────────────────────────────
// Protects: form cannot submit with businessDays=0, balance preview accuracy

describe('countBusinessDays', () => {
  it('counts a single Monday as 1', () => {
    expect(countBusinessDays('2026-06-01', '2026-06-01')).toBe(1) // Monday
  })

  it('counts Mon–Fri as 5', () => {
    expect(countBusinessDays('2026-06-01', '2026-06-05')).toBe(5)
  })

  it('spans a weekend: Mon–Mon+1week = 6 business days', () => {
    expect(countBusinessDays('2026-06-01', '2026-06-08')).toBe(6) // Mon+5 + Mon
  })

  it('returns 0 for a Saturday', () => {
    expect(countBusinessDays('2026-06-06', '2026-06-06')).toBe(0)
  })

  it('returns 0 for a Sunday', () => {
    expect(countBusinessDays('2026-06-07', '2026-06-07')).toBe(0)
  })

  it('returns 0 for a Sat–Sun range', () => {
    expect(countBusinessDays('2026-06-06', '2026-06-07')).toBe(0)
  })

  it('counts a 2-week span correctly (10 business days)', () => {
    expect(countBusinessDays('2026-06-01', '2026-06-12')).toBe(10)
  })
})

// ── hasEnoughBalance ──────────────────────────────────────────────────────────
// Protects: form submit gate, overdraw prevention in approval card

describe('hasEnoughBalance', () => {
  it('returns true when annual balance >= requested days', () => {
    expect(hasEnoughBalance(balance, 'annual', 10)).toBe(true)
  })

  it('returns false when annual balance < requested days', () => {
    expect(hasEnoughBalance(balance, 'annual', 11)).toBe(false)
  })

  it('returns true when exactly equal', () => {
    expect(hasEnoughBalance(balance, 'annual', 10)).toBe(true)
  })

  it('always returns true for unpaid (no balance limit)', () => {
    const zeroed = { ...balance, unpaid: 0 }
    expect(hasEnoughBalance(zeroed, 'unpaid', 999)).toBe(true)
  })

  it('always returns true for compassionate (no balance check)', () => {
    const zeroed = { ...balance, compassionate: 0 }
    expect(hasEnoughBalance(zeroed, 'compassionate', 10)).toBe(true)
  })

  it('checks sick balance independently from annual', () => {
    expect(hasEnoughBalance(balance, 'sick', 5)).toBe(true)
    expect(hasEnoughBalance(balance, 'sick', 6)).toBe(false)
  })
})

// ── previewRemainingBalance ───────────────────────────────────────────────────
// Protects: BalancePreview UI shows correct remaining days; never goes negative

describe('previewRemainingBalance', () => {
  it('subtracts requested days from current balance', () => {
    expect(previewRemainingBalance(balance, 'annual', 3)).toBe(7)
  })

  it('returns 0 when fully exhausted (no negative days shown)', () => {
    expect(previewRemainingBalance(balance, 'annual', 10)).toBe(0)
  })

  it('floors at 0 even when overdrawing', () => {
    expect(previewRemainingBalance(balance, 'annual', 15)).toBe(0)
  })
})
