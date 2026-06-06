import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useApproveRequest } from '@/lib/mutations/useApproveRequest'
import { useUIStore } from '@/store/useUIStore'
import { queryKeys } from '@/lib/query/keys'
import type { LeaveRequest } from '@/types/leave'

// Mock the server action — it runs on the server; tests target mutation-layer logic.
vi.mock('@/lib/actions/approveRequest', () => ({
  approveRequest: vi.fn(),
}))

import { approveRequest } from '@/lib/actions/approveRequest'
const mockApprove = vi.mocked(approveRequest)

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

const ANOTHER_REQUEST: LeaveRequest = { ...PENDING_REQUEST, id: 'req-002' }

const VARS = {
  requestId: 'req-001',
  managerId: 'user-mgr-001',
  employeeId: 'user-emp-001',
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeWrapper() {
  const qc = new QueryClient({
    // gcTime: Infinity keeps setQueryData entries alive for the duration of the test
    // so that rollback assertions run before garbage collection.
    defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false } },
  })
  qc.setQueryData<LeaveRequest[]>(queryKeys.teamRequests(VARS.managerId), [PENDING_REQUEST, ANOTHER_REQUEST])
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
// Protects: incorrect approval state — the optimistic update must immediately
// remove the request from the queue, but must be rolled back if the action fails
// so the manager can retry. A missing rollback means a ghost state in the UI.

describe('useApproveRequest — optimistic update', () => {
  it('removes the target request from teamRequests immediately (before action resolves)', async () => {
    let resolveAction!: (v: { success: boolean }) => void
    mockApprove.mockImplementation(
      () => new Promise((res) => { resolveAction = res })
    )

    const { qc, Wrapper } = makeWrapper()
    const { result } = renderHook(() => useApproveRequest(), { wrapper: Wrapper })

    act(() => { result.current.mutate(VARS) })

    // Optimistic update should fire before action resolves
    await waitFor(() => {
      const data = qc.getQueryData<LeaveRequest[]>(queryKeys.teamRequests(VARS.managerId))
      return data?.every((r) => r.id !== 'req-001') ?? false
    })

    // Other requests remain
    const data = qc.getQueryData<LeaveRequest[]>(queryKeys.teamRequests(VARS.managerId))
    expect(data?.find((r) => r.id === 'req-002')).toBeDefined()

    resolveAction({ success: true })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
  })
})

describe('useApproveRequest — success path', () => {
  beforeEach(() => { mockApprove.mockResolvedValue({ success: true }) })

  it('shows a success toast', async () => {
    const { Wrapper } = makeWrapper()
    const { result } = renderHook(() => useApproveRequest(), { wrapper: Wrapper })

    await act(async () => { result.current.mutate(VARS) })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    const toast = useUIStore.getState().toastQueue[0]
    expect(toast?.variant).toBe('success')
    expect(toast?.message).toContain('approved')
  })

  it('invalidates teamBalance for the manager', async () => {
    const { qc, Wrapper } = makeWrapper()
    const spy = vi.spyOn(qc, 'invalidateQueries')

    const { result } = renderHook(() => useApproveRequest(), { wrapper: Wrapper })
    await act(async () => { result.current.mutate(VARS) })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    const keys = spy.mock.calls.map(([opts]) => (opts as { queryKey?: unknown[] }).queryKey?.[0])
    expect(keys).toContain('team-balance')
  })

  it('invalidates employee balance (balance restored after approval credited)', async () => {
    const { qc, Wrapper } = makeWrapper()
    const spy = vi.spyOn(qc, 'invalidateQueries')

    const { result } = renderHook(() => useApproveRequest(), { wrapper: Wrapper })
    await act(async () => { result.current.mutate(VARS) })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    const keys = spy.mock.calls.map(([opts]) => (opts as { queryKey?: unknown[] }).queryKey)
    const balanceInvalidated = keys.some((k) => k?.[0] === 'balance' && k?.[1] === VARS.employeeId)
    expect(balanceInvalidated).toBe(true)
  })

  it('always invalidates teamRequests in onSettled (ensures list is fresh)', async () => {
    const { qc, Wrapper } = makeWrapper()
    const spy = vi.spyOn(qc, 'invalidateQueries')

    const { result } = renderHook(() => useApproveRequest(), { wrapper: Wrapper })
    await act(async () => { result.current.mutate(VARS) })
    await waitFor(() => !result.current.isPending)

    const keys = spy.mock.calls.map(([opts]) => (opts as { queryKey?: unknown[] }).queryKey)
    const teamRequestsInvalidated = keys.some(
      (k) => k?.[0] === 'team-requests' && k?.[1] === VARS.managerId
    )
    expect(teamRequestsInvalidated).toBe(true)
  })
})

