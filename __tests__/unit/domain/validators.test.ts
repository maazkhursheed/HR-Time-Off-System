// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  validateDateRange,
  validateMinNotice,
  validateBlackoutDates,
} from '@/domain/leave/validators'
import { validateSufficientBalance } from '@/domain/balance/validators'
import type { LeaveBalance } from '@/types/leave'

// Pin today to a fixed Wednesday so notice-window assertions are deterministic.
// All "days ahead" comments below are relative to 2026-06-10.
const TODAY = '2026-06-10'

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(TODAY))
})
afterEach(() => vi.useRealTimers())

const FULL_BALANCE: LeaveBalance = {
  annual: 10,
  sick: 5,
  unpaid: 0,
  compassionate: 3,
  lastSynced: new Date().toISOString(),
}

// ── validateDateRange ─────────────────────────────────────────────────────────
// Protects: malformed payloads never reach HCM; first client-side gate

describe('validateDateRange', () => {
  it('returns null for a valid range', () => {
    expect(validateDateRange({ startDate: '2026-07-01', endDate: '2026-07-05' })).toBeNull()
  })

  it('returns null for a same-day range', () => {
    expect(validateDateRange({ startDate: '2026-07-01', endDate: '2026-07-01' })).toBeNull()
  })

  it('errors when start is after end', () => {
    const err = validateDateRange({ startDate: '2026-07-10', endDate: '2026-07-01' })
    expect(err?.code).toBe('MIN_NOTICE_VIOLATION')
    expect(err?.field).toBe('startDate')
    expect(err?.message).toMatch(/before end/i)
  })

  it('errors for an unparseable start date', () => {
    const err = validateDateRange({ startDate: 'not-a-date', endDate: '2026-07-01' })
    expect(err?.code).toBe('MIN_NOTICE_VIOLATION')
  })

  it('errors for an empty end date', () => {
    const err = validateDateRange({ startDate: '2026-07-01', endDate: '' })
    expect(err?.code).toBe('MIN_NOTICE_VIOLATION')
  })
})

// ── validateMinNotice ─────────────────────────────────────────────────────────
// Protects: annual (3 days), unpaid (5 days), sick/compassionate (0 days — never blocked)
// Regression: if MIN_NOTICE_DAYS table changes, tests catch mismatches immediately

describe('validateMinNotice', () => {
  // Annual: 3 days required
  it('annual with 3 days notice → null', () => {
    expect(validateMinNotice('2026-06-13', 'annual')).toBeNull() // 3 days ahead
  })

  it('annual with 2 days notice → MIN_NOTICE_VIOLATION', () => {
    const err = validateMinNotice('2026-06-12', 'annual')
    expect(err?.code).toBe('MIN_NOTICE_VIOLATION')
    expect(err?.field).toBe('startDate')
    expect(err?.message).toContain('3')
  })

  it('annual same day → MIN_NOTICE_VIOLATION', () => {
    expect(validateMinNotice(TODAY, 'annual')?.code).toBe('MIN_NOTICE_VIOLATION')
  })

  // Sick: 0 days required — can book on the day
  it('sick same day → null', () => {
    expect(validateMinNotice(TODAY, 'sick')).toBeNull()
  })

  it('sick in the past → MIN_NOTICE_VIOLATION (past < 0 days)', () => {
    expect(validateMinNotice('2026-06-09', 'sick')?.code).toBe('MIN_NOTICE_VIOLATION')
  })

  // Unpaid: 5 days required
  it('unpaid with 5 days notice → null', () => {
    expect(validateMinNotice('2026-06-15', 'unpaid')).toBeNull() // 5 days ahead
  })

  it('unpaid with 4 days notice → MIN_NOTICE_VIOLATION', () => {
    const err = validateMinNotice('2026-06-14', 'unpaid')
    expect(err?.code).toBe('MIN_NOTICE_VIOLATION')
    expect(err?.message).toContain('5')
  })

  // Compassionate: 0 days required — emergency leave, never blocked
  it('compassionate same day → null', () => {
    expect(validateMinNotice(TODAY, 'compassionate')).toBeNull()
  })
})

// ── validateBlackoutDates ─────────────────────────────────────────────────────
// Protects: blackout policy enforcement. Currently no blackout dates configured,
// so this guards the code path for when dates are added later.

describe('validateBlackoutDates', () => {
  it('returns null when no blackout dates are configured', () => {
    expect(validateBlackoutDates({ startDate: '2026-12-24', endDate: '2026-12-31' })).toBeNull()
  })

  it('returns null for any arbitrary range (empty blackout list)', () => {
    expect(validateBlackoutDates({ startDate: '2026-01-01', endDate: '2026-01-01' })).toBeNull()
  })
})

// ── validateSufficientBalance ─────────────────────────────────────────────────
// Protects: annual/sick cannot be overdrawn; unpaid/compassionate bypass the check.
// Regression: if logic flips to checking unpaid, employees get false refusals.

describe('validateSufficientBalance', () => {
  it('annual exactly equal to available → null (boundary)', () => {
    expect(validateSufficientBalance(FULL_BALANCE, 'annual', 10)).toBeNull()
  })

  it('annual 1 under available → null', () => {
    expect(validateSufficientBalance(FULL_BALANCE, 'annual', 9)).toBeNull()
  })

  it('annual 1 over available → INSUFFICIENT_BALANCE', () => {
    const err = validateSufficientBalance(FULL_BALANCE, 'annual', 11)
    expect(err?.code).toBe('INSUFFICIENT_BALANCE')
    expect(err?.field).toBe('type')
    expect(err?.message).toContain('10') // available days in message
  })

  it('annual message includes the requested count', () => {
    const err = validateSufficientBalance(FULL_BALANCE, 'annual', 15)
    expect(err?.message).toContain('15')
  })

  it('sick exactly equal → null', () => {
    expect(validateSufficientBalance(FULL_BALANCE, 'sick', 5)).toBeNull()
  })

  it('sick over available → INSUFFICIENT_BALANCE', () => {
    expect(validateSufficientBalance(FULL_BALANCE, 'sick', 6)?.code).toBe('INSUFFICIENT_BALANCE')
  })

  it('unpaid with zero balance → null (no balance gate)', () => {
    expect(validateSufficientBalance({ ...FULL_BALANCE, unpaid: 0 }, 'unpaid', 999)).toBeNull()
  })

  it('compassionate with zero balance → null (no balance gate)', () => {
    expect(
      validateSufficientBalance({ ...FULL_BALANCE, compassionate: 0 }, 'compassionate', 999)
    ).toBeNull()
  })

  it('annual and sick are checked independently (sick passes, annual fails)', () => {
    const balance: LeaveBalance = { ...FULL_BALANCE, annual: 0, sick: 5 }
    expect(validateSufficientBalance(balance, 'sick', 5)).toBeNull()
    expect(validateSufficientBalance(balance, 'annual', 1)?.code).toBe('INSUFFICIENT_BALANCE')
  })
})
