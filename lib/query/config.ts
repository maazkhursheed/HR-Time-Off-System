import { QueryClient } from '@tanstack/react-query'

export function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000, // 1 minute default
        gcTime: 15 * 60 * 1000, // 15 minutes
        retry: (failureCount, error) => {
          // No retry on 4xx errors
          if (error instanceof Error && 'statusCode' in error) {
            const code = (error as { statusCode: number }).statusCode
            if (code >= 400 && code < 500) return false
          }
          return failureCount < 2
        },
        retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 10000),
      },
    },
  })
}

// Per-query stale times (ms) — referenced in individual query hooks
export const STALE_TIMES = {
  balance: 5 * 60 * 1000, // 5 minutes
  requests: 60 * 1000, // 60 seconds
  teamRequests: 30 * 1000, // 30 seconds
  teamBalance: 10 * 60 * 1000, // 10 minutes
  teamCalendar: 10 * 60 * 1000, // 10 minutes
  notifications: 60 * 1000,
  employeeProfile: 30 * 60 * 1000, // 30 minutes
}
