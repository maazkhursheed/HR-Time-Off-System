import { describe, it, expect, afterEach } from 'vitest'
import { useFormStore } from '@/store/useFormStore'

afterEach(() => useFormStore.getState().resetDraft())

// ── Initial state ─────────────────────────────────────────────────────────────
// Protects: opening the form always starts clean; no draft leaks between sessions

describe('initial state', () => {
  it('type is null', () => {
    expect(useFormStore.getState().leaveRequestDraft.type).toBeNull()
  })

  it('startDate and endDate are empty strings', () => {
    const { startDate, endDate } = useFormStore.getState().leaveRequestDraft
    expect(startDate).toBe('')
    expect(endDate).toBe('')
  })

  it('notes is an empty string', () => {
    expect(useFormStore.getState().leaveRequestDraft.notes).toBe('')
  })
})

// ── setDraftField ─────────────────────────────────────────────────────────────
// Protects: partial field updates do not reset sibling fields (no accidental wipes)

describe('setDraftField', () => {
  it('updates the type field', () => {
    useFormStore.getState().setDraftField('type', 'annual')
    expect(useFormStore.getState().leaveRequestDraft.type).toBe('annual')
  })

  it('updating type leaves other fields intact', () => {
    useFormStore.getState().setDraftField('startDate', '2026-07-01')
    useFormStore.getState().setDraftField('type', 'sick')
    expect(useFormStore.getState().leaveRequestDraft.startDate).toBe('2026-07-01')
  })

  it('updates startDate independently', () => {
    useFormStore.getState().setDraftField('startDate', '2026-07-10')
    expect(useFormStore.getState().leaveRequestDraft.startDate).toBe('2026-07-10')
    expect(useFormStore.getState().leaveRequestDraft.endDate).toBe('')
  })

  it('updates endDate independently', () => {
    useFormStore.getState().setDraftField('endDate', '2026-07-15')
    expect(useFormStore.getState().leaveRequestDraft.endDate).toBe('2026-07-15')
  })

  it('updates notes', () => {
    useFormStore.getState().setDraftField('notes', 'Holiday trip')
    expect(useFormStore.getState().leaveRequestDraft.notes).toBe('Holiday trip')
  })
})

// ── resetDraft ────────────────────────────────────────────────────────────────
// Protects: successful submission clears the form; re-opening shows a blank slate

describe('resetDraft', () => {
  it('resets all fields to their initial empty values', () => {
    useFormStore.getState().setDraftField('type', 'annual')
    useFormStore.getState().setDraftField('startDate', '2026-07-01')
    useFormStore.getState().setDraftField('endDate', '2026-07-05')
    useFormStore.getState().setDraftField('notes', 'Trip')

    useFormStore.getState().resetDraft()

    const draft = useFormStore.getState().leaveRequestDraft
    expect(draft.type).toBeNull()
    expect(draft.startDate).toBe('')
    expect(draft.endDate).toBe('')
    expect(draft.notes).toBe('')
  })
})
