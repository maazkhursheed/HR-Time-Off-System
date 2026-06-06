import type { LeaveRequest, DateRange } from '@/types/leave'

export function datesOverlap(a: DateRange, b: DateRange): boolean {
  const aStart = new Date(a.startDate)
  const aEnd = new Date(a.endDate)
  const bStart = new Date(b.startDate)
  const bEnd = new Date(b.endDate)
  return aStart <= bEnd && bStart <= aEnd
}

export function findOverlappingRequests(
  candidate: DateRange,
  existing: LeaveRequest[]
): LeaveRequest[] {
  return existing.filter(
    (r) =>
      (r.status === 'pending' || r.status === 'approved') &&
      datesOverlap(candidate, { startDate: r.startDate, endDate: r.endDate })
  )
}

export function countTeamOverlaps(
  candidate: DateRange,
  teamRequests: LeaveRequest[],
  excludeUserId: string
): number {
  return teamRequests.filter(
    (r) =>
      r.userId !== excludeUserId &&
      r.status === 'approved' &&
      datesOverlap(candidate, { startDate: r.startDate, endDate: r.endDate })
  ).length
}
