'use client'

import { create } from 'zustand'
import type { LeaveType } from '@/types/leave'

interface LeaveRequestDraft {
  type: LeaveType | null
  startDate: string
  endDate: string
  notes: string
}

interface FormState {
  leaveRequestDraft: LeaveRequestDraft
  setDraftField: <K extends keyof LeaveRequestDraft>(key: K, value: LeaveRequestDraft[K]) => void
  resetDraft: () => void
}

const EMPTY_DRAFT: LeaveRequestDraft = {
  type: null,
  startDate: '',
  endDate: '',
  notes: '',
}

export const useFormStore = create<FormState>((set) => ({
  leaveRequestDraft: { ...EMPTY_DRAFT },

  setDraftField: (key, value) =>
    set((s) => ({
      leaveRequestDraft: { ...s.leaveRequestDraft, [key]: value },
    })),

  resetDraft: () => set({ leaveRequestDraft: { ...EMPTY_DRAFT } }),
}))
