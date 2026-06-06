export const cacheTags = {
  balance: (userId: string) => `balance:${userId}`,
  requests: (userId: string) => `requests:${userId}`,
  teamRequests: (managerId: string) => `team-requests:${managerId}`,
  teamBalance: (managerId: string) => `team-balance:${managerId}`,
  teamCalendar: (managerId: string) => `team-calendar:${managerId}`,
  employeeProfile: (userId: string) => `profile:${userId}`,
}
