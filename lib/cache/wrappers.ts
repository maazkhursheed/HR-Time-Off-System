import 'server-only'
import { unstable_cache } from 'next/cache'
import { fetchHCMBalance, fetchHCMTeamBalances } from '@/lib/services/hcm/balance'
import { cacheTags } from './tags'

export const getCachedBalance = (userId: string) =>
  unstable_cache(
    () => fetchHCMBalance(userId),
    [cacheTags.balance(userId)],
    {
      tags: [cacheTags.balance(userId)],
      revalidate: 300, // 5 minutes
    }
  )()

export const getCachedTeamBalances = (managerId: string, userIds: string[]) =>
  unstable_cache(
    () => fetchHCMTeamBalances(userIds),
    [cacheTags.teamBalance(managerId)],
    {
      tags: [cacheTags.teamBalance(managerId)],
      revalidate: 600, // 10 minutes
    }
  )()
