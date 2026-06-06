import type { RequestFilters } from '@/types/leave'

export const queryKeys = {
  balance: (userId: string) => ['balance', userId] as const,

  requests: (userId: string, filters?: RequestFilters) =>
    filters ? (['requests', userId, filters] as const) : (['requests', userId] as const),

  request: (requestId: string) => ['request', requestId] as const,

  teamRequests: (managerId: string) => ['team-requests', managerId] as const,

  teamBalance: (managerId: string) => ['team-balance', managerId] as const,

  teamCalendar: (managerId: string, from: string, to: string) =>
    ['team-calendar', managerId, from, to] as const,

  notifications: (userId: string) => ['notifications', userId] as const,
}
