import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useRejectRequest } from '@/lib/mutations/useRejectRequest'
import { useUIStore } from '@/store/useUIStore'
import { queryKeys } from '@/lib/query/keys'
import type { LeaveRequest } from '@/types/leave'

vi.mock('@/lib/actions/rejectRequest', () => ({
  rejectRequest: vi.fn(),
}))

import { rejectRequest } from '@/lib/actions/rejectRequest'
const mockReject = vi.mocked(rejectRequest)

// ── Fixtures ──────────────────────────────────────────────────────────────────

const PENDING_REQUEST: LeaveRequest = {
  id: 'req-001',
  userId: 'user-emp-001',
  type: 'annual',
  startDate: '2026-07-01',
  endDate: '2026-07-03',
  businessDays: 3,
  status: 'pending',
  idempotencyKey: 'idem-001',
  createdAt: '2026-06-01T10:00:00Z',
  updatedAt: '2026-06-01T10:00:00Z',
}

const VARS = {
  requestId: 'req-001',
  managerId: 'user-mgr-001',
  employeeId: 'user-emp-001',
  note: 'Insufficient coverage',
}

function makeWrapper() {
  const qc = new QueryClient({
    // gcTime: Infinity keeps setQueryData entries alive for rollback assertions.
    defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false } },
  })
  qc.setQueryData<LeaveRequest[]>(queryKeys.teamRequests(VARS.managerId), [PENDING_REQUEST])
  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  )
  return { qc, Wrapper }
}

beforeEach(() => {
  vi.clearAllMocks()
  useUIStore.setState({ requestModal: { open: false }, activeFilters: { status: [], type: [] }, toastQueue: [] })
})
afterEach(() => {
  useUIStore.setState({ requestModal: { open: false }, activeFilters: { status: [], type: [] }, toastQueue: [] })
})

// ── Tests ─────────────────────────────────────────────────────────────────────
// Protects: incorrect approval state — same optimistic-then-rollback contract as
// approve; additionally ensures employee balance is invalidated on rejection so
// the reserved days are returned to the balance display.

describe('useRejectRequest — optimistic update', () => {
  it('removes the request from teamRequests immediately', async () => {
    let resolveAction!: (v: { success: boolean }) => void
    mockReject.mockImplementation(() => new Promise((res) => { resolveAction = res }))

    const { qc, Wrapper } = makeWrapper()
    const { result } = renderHook(() => useRejectRequest(), { wrapper: Wrapper })

    act(() => { result.current.mutate(VARS) })

    await waitFor(() => {
      const data = qc.getQueryData<LeaveRequest[]>(queryKeys.teamRequests(VARS.managerId))
      return data?.every((r) => r.id !== 'req-001') ?? false
    })

    resolveAction({ success: true })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
  })
})

describe('useRejectRequest — success path', () => {
  beforeEach(() => { mockReject.mockResolvedValue({ success: true }) })

  it('shows a success toast', async () => {
    const { Wrapper } = makeWrapper()
    const { result } = renderHook(() => useRejectRequest(), { wrapper: Wrapper })

    await act(async () => { result.current.mutate(VARS) })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    const toast = useUIStore.getState().toastQueue[0]
    expect(toast?.variant).toBe('success')
    expect(toast?.message).toContain('rejected')
  })

  it('invalidates employee balance so reserved days are restored', async () => {
    const { qc, Wrapper } = makeWrapper()
    const spy = vi.spyOn(qc, 'invalidateQueries')

    const { result } = renderHook(() => useRejectRequest(), { wrapper: Wrapper })
    await act(async () => { result.current.mutate(VARS) })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    const keys = spy.mock.calls.map(([opts]) => (opts as { queryKey?: unknown[] }).queryKey)
    const balanceInvalidated = keys.some((k) => k?.[0] === 'balance' && k?.[1] === VARS.employeeId)
    expect(balanceInvalidated).toBe(true)
  })

  it('invalidates teamRequests in onSettled to keep manager list fresh', async () => {
    const { qc, Wrapper } = makeWrapper()
    const spy = vi.spyOn(qc, 'invalidateQueries')

    const { result } = renderHook(() => useRejectRequest(), { wrapper: Wrapper })
    await act(async () => { result.current.mutate(VARS) })
    await waitFor(() => !result.current.isPending)

    const keys = spy.mock.calls.map(([opts]) => (opts as { queryKey?: unknown[] }).queryKey)
    expect(keys.some((k) => k?.[0] === 'team-requests')).toBe(true)
  })
})

describe('useRejectRequest — application-level failure (result.success=false)', () => {
  it('restores the previous teamRequests (rollback)', async () => {
    mockReject.mockResolvedValue({ success: false, error: { code: 'UNKNOWN', message: 'Failed.' } })

    const { qc, Wrapper } = makeWrapper()
    const { result } = renderHook(() => useRejectRequest(), { wrapper: Wrapper })

    await act(async () => { result.current.mutate(VARS) })
    await waitFor(() => !result.current.isPending)

    const data = qc.getQueryData<LeaveRequest[]>(queryKeys.teamRequests(VARS.managerId))
    expect(data?.find((r) => r.id === 'req-001')).toBeDefined()
  })

  it('shows an error toast on application failure', async () => {
    mockReject.mockResolvedValue({ success: false, error: { code: 'UNKNOWN', message: 'Rejection failed.' } })

    const { Wrapper } = makeWrapper()
    const { result } = renderHook(() => useRejectRequest(), { wrapper: Wrapper })

    await act(async () => { result.current.mutate(VARS) })
    await waitFor(() => !result.current.isPending)

    expect(useUIStore.getState().toastQueue[0]?.variant).toBe('error')
  })
})

describe('useRejectRequest — network failure (thrown error)', () => {
  it('restores previous teamRequests on network error', async () => {
    mockReject.mockRejectedValue(new Error('Network error'))

    const { qc, Wrapper } = makeWrapper()
    const { result } = renderHook(() => useRejectRequest(), { wrapper: Wrapper })

    await act(async () => { result.current.mutate(VARS) })
    await waitFor(() => expect(result.current.isError).toBe(true))

    const data = qc.getQueryData<LeaveRequest[]>(queryKeys.teamRequests(VARS.managerId))
    expect(data?.find((r) => r.id === 'req-001')).toBeDefined()
  })

  it('shows an error toast on network failure', async () => {
    mockReject.mockRejectedValue(new Error('Network error'))

    const { Wrapper } = makeWrapper()
    const { result } = renderHook(() => useRejectRequest(), { wrapper: Wrapper })

    await act(async () => { result.current.mutate(VARS) })
    await waitFor(() => expect(result.current.isError).toBe(true))

    expect(useUIStore.getState().toastQueue[0]?.variant).toBe('error')
  })
})
