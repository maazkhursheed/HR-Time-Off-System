import React from 'react'
import { describe, it, expect, beforeAll, beforeEach, afterEach, afterAll } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { setupServer } from 'msw/node'
import { http, HttpResponse } from 'msw'
import { useRequests } from '@/lib/query/requests'
import { useUIStore } from '@/store/useUIStore'
import type { LeaveRequest } from '@/types/leave'

// ── Fixtures ──────────────────────────────────────────────────────────────────

const BASE_REQUEST: LeaveRequest = {
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

function hcmRequestsResponse(requests: Pick<LeaveRequest, 'id' | 'userId' | 'type' | 'startDate' | 'endDate' | 'businessDays' | 'status' | 'createdAt' | 'updatedAt'>[]) {
  return {
    requests: requests.map((r) => ({
      requestId: r.id,
      employeeId: r.userId,
      leaveTypeCode: r.type.toUpperCase(),
      startDate: r.startDate,
      endDate: r.endDate,
      days: r.businessDays,
      // HCM sends uppercase status; hook maps to lowercase
      status: r.status.toUpperCase(),
      submittedAt: r.createdAt,
      updatedAt: r.updatedAt,
    })),
    total: requests.length,
  }
}

// ── MSW ───────────────────────────────────────────────────────────────────────

const server = setupServer(
  http.get('/api/hcm/requests', () =>
    HttpResponse.json(hcmRequestsResponse([BASE_REQUEST]))
  )
)

beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }))
afterEach(() => {
  server.resetHandlers()
  useUIStore.setState({ requestModal: { open: false }, activeFilters: { status: [], type: [] }, toastQueue: [] })
})
afterAll(() => server.close())

// ── Wrapper ───────────────────────────────────────────────────────────────────

function makeWrapper() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
  })
  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  )
  return { qc, Wrapper }
}

// ── Tests ─────────────────────────────────────────────────────────────────────
// Protects: contradiction detection — HCM silently transitions requests from
// pending to rejected_by_hcm. Without this, balances stay "locked" (balance
// was reserved on submit but never restored because user sees no rejection).

