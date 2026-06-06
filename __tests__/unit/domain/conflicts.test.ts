// @vitest-environment node
import { describe, it, expect } from 'vitest'
import {
  datesOverlap,
  findOverlappingRequests,
  countTeamOverlaps,
} from '@/domain/leave/conflicts'
import type { LeaveRequest } from '@/types/leave'

function makeRequest(
  id: string,
  userId: string,
  startDate: string,
  endDate: string,
  status: LeaveRequest['status'] = 'pending'
): LeaveRequest {
  return {
    id,
    userId,
    type: 'annual',
    startDate,
    endDate,
    businessDays: 1,
    status,
    idempotencyKey: '',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  }
}

// ── datesOverlap ──────────────────────────────────────────────────────────────
// Protects: calendar accuracy — overlapping requests must be surfaced before approval

describe('datesOverlap', () => {
  it('identical ranges overlap', () => {
    expect(datesOverlap({ startDate: '2026-07-01', endDate: '2026-07-05' },
                         { startDate: '2026-07-01', endDate: '2026-07-05' })).toBe(true)
  })

  it('adjacent ranges share a boundary and overlap (inclusive)', () => {
    expect(datesOverlap({ startDate: '2026-07-01', endDate: '2026-07-05' },
                         { startDate: '2026-07-05', endDate: '2026-07-10' })).toBe(true)
  })

  it('completely separate ranges do not overlap', () => {
    expect(datesOverlap({ startDate: '2026-07-01', endDate: '2026-07-03' },
                         { startDate: '2026-07-10', endDate: '2026-07-15' })).toBe(false)
  })

  it('A contains B → overlap', () => {
    expect(datesOverlap({ startDate: '2026-07-01', endDate: '2026-07-20' },
                         { startDate: '2026-07-05', endDate: '2026-07-10' })).toBe(true)
  })

  it('partial left overlap → overlap', () => {
    expect(datesOverlap({ startDate: '2026-07-01', endDate: '2026-07-08' },
                         { startDate: '2026-07-06', endDate: '2026-07-12' })).toBe(true)
  })

  it('gap of 1 day → no overlap', () => {
    expect(datesOverlap({ startDate: '2026-07-01', endDate: '2026-07-04' },
                         { startDate: '2026-07-05', endDate: '2026-07-10' })).toBe(false)
  })
})

// ── findOverlappingRequests ───────────────────────────────────────────────────
// Protects: prevents approving two requests for the same user over the same dates;
// only pending and approved statuses create a live conflict

describe('findOverlappingRequests', () => {
  const candidate = { startDate: '2026-07-05', endDate: '2026-07-10' }
  const pending  = makeRequest('r1', 'u1', '2026-07-03', '2026-07-07', 'pending')
  const approved = makeRequest('r2', 'u1', '2026-07-08', '2026-07-12', 'approved')
  const rejected = makeRequest('r3', 'u1', '2026-07-06', '2026-07-09', 'rejected')
  const cancelled = makeRequest('r4', 'u1', '2026-07-06', '2026-07-09', 'cancelled')
  const hcmReject = makeRequest('r5', 'u1', '2026-07-06', '2026-07-09', 'rejected_by_hcm')

  it('finds pending conflicts', () => {
    const result = findOverlappingRequests(candidate, [pending])
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('r1')
  })

  it('finds approved conflicts', () => {
    const result = findOverlappingRequests(candidate, [approved])
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('r2')
  })

  it('ignores rejected requests (no longer active)', () => {
    expect(findOverlappingRequests(candidate, [rejected])).toHaveLength(0)
  })

  it('ignores cancelled requests', () => {
    expect(findOverlappingRequests(candidate, [cancelled])).toHaveLength(0)
  })

  it('ignores rejected_by_hcm requests', () => {
    expect(findOverlappingRequests(candidate, [hcmReject])).toHaveLength(0)
  })

  it('returns multiple overlaps when present', () => {
    expect(findOverlappingRequests(candidate, [pending, approved])).toHaveLength(2)
  })

  it('returns empty when no requests overlap', () => {
    const noOverlap = makeRequest('r6', 'u1', '2026-08-01', '2026-08-05', 'pending')
    expect(findOverlappingRequests(candidate, [noOverlap])).toHaveLength(0)
  })
})

// ── countTeamOverlaps ─────────────────────────────────────────────────────────
// Protects: team coverage threshold — only APPROVED requests from OTHER members
// count. Own user excluded, pending excluded (not yet committed to calendar).

describe('countTeamOverlaps', () => {
  const candidate = { startDate: '2026-07-05', endDate: '2026-07-10' }
  const OTHER_USER = 'user-other'
  const OWN_USER   = 'user-self'

  const approvedOther  = makeRequest('r1', OTHER_USER, '2026-07-06', '2026-07-08', 'approved')
  const pendingOther   = makeRequest('r2', OTHER_USER, '2026-07-06', '2026-07-08', 'pending')
  const approvedSelf   = makeRequest('r3', OWN_USER,   '2026-07-06', '2026-07-08', 'approved')
  const noOverlapOther = makeRequest('r4', OTHER_USER, '2026-08-01', '2026-08-05', 'approved')

  it('counts approved requests from other users', () => {
    expect(countTeamOverlaps(candidate, [approvedOther], OWN_USER)).toBe(1)
  })

  it('does NOT count pending requests (not yet committed)', () => {
    expect(countTeamOverlaps(candidate, [pendingOther], OWN_USER)).toBe(0)
  })

  it('does NOT count the requesting user\'s own approved requests', () => {
    expect(countTeamOverlaps(candidate, [approvedSelf], OWN_USER)).toBe(0)
  })

  it('does NOT count non-overlapping requests', () => {
    expect(countTeamOverlaps(candidate, [noOverlapOther], OWN_USER)).toBe(0)
  })

  it('returns correct count with mixed requests', () => {
    const reqs = [approvedOther, pendingOther, approvedSelf, noOverlapOther]
    expect(countTeamOverlaps(candidate, reqs, OWN_USER)).toBe(1)
  })
})
