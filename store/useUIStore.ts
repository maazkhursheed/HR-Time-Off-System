'use client'

import { create } from 'zustand'
import type { DateRange, LeaveStatus, LeaveType } from '@/types/leave'

export interface Toast {
  id: string
  variant: 'success' | 'info' | 'warning' | 'error'
  message: string
  autoDismissMs?: number
}

interface ActiveFilters {
  status: LeaveStatus[]
  type: LeaveType[]
  dateRange?: DateRange
}

interface RequestModal {
  open: boolean
  prefillDates?: DateRange
}

interface UIState {
  requestModal: RequestModal
  activeFilters: ActiveFilters
  toastQueue: Toast[]

  openRequestModal: (prefillDates?: DateRange) => void
  closeRequestModal: () => void
  setFilters: (filters: Partial<ActiveFilters>) => void
  clearFilters: () => void
  pushToast: (toast: Omit<Toast, 'id'>) => void
  dismissToast: (id: string) => void
}

const MAX_TOASTS = 3

const DEFAULT_DISMISS_MS: Record<Toast['variant'], number | undefined> = {
  success: 4000,
  info: 6000,
  warning: 8000,
  error: undefined, // persistent — manual dismiss only
}

export const useUIStore = create<UIState>((set) => ({
  requestModal: { open: false },
  activeFilters: { status: [], type: [] },
  toastQueue: [],

  openRequestModal: (prefillDates) =>
    set({ requestModal: { open: true, prefillDates } }),

  closeRequestModal: () =>
    set({ requestModal: { open: false } }),

  setFilters: (filters) =>
    set((s) => ({ activeFilters: { ...s.activeFilters, ...filters } })),

  clearFilters: () =>
    set({ activeFilters: { status: [], type: [] } }),

  pushToast: (toast) =>
    set((s) => {
      const id = crypto.randomUUID()
      const autoDismissMs = toast.autoDismissMs ?? DEFAULT_DISMISS_MS[toast.variant]
      const next: Toast = { id, ...toast, autoDismissMs }
      const queue = [...s.toastQueue, next].slice(-MAX_TOASTS)
      return { toastQueue: queue }
    }),

  dismissToast: (id) =>
    set((s) => ({ toastQueue: s.toastQueue.filter((t) => t.id !== id) })),
}))
