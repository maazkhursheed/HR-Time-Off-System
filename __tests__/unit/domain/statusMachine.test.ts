// @vitest-environment node
import { describe, it, expect } from 'vitest'
import {
  isValidTransition,
  isTerminalStatus,
  isStatusRegression,
} from '@/domain/request/statusMachine'

// ── isValidTransition ─────────────────────────────────────────────────────────
// Protects: incorrect approval state — only managers approve/reject; employees
// cancel their own pending requests. Terminal statuses accept no further actions.

describe('isValidTransition — employee', () => {
  it('pending → cancelled is allowed', () => {
    expect(isValidTransition('pending', 'cancelled', 'employee')).toBe(true)
  })

  it('pending → approved is NOT allowed (only manager approves)', () => {
    expect(isValidTransition('pending', 'approved', 'employee')).toBe(false)
  })

  it('pending → rejected is NOT allowed (only manager rejects)', () => {
    expect(isValidTransition('pending', 'rejected', 'employee')).toBe(false)
  })

  it('approved → cancelled is NOT allowed for employee', () => {
    expect(isValidTransition('approved', 'cancelled', 'employee')).toBe(false)
  })
})

describe('isValidTransition — manager', () => {
  it('pending → approved is allowed', () => {
    expect(isValidTransition('pending', 'approved', 'manager')).toBe(true)
  })

  it('pending → rejected is allowed', () => {
    expect(isValidTransition('pending', 'rejected', 'manager')).toBe(true)
  })

  it('approved → cancelled is allowed (manager revokes)', () => {
    expect(isValidTransition('approved', 'cancelled', 'manager')).toBe(true)
  })

  it('pending → cancelled is NOT allowed for manager', () => {
    expect(isValidTransition('pending', 'cancelled', 'manager')).toBe(false)
  })

  it('approved → approved is NOT a valid self-transition', () => {
    expect(isValidTransition('approved', 'approved', 'manager')).toBe(false)
  })
})

describe('isValidTransition — terminal statuses', () => {
  it('rejected is terminal: no transitions allowed for any role', () => {
    expect(isValidTransition('rejected', 'pending', 'manager')).toBe(false)
    expect(isValidTransition('rejected', 'approved', 'manager')).toBe(false)
    expect(isValidTransition('rejected', 'cancelled', 'employee')).toBe(false)
  })

  it('cancelled is terminal: no transitions allowed', () => {
    expect(isValidTransition('cancelled', 'pending', 'manager')).toBe(false)
    expect(isValidTransition('cancelled', 'approved', 'manager')).toBe(false)
  })

  it('rejected_by_hcm is terminal: no transitions allowed', () => {
    expect(isValidTransition('rejected_by_hcm', 'pending', 'manager')).toBe(false)
    expect(isValidTransition('rejected_by_hcm', 'approved', 'manager')).toBe(false)
  })
})

// ── isTerminalStatus ──────────────────────────────────────────────────────────
// Protects: prevents double-processing of closed requests (e.g., re-approving
// a cancelled request in the manager UI after a race condition)

describe('isTerminalStatus', () => {
  it('rejected → true', () => expect(isTerminalStatus('rejected')).toBe(true))
  it('cancelled → true', () => expect(isTerminalStatus('cancelled')).toBe(true))
  it('rejected_by_hcm → true', () => expect(isTerminalStatus('rejected_by_hcm')).toBe(true))
  it('pending → false', () => expect(isTerminalStatus('pending')).toBe(false))
  it('approved → false', () => expect(isTerminalStatus('approved')).toBe(false))
})

// ── isStatusRegression ────────────────────────────────────────────────────────
// Protects: balance-restoration trigger — regression fires when an in-progress
// request moves to a terminal non-approved state, prompting cache invalidation.

describe('isStatusRegression', () => {
  it('pending → rejected = true (progress lost)', () => {
    expect(isStatusRegression('pending', 'rejected')).toBe(true)
  })

  it('pending → cancelled = true', () => {
    expect(isStatusRegression('pending', 'cancelled')).toBe(true)
  })

  it('pending → rejected_by_hcm = true (silent HCM rejection)', () => {
    expect(isStatusRegression('pending', 'rejected_by_hcm')).toBe(true)
  })

  it('approved → rejected = true (approval revoked)', () => {
    expect(isStatusRegression('approved', 'rejected')).toBe(true)
  })

  it('approved → cancelled = true (approval revoked)', () => {
    expect(isStatusRegression('approved', 'cancelled')).toBe(true)
  })

  it('pending → approved = false (positive direction)', () => {
    expect(isStatusRegression('pending', 'approved')).toBe(false)
  })

  it('rejected → cancelled = false (both terminal, no rank to lose)', () => {
    expect(isStatusRegression('rejected', 'cancelled')).toBe(false)
  })

  it('cancelled → rejected = false', () => {
    expect(isStatusRegression('cancelled', 'rejected')).toBe(false)
  })
})
