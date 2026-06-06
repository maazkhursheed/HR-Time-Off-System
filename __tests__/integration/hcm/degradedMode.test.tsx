import React from 'react'
import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { setupServer } from 'msw/node'
import { http, HttpResponse } from 'msw'
import { useBalance, useTeamBalanceBatch } from '@/lib/query/balance'
import { useRequests } from '@/lib/query/requests'
import { useUIStore } from '@/store/useUIStore'

// ── Degraded-mode handlers ────────────────────────────────────────────────────
// All HCM endpoints return 503. These simulate the HCM system being down.

const degradedHandlers = [
  http.get('/api/hcm/balance', () =>
    HttpResponse.json({ errorCode: 'HCM_UNAVAILABLE', errorMessage: 'HCM is down.' }, { status: 503 })
  ),
  http.get('/api/hcm/requests', () =>
    HttpResponse.json({ errorCode: 'HCM_UNAVAILABLE', errorMessage: 'HCM is down.' }, { status: 503 })
  ),
  http.get('/api/hcm/balances/batch', () =>
    HttpResponse.json({ errorCode: 'HCM_UNAVAILABLE', errorMessage: 'HCM batch is down.' }, { status: 503 })
  ),
]

const server = setupServer(...degradedHandlers)

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
// Protects: balance mismatch — when HCM is degraded, queries must surface isError
// so the UI renders the HCMUnavailableBanner instead of stale or empty balance data.

describe('useBalance — HCM degraded (503)', () => {
  it('isError=true and data=undefined when HCM returns 503', async () => {
    const { Wrapper } = makeWrapper()
    const { result } = renderHook(() => useBalance('user-emp-001'), { wrapper: Wrapper })
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.data).toBeUndefined()
  })

  it('error message contains the status code', async () => {
    const { Wrapper } = makeWrapper()
    const { result } = renderHook(() => useBalance('user-emp-001'), { wrapper: Wrapper })
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect((result.current.error as Error).message).toContain('503')
  })

  it('does NOT show stale data when there was no prior successful fetch', async () => {
    const { Wrapper } = makeWrapper()
    const { result } = renderHook(() => useBalance('user-emp-001'), { wrapper: Wrapper })
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.data).toBeUndefined()
  })
})

describe('useRequests — HCM degraded (503)', () => {
  it('isError=true when HCM returns 503', async () => {
    const { Wrapper } = makeWrapper()
    const { result } = renderHook(() => useRequests('user-emp-001'), { wrapper: Wrapper })
    await waitFor(() => expect(result.current.isError).toBe(true))
  })

  it('does NOT push a contradiction toast when in degraded mode', async () => {
    const { Wrapper } = makeWrapper()
    const { result } = renderHook(() => useRequests('user-emp-001'), { wrapper: Wrapper })
    await waitFor(() => expect(result.current.isError).toBe(true))
    // 503 is an error (no data array) — contradiction detection must not fire
    expect(useUIStore.getState().toastQueue).toHaveLength(0)
  })
})

describe('useTeamBalanceBatch — HCM degraded (503)', () => {
  it('isError=true when batch endpoint returns 503', async () => {
    const { Wrapper } = makeWrapper()
    const { result } = renderHook(
      () => useTeamBalanceBatch(['user-emp-001', 'user-emp-002'], 'user-mgr-001'),
      { wrapper: Wrapper }
    )
    await waitFor(() => expect(result.current.isError).toBe(true))
  })

  it('is not enabled when employeeIds is empty', async () => {
    const { Wrapper } = makeWrapper()
    const { result } = renderHook(
      () => useTeamBalanceBatch([], 'user-mgr-001'),
      { wrapper: Wrapper }
    )
    // fetchStatus=idle when enabled=false; no error should surface
    expect(result.current.fetchStatus).toBe('idle')
    expect(result.current.isError).toBe(false)
  })
})
