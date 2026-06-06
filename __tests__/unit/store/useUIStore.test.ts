import { describe, it, expect, beforeEach } from 'vitest'
import { useUIStore } from '@/store/useUIStore'

const INITIAL: Parameters<typeof useUIStore.setState>[0] = {
  requestModal: { open: false },
  activeFilters: { status: [], type: [] },
  toastQueue: [],
}

beforeEach(() => useUIStore.setState(INITIAL))

// ── Request modal ─────────────────────────────────────────────────────────────
// Protects: open/close modal state; prefillDates must survive the open call

describe('requestModal', () => {
  it('openRequestModal sets open=true', () => {
    useUIStore.getState().openRequestModal()
    expect(useUIStore.getState().requestModal.open).toBe(true)
  })

  it('openRequestModal stores prefillDates', () => {
    const dates = { startDate: '2026-07-01', endDate: '2026-07-05' }
    useUIStore.getState().openRequestModal(dates)
    expect(useUIStore.getState().requestModal.prefillDates).toEqual(dates)
  })

  it('closeRequestModal sets open=false', () => {
    useUIStore.getState().openRequestModal()
    useUIStore.getState().closeRequestModal()
    expect(useUIStore.getState().requestModal.open).toBe(false)
  })
})

// ── Filters ───────────────────────────────────────────────────────────────────
// Protects: filter state is merged, not replaced; clearFilters resets to empty arrays

describe('filters', () => {
  it('setFilters merges partial update into existing filters', () => {
    useUIStore.getState().setFilters({ status: ['pending'] })
    expect(useUIStore.getState().activeFilters.status).toEqual(['pending'])
    expect(useUIStore.getState().activeFilters.type).toEqual([])
  })

  it('setFilters preserves already-set keys when updating a different key', () => {
    useUIStore.getState().setFilters({ status: ['approved'] })
    useUIStore.getState().setFilters({ type: ['annual'] })
    expect(useUIStore.getState().activeFilters.status).toEqual(['approved'])
    expect(useUIStore.getState().activeFilters.type).toEqual(['annual'])
  })

  it('setFilters stores dateRange', () => {
    const range = { startDate: '2026-07-01', endDate: '2026-07-31' }
    useUIStore.getState().setFilters({ dateRange: range })
    expect(useUIStore.getState().activeFilters.dateRange).toEqual(range)
  })

  it('clearFilters resets to empty arrays and removes dateRange', () => {
    useUIStore.getState().setFilters({ status: ['pending'], type: ['annual'] })
    useUIStore.getState().clearFilters()
    const f = useUIStore.getState().activeFilters
    expect(f.status).toEqual([])
    expect(f.type).toEqual([])
    expect(f.dateRange).toBeUndefined()
  })
})

// ── Toast queue ───────────────────────────────────────────────────────────────
// Protects:
//   - Error toasts are persistent (autoDismissMs=undefined); user must dismiss.
//   - Success/info/warning have defined auto-dismiss windows.
//   - Queue capped at 3 — oldest dropped to prevent unbounded growth.

describe('pushToast', () => {
  it('adds a toast with a generated id', () => {
    useUIStore.getState().pushToast({ variant: 'success', message: 'Done' })
    const queue = useUIStore.getState().toastQueue
    expect(queue).toHaveLength(1)
    expect(queue[0].id).toBeTruthy()
    expect(queue[0].message).toBe('Done')
  })

  it('success: autoDismissMs = 4000', () => {
    useUIStore.getState().pushToast({ variant: 'success', message: 'OK' })
    expect(useUIStore.getState().toastQueue[0].autoDismissMs).toBe(4000)
  })

  it('info: autoDismissMs = 6000', () => {
    useUIStore.getState().pushToast({ variant: 'info', message: 'FYI' })
    expect(useUIStore.getState().toastQueue[0].autoDismissMs).toBe(6000)
  })

  it('warning: autoDismissMs = 8000', () => {
    useUIStore.getState().pushToast({ variant: 'warning', message: 'Watch out' })
    expect(useUIStore.getState().toastQueue[0].autoDismissMs).toBe(8000)
  })

  it('error: autoDismissMs = undefined (persistent — requires manual dismiss)', () => {
    useUIStore.getState().pushToast({ variant: 'error', message: 'Oops' })
    expect(useUIStore.getState().toastQueue[0].autoDismissMs).toBeUndefined()
  })

  it('caller-provided autoDismissMs overrides the default', () => {
    useUIStore.getState().pushToast({ variant: 'success', message: 'Done', autoDismissMs: 1000 })
    expect(useUIStore.getState().toastQueue[0].autoDismissMs).toBe(1000)
  })

  it('caps queue at 3 (oldest is dropped when a 4th is pushed)', () => {
    const push = useUIStore.getState().pushToast
    push({ variant: 'info', message: 'first' })
    push({ variant: 'info', message: 'second' })
    push({ variant: 'info', message: 'third' })
    push({ variant: 'success', message: 'fourth' })
    const queue = useUIStore.getState().toastQueue
    expect(queue).toHaveLength(3)
    expect(queue.map((t) => t.message)).toEqual(['second', 'third', 'fourth'])
  })
})

// ── dismissToast ──────────────────────────────────────────────────────────────
// Protects: manual dismiss removes only the targeted toast

describe('dismissToast', () => {
  it('removes the toast with the given id', () => {
    useUIStore.getState().pushToast({ variant: 'error', message: 'A' })
    useUIStore.getState().pushToast({ variant: 'error', message: 'B' })
    const [toastA] = useUIStore.getState().toastQueue
    useUIStore.getState().dismissToast(toastA.id)
    const remaining = useUIStore.getState().toastQueue
    expect(remaining).toHaveLength(1)
    expect(remaining[0].message).toBe('B')
  })

  it('no-ops when id is not in the queue', () => {
    useUIStore.getState().pushToast({ variant: 'success', message: 'Keep me' })
    useUIStore.getState().dismissToast('nonexistent-id')
    expect(useUIStore.getState().toastQueue).toHaveLength(1)
  })
})
