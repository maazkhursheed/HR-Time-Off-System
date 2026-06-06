import React from 'react'
import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { setupServer } from 'msw/node'
import { http, HttpResponse } from 'msw'
import { useBalance } from '@/lib/query/balance'

// ── Helpers ───────────────────────────────────────────────────────────────────

function hcmResponse(overrides: Partial<{
  employeeId: string
  employeeName: string
  location: string
  annual: number
  sick: number
  unpaid: number
  compassionate: number
  asOf: string
  anniversaryBonusApplied: boolean
  inconsistencyApplied: boolean
}> = {}) {
  const o = {
    employeeId: 'user-emp-001',
    employeeName: 'Alice Chen',
    location: 'New York, US',
    annual: 10,
    sick: 5,
    unpaid: 0,
    compassionate: 3,
    asOf: new Date(Date.now() - 30_000).toISOString(), // 30s ago — fresh
    anniversaryBonusApplied: false,
    inconsistencyApplied: false,
    ...overrides,
  }
  return {
    employeeId: o.employeeId,
    employeeName: o.employeeName,
    location: o.location,
    leaveTypes: [
      { code: 'ANNUAL',         available: o.annual },
      { code: 'SICK',           available: o.sick },
      { code: 'UNPAID',         available: o.unpaid },
      { code: 'COMPASSIONATE',  available: o.compassionate },
    ],
    asOf: o.asOf,
    _meta: {
      anniversaryBonusApplied: o.anniversaryBonusApplied,
      inconsistencyApplied:    o.inconsistencyApplied,
    },
  }
}

function makeWrapper() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
  })
  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  )
  return { qc, Wrapper }
}

// ── MSW ───────────────────────────────────────────────────────────────────────

const server = setupServer(
  http.get('/api/hcm/balance', () => HttpResponse.json(hcmResponse()))
)

beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

// ── Tests ─────────────────────────────────────────────────────────────────────
// Protects: balance mismatch — correct HCM field mapping (ANNUAL→annual, etc.)
//           isStale flag drives the stale-cache banner in BalancePanelClient.

describe('useBalance — HCM field mapping', () => {
  it('maps ANNUAL/SICK/UNPAID/COMPASSIONATE to lowercase keys', async () => {
    const { Wrapper } = makeWrapper()
    const { result } = renderHook(() => useBalance('user-emp-001'), { wrapper: Wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    const data = result.current.data!
    expect(data.annual).toBe(10)
    expect(data.sick).toBe(5)
    expect(data.unpaid).toBe(0)
    expect(data.compassionate).toBe(3)
  })

  it('maps employeeId, employeeName, and location', async () => {
    server.use(
      http.get('/api/hcm/balance', () =>
        HttpResponse.json(hcmResponse({ employeeId: 'u-1', employeeName: 'Bob', location: 'London' }))
      )
    )
    const { Wrapper } = makeWrapper()
    const { result } = renderHook(() => useBalance('u-1'), { wrapper: Wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data!.employeeId).toBe('u-1')
    expect(result.current.data!.employeeName).toBe('Bob')
    expect(result.current.data!.location).toBe('London')
  })

  it('maps asOf → lastSynced', async () => {
    const ts = '2026-06-10T10:00:00.000Z'
    server.use(http.get('/api/hcm/balance', () => HttpResponse.json(hcmResponse({ asOf: ts }))))
    const { Wrapper } = makeWrapper()
    const { result } = renderHook(() => useBalance('user-emp-001'), { wrapper: Wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data!.lastSynced).toBe(ts)
  })

  it('maps _meta.anniversaryBonusApplied', async () => {
    server.use(
      http.get('/api/hcm/balance', () =>
        HttpResponse.json(hcmResponse({ anniversaryBonusApplied: true }))
      )
    )
    const { Wrapper } = makeWrapper()
    const { result } = renderHook(() => useBalance('user-emp-001'), { wrapper: Wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data!.anniversaryBonusApplied).toBe(true)
  })

  it('maps _meta.inconsistencyApplied → inconsistencyDetected', async () => {
    server.use(
      http.get('/api/hcm/balance', () =>
        HttpResponse.json(hcmResponse({ inconsistencyApplied: true }))
      )
    )
    const { Wrapper } = makeWrapper()
    const { result } = renderHook(() => useBalance('user-emp-001'), { wrapper: Wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data!.inconsistencyDetected).toBe(true)
  })

  it('defaults to false when _meta is absent', async () => {
    server.use(
      http.get('/api/hcm/balance', () => {
        const r = hcmResponse()
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        delete (r as any)._meta
        return HttpResponse.json(r)
      })
    )
    const { Wrapper } = makeWrapper()
    const { result } = renderHook(() => useBalance('user-emp-001'), { wrapper: Wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data!.anniversaryBonusApplied).toBe(false)
    expect(result.current.data!.inconsistencyDetected).toBe(false)
  })
})

describe('useBalance — isStale flag (stale-cache regression)', () => {
  it('isStale=false when lastSynced is recent (< 15 min)', async () => {
    const freshTs = new Date(Date.now() - 30_000).toISOString() // 30 sec ago
    server.use(http.get('/api/hcm/balance', () => HttpResponse.json(hcmResponse({ asOf: freshTs }))))
    const { Wrapper } = makeWrapper()
    const { result } = renderHook(() => useBalance('user-emp-001'), { wrapper: Wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data!.isStale).toBe(false)
  })

  it('isStale=true when lastSynced is > 15 min ago', async () => {
    const staleTs = new Date(Date.now() - 20 * 60 * 1000).toISOString() // 20 min ago
    server.use(http.get('/api/hcm/balance', () => HttpResponse.json(hcmResponse({ asOf: staleTs }))))
    const { Wrapper } = makeWrapper()
    const { result } = renderHook(() => useBalance('user-emp-001'), { wrapper: Wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data!.isStale).toBe(true)
  })
})

describe('useBalance — error handling', () => {
  it('isError=true when API returns 503', async () => {
    server.use(
      http.get('/api/hcm/balance', () =>
        HttpResponse.json({ errorMessage: 'HCM unavailable' }, { status: 503 })
      )
    )
    const { Wrapper } = makeWrapper()
    const { result } = renderHook(() => useBalance('user-emp-001'), { wrapper: Wrapper })
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.data).toBeUndefined()
  })
})
