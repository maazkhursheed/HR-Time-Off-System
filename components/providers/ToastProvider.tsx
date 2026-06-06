'use client'

import { useEffect } from 'react'
import { useUIStore } from '@/store/useUIStore'
import type { Toast } from '@/store/useUIStore'

function ToastItem({ toast }: { toast: Toast }) {
  const dismissToast = useUIStore((s) => s.dismissToast)

  useEffect(() => {
    if (!toast.autoDismissMs) return
    const timer = setTimeout(() => dismissToast(toast.id), toast.autoDismissMs)
    return () => clearTimeout(timer)
  }, [toast.id, toast.autoDismissMs, dismissToast])

  const variantClasses: Record<Toast['variant'], string> = {
    success: 'bg-green-50 border-green-500 text-green-800',
    info: 'bg-blue-50 border-blue-500 text-blue-800',
    warning: 'bg-yellow-50 border-yellow-500 text-yellow-800',
    error: 'bg-red-50 border-red-500 text-red-800',
  }

  return (
    <div
      role="alert"
      className={`flex items-start justify-between gap-3 rounded border-l-4 px-4 py-3 shadow-sm ${variantClasses[toast.variant]}`}
    >
      <p className="text-sm">{toast.message}</p>
      <button
        onClick={() => dismissToast(toast.id)}
        className="shrink-0 text-current opacity-60 hover:opacity-100"
        aria-label="Dismiss"
      >
        ✕
      </button>
    </div>
  )
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const toastQueue = useUIStore((s) => s.toastQueue)

  return (
    <>
      {children}
      <div
        aria-live="polite"
        aria-atomic="false"
        className="fixed bottom-4 right-4 z-50 flex w-80 flex-col gap-2"
      >
        {toastQueue.map((toast) => (
          <ToastItem key={toast.id} toast={toast} />
        ))}
      </div>
    </>
  )
}
