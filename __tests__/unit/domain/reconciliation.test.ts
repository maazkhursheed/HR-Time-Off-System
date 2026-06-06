// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { isBalanceStale, minutesSinceSync } from '@/domain/balance/reconciliation'

// ── isBalanceStale ────────────────────────────────────────────────────────────
// Protects: stale-cache regression — the UI must show a warning banner when HCM
// data is > 15 minutes old. If the threshold moves, tests fail immediately.
//
// The check is: Date.now() - syncedAt > 15 * 60 * 1000  (strictly greater).
// Exactly 15 min is NOT stale; 15 min + 1 ms IS stale.

const BASE_TIME = new Date('2026-06-10T12:00:00.000Z').getTime()

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(BASE_TIME)
})
afterEach(() => vi.useRealTimers())

function syncedAt(msAgo: number): string {
  return new Date(BASE_TIME - msAgo).toISOString()
}

const MIN_14_59 =  (14 * 60 + 59) * 1000          // 899 000 ms
const MIN_15_EXACT =  15 * 60 * 1000               // 900 000 ms
const MIN_15_PLUS1 = 15 * 60 * 1000 + 1            // 900 001 ms

describe('isBalanceStale', () => {
  it('just synced (10 seconds ago) → false', () => {
    expect(isBalanceStale(syncedAt(10_000))).toBe(false)
  })

  it('14 min 59 sec ago → false (within threshold)', () => {
    expect(isBalanceStale(syncedAt(MIN_14_59))).toBe(false)
  })

  it('exactly 15 min ago → false (boundary is exclusive)', () => {
    expect(isBalanceStale(syncedAt(MIN_15_EXACT))).toBe(false)
  })

  it('15 min + 1 ms ago → true (just over threshold)', () => {
    expect(isBalanceStale(syncedAt(MIN_15_PLUS1))).toBe(true)
  })

  it('20 min ago → true', () => {
    expect(isBalanceStale(syncedAt(20 * 60 * 1000))).toBe(true)
  })

  it('1 hour ago → true', () => {
    expect(isBalanceStale(syncedAt(60 * 60 * 1000))).toBe(true)
  })
})

// ── minutesSinceSync ──────────────────────────────────────────────────────────
// Protects: BalancePanelClient display ("Synced 20m ago") — floor ensures the
// label never exceeds actual elapsed time.

describe('minutesSinceSync', () => {
  it('59 seconds ago → 0 (floor)', () => {
    expect(minutesSinceSync(syncedAt(59_000))).toBe(0)
  })

  it('exactly 1 minute ago → 1', () => {
    expect(minutesSinceSync(syncedAt(60_000))).toBe(1)
  })

  it('90 seconds ago → 1 (floor, not round)', () => {
    expect(minutesSinceSync(syncedAt(90_000))).toBe(1)
  })

  it('20 minutes ago → 20', () => {
    expect(minutesSinceSync(syncedAt(20 * 60_000))).toBe(20)
  })

  it('returns 0 for a very recent sync (near zero)', () => {
    expect(minutesSinceSync(syncedAt(500))).toBe(0)
  })
})
