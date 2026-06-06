import React from 'react'
import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { setupServer } from 'msw/node'
import { http, HttpResponse } from 'msw'
import { useRequests } from '@/lib/query/requests'
import { useUIStore } from '@/store/useUIStore'
import type { LeaveRequest } from '@/types/leave'

// ── Scenario ──────────────────────────────────────────────────────────────────
// "Silent HCM failure": HCM accepts the submission (POST returns 201 with status
// PENDING) but later changes the request to REJECTED_BY_HCM without notifying
// the employee through normal channels. The useRequests hook must detect this
// transition and surface an error toast + invalidate the balance cache.
//
// This is the primary regression for the balance-mismatch bug class: if the app
// does not detect the silent rejection, the employee's balance will show days
// deducted even though the request was never approved.

const BASE: LeaveRequest = {
  id: 'req-silent-001',
  userId: 'user-emp-001',
  type: 'sick',
  startDate: '2026-06-15',
  endDate: '2026-06-17',
  businessDays: 3,
  status: 'pending',
  idempotencyKey: 'idem-s01',
  createdAt: '2026-06-10T08:00:00Z',
  updatedAt: '2026-06-10T08:00:00Z',
}

function wire(r: LeaveRequest) {
  return {
    requestId: r.id,
    employeeId: r.userId,
    leaveTypeCode: r.type.toUpperCase(),
    startDate: r.startDate,
    endDate: r.endDate,
    days: r.businessDays,
    status: r.status.toUpperCase(),
    submittedAt: r.createdAt,
    updatedAt: r.updatedAt,
  }
}

const server = setupServer(
  http.get('/api/hcm/requests', () =>
    HttpResponse.json({ requests: [wire(BASE)], total: 1 })
  )
)

beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }))
afterEach(() => {
  server.resetHandlers()
  useUIStore.setState({ requestModal: { open: false }, activeFilters: { status: [], type: [] }, toastQueue: [] })
})
afterAll(() => server.close())

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

describe('silent HCM failure — pending → rejected_by_hcm end-to-end', () => {
  it('surfaces an error toast after HCM silently rejects a pending request', async () => {
    const { Wrapper } = makeWrapper()
    const { result } = renderHook(() => useRequests('user-emp-001'), { wrapper: Wrapper })

    // Step 1: initial fetch shows pending
    await waitFor(() => expect(result.current.data?.[0]?.status).toBe('pending'))
    expect(useUIStore.getState().toastQueue).toHaveLength(0)

    // Step 2: HCM silently flips the status
    server.use(
      http.get('/api/hcm/requests', () =>
        HttpResponse.json({ requests: [wire({ ...BASE, status: 'rejected_by_hcm' })], total: 1 })
      )
    )

    // Step 3: hook polls / refetches and detects the transition
    await act(async () => { await result.current.refetch() })
    await waitFor(() => expect(result.current.data?.[0]?.status).toBe('rejected_by_hcm'))

    const toasts = useUIStore.getState().toastQueue
    expect(toasts).toHaveLength(1)
    expect(toasts[0].variant).toBe('error')
    expect(toasts[0].message).toContain('rejected by HCM')
  })

  it('triggers balance re-fetch so reserved days are returned', async () => {
    const { Wrapper, qc } = makeWrapper()
    const spy = vi.spyOn(qc, 'invalidateQueries')

    const { result } = renderHook(() => useRequests('user-emp-001'), { wrapper: Wrapper })
    await waitFor(() => expect(result.current.data?.[0]?.status).toBe('pending'))

    server.use(
      http.get('/api/hcm/requests', () =>
        HttpResponse.json({ requests: [wire({ ...BASE, status: 'rejected_by_hcm' })], total: 1 })
      )
    )

    await act(async () => { await result.current.refetch() })
    await waitFor(() => expect(result.current.data?.[0]?.status).toBe('rejected_by_hcm'))

    // At least one invalidateQueries call must target the balance key
    const keys = spy.mock.calls.map(([o]) => (o as { queryKey?: unknown[] }).queryKey)
    expect(keys.some((k) => k?.[0] === 'balance')).toBe(true)
  })

  it('fires the toast only once per transition, not on subsequent polls', async () => {
    const { Wrapper } = makeWrapper()
    const { result } = renderHook(() => useRequests('user-emp-001'), { wrapper: Wrapper })
    await waitFor(() => expect(result.current.data?.[0]?.status).toBe('pending'))

    // Flip to rejected_by_hcm
    server.use(
      http.get('/api/hcm/requests', () =>
        HttpResponse.json({ requests: [wire({ ...BASE, status: 'rejected_by_hcm' })], total: 1 })
      )
    )
    await act(async () => { await result.current.refetch() })
    await waitFor(() => expect(result.current.data?.[0]?.status).toBe('rejected_by_hcm'))
    expect(useUIStore.getState().toastQueue).toHaveLength(1)

    // Poll again — same status, no new toast
    await act(async () => { await result.current.refetch() })
    await waitFor(() => expect(result.current.data?.[0]?.status).toBe('rejected_by_hcm'))
    expect(useUIStore.getState().toastQueue).toHaveLength(1) // still 1
  })

  it('does NOT toast when the first fetch already shows rejected_by_hcm (no prior state)', async () => {
    server.use(
      http.get('/api/hcm/requests', () =>
        HttpResponse.json({ requests: [wire({ ...BASE, status: 'rejected_by_hcm' })], total: 1 })
      )
    )
    const { Wrapper } = makeWrapper()
    const { result } = renderHook(() => useRequests('user-emp-001'), { wrapper: Wrapper })

    await waitFor(() => expect(result.current.data?.[0]?.status).toBe('rejected_by_hcm'))
    expect(useUIStore.getState().toastQueue).toHaveLength(0)
  })
})
