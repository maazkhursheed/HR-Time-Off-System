'use client'

import { useState } from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { makeQueryClient } from '@/lib/query/config'
import { useCrossTabSync } from '@/lib/sync/useCrossTabSync'

// Renders nothing — exists only to call useCrossTabSync inside the QueryClientProvider
// tree so that useQueryClient() resolves to the correct client instance.
function CrossTabSyncMount() {
  useCrossTabSync()
  return null
}

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => makeQueryClient())
  return (
    <QueryClientProvider client={queryClient}>
      <CrossTabSyncMount />
      {children}
    </QueryClientProvider>
  )
}
