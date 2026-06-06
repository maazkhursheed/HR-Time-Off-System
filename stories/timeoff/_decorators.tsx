import React from 'react'
import type { Decorator } from '@storybook/nextjs-vite'
import { useQueryClient } from '@tanstack/react-query'
import { ToastProvider } from '@/components/providers/ToastProvider'

// Exposed so play functions can trigger query invalidations
let _latestQc: ReturnType<typeof useQueryClient> | null = null
export function getStoryQueryClient() {
  return _latestQc
}

export const withToasts: Decorator = (Story) => (
  <ToastProvider>
    <Story />
  </ToastProvider>
)

/**
 * Pre-populates the story's QueryClient with the given key→value pairs.
 * Must be used alongside the global withQueryClient decorator (defined in preview.tsx).
 * Data is seeded once on mount (ref-guarded) and never overwritten on re-renders.
 */
export function withQueryData(entries: [readonly unknown[], unknown][]): Decorator {
  return (Story) => {
    const qc = useQueryClient()
    _latestQc = qc
    const seededRef = React.useRef(false)
    if (!seededRef.current) {
      seededRef.current = true
      for (const [key, value] of entries) {
        qc.setQueryData(key, value)
      }
    }
    return <Story />
  }
}