describe('useApproveRequest — application-level failure (result.success=false)', () => {
  it('restores previous teamRequests (rollback)', async () => {
    mockApprove.mockResolvedValue({ success: false, error: { code: 'NOT_FOUND', message: 'Not found.' } })

    const { qc, Wrapper } = makeWrapper()
    const { result } = renderHook(() => useApproveRequest(), { wrapper: Wrapper })

    await act(async () => { result.current.mutate(VARS) })
    await waitFor(() => !result.current.isPending)

    const data = qc.getQueryData<LeaveRequest[]>(queryKeys.teamRequests(VARS.managerId))
    expect(data?.find((r) => r.id === 'req-001')).toBeDefined()
  })

  it('shows an error toast on application failure', async () => {
    mockApprove.mockResolvedValue({
      success: false,
      error: { code: 'UNKNOWN', message: 'Approval failed.' },
    })

    const { Wrapper } = makeWrapper()
    const { result } = renderHook(() => useApproveRequest(), { wrapper: Wrapper })

    await act(async () => { result.current.mutate(VARS) })
    await waitFor(() => !result.current.isPending)

    const toast = useUIStore.getState().toastQueue[0]
    expect(toast?.variant).toBe('error')
  })
})

describe('useApproveRequest — network failure (thrown error)', () => {
  it('restores previous teamRequests on network error (rollback)', async () => {
    mockApprove.mockRejectedValue(new Error('Network timeout'))

    const { qc, Wrapper } = makeWrapper()
    const { result } = renderHook(() => useApproveRequest(), { wrapper: Wrapper })

    await act(async () => { result.current.mutate(VARS) })
    await waitFor(() => expect(result.current.isError).toBe(true))

    const data = qc.getQueryData<LeaveRequest[]>(queryKeys.teamRequests(VARS.managerId))
    expect(data?.find((r) => r.id === 'req-001')).toBeDefined()
  })

  it('shows an error toast on network failure', async () => {
    mockApprove.mockRejectedValue(new Error('Network timeout'))

    const { Wrapper } = makeWrapper()
    const { result } = renderHook(() => useApproveRequest(), { wrapper: Wrapper })

    await act(async () => { result.current.mutate(VARS) })
    await waitFor(() => expect(result.current.isError).toBe(true))

    expect(useUIStore.getState().toastQueue[0]?.variant).toBe('error')
  })

  it('always invalidates teamRequests in onSettled even after network error', async () => {
    mockApprove.mockRejectedValue(new Error('Network error'))

    const { qc, Wrapper } = makeWrapper()
    const spy = vi.spyOn(qc, 'invalidateQueries')

    const { result } = renderHook(() => useApproveRequest(), { wrapper: Wrapper })
    await act(async () => { result.current.mutate(VARS) })
    await waitFor(() => expect(result.current.isError).toBe(true))

    const keys = spy.mock.calls.map(([opts]) => (opts as { queryKey?: unknown[] }).queryKey)
    expect(keys.some((k) => k?.[0] === 'team-requests')).toBe(true)
  })
})