describe('useRequests — HCM field mapping', () => {
  it('maps HCM request to LeaveRequest shape', async () => {
    const { Wrapper } = makeWrapper()
    const { result } = renderHook(() => useRequests('user-emp-001'), { wrapper: Wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    const req = result.current.data![0]
    expect(req.id).toBe('req-001')
    expect(req.userId).toBe('user-emp-001')
    expect(req.type).toBe('annual')       // lowercased
    expect(req.status).toBe('pending')    // lowercased
    expect(req.businessDays).toBe(3)
  })
})

describe('useRequests — status-transition detection (pending → terminal)', () => {
  it('pushes an error toast when a request transitions to rejected_by_hcm', async () => {
    const { Wrapper, qc } = makeWrapper()
    const { result } = renderHook(() => useRequests('user-emp-001'), { wrapper: Wrapper })

    // Wait for initial data (pending)
    await waitFor(() => expect(result.current.data?.[0]?.status).toBe('pending'))

    // Simulate HCM silently changing status to rejected_by_hcm
    server.use(
      http.get('/api/hcm/requests', () =>
        HttpResponse.json(hcmRequestsResponse([{ ...BASE_REQUEST, status: 'rejected_by_hcm' }]))
      )
    )

    // Force a refetch so the hook sees the new status
    await act(async () => {
      await result.current.refetch()
    })

    await waitFor(() => expect(result.current.data?.[0]?.status).toBe('rejected_by_hcm'))

    const toasts = useUIStore.getState().toastQueue
    expect(toasts).toHaveLength(1)
    expect(toasts[0].variant).toBe('error')
    expect(toasts[0].message).toContain('rejected by HCM')
  })

  it('toast message includes the leave type and date range', async () => {
    const { Wrapper } = makeWrapper()
    const { result } = renderHook(() => useRequests('user-emp-001'), { wrapper: Wrapper })
    await waitFor(() => expect(result.current.data?.[0]?.status).toBe('pending'))

    server.use(
      http.get('/api/hcm/requests', () =>
        HttpResponse.json(hcmRequestsResponse([{ ...BASE_REQUEST, status: 'rejected_by_hcm' }]))
      )
    )
    await act(async () => { await result.current.refetch() })
    await waitFor(() => expect(result.current.data?.[0]?.status).toBe('rejected_by_hcm'))

    const msg = useUIStore.getState().toastQueue[0].message
    expect(msg).toContain('annual')
    expect(msg).toContain('2026-07-01')
    expect(msg).toContain('2026-07-03')
  })

  it('invalidates the balance query when contradiction is detected', async () => {
    const { Wrapper, qc } = makeWrapper()
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries')

    const { result } = renderHook(() => useRequests('user-emp-001'), { wrapper: Wrapper })
    await waitFor(() => expect(result.current.data?.[0]?.status).toBe('pending'))

    server.use(
      http.get('/api/hcm/requests', () =>
        HttpResponse.json(hcmRequestsResponse([{ ...BASE_REQUEST, status: 'rejected_by_hcm' }]))
      )
    )
    await act(async () => { await result.current.refetch() })
    await waitFor(() => expect(result.current.data?.[0]?.status).toBe('rejected_by_hcm'))

    const calls = invalidateSpy.mock.calls
    const invalidatedBalance = calls.some(
      ([opts]) =>
        Array.isArray((opts as { queryKey?: unknown[] }).queryKey) &&
        (opts as { queryKey: unknown[] }).queryKey[0] === 'balance'
    )
    expect(invalidatedBalance).toBe(true)
  })

  it('pushes a success toast when a request transitions to approved', async () => {
    const { Wrapper } = makeWrapper()
    const { result } = renderHook(() => useRequests('user-emp-001'), { wrapper: Wrapper })
    await waitFor(() => expect(result.current.data?.[0]?.status).toBe('pending'))

    server.use(
      http.get('/api/hcm/requests', () =>
        HttpResponse.json(hcmRequestsResponse([{ ...BASE_REQUEST, status: 'approved' }]))
      )
    )
    await act(async () => { await result.current.refetch() })
    await waitFor(() => expect(result.current.data?.[0]?.status).toBe('approved'))

    const toasts = useUIStore.getState().toastQueue
    expect(toasts).toHaveLength(1)
    expect(toasts[0].variant).toBe('success')
    expect(toasts[0].message).toContain('approved')
  })

  it('pushes an error toast when a request is rejected by the manager', async () => {
    const { Wrapper } = makeWrapper()
    const { result } = renderHook(() => useRequests('user-emp-001'), { wrapper: Wrapper })
    await waitFor(() => expect(result.current.data?.[0]?.status).toBe('pending'))

    server.use(
      http.get('/api/hcm/requests', () =>
        HttpResponse.json(hcmRequestsResponse([{ ...BASE_REQUEST, status: 'rejected' }]))
      )
    )
    await act(async () => { await result.current.refetch() })
    await waitFor(() => expect(result.current.data?.[0]?.status).toBe('rejected'))

    const toasts = useUIStore.getState().toastQueue
    expect(toasts).toHaveLength(1)
    expect(toasts[0].variant).toBe('error')
    expect(toasts[0].message).not.toContain('HCM')
  })

  it('does NOT toast on the very first render (no previous state to compare)', async () => {
    // First response already shows rejected_by_hcm — hook has no prior state
    server.use(
      http.get('/api/hcm/requests', () =>
        HttpResponse.json(hcmRequestsResponse([{ ...BASE_REQUEST, status: 'rejected_by_hcm' }]))
      )
    )
    const { Wrapper } = makeWrapper()
    const { result } = renderHook(() => useRequests('user-emp-001'), { wrapper: Wrapper })
    await waitFor(() => expect(result.current.data?.[0]?.status).toBe('rejected_by_hcm'))

    expect(useUIStore.getState().toastQueue).toHaveLength(0)
  })
})
