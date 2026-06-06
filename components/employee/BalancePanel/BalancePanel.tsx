import { Suspense } from 'react'
import { BalancePanelClient } from './BalancePanelClient'
import { SkeletonText } from '@/components/ui/Skeleton/Skeleton'

interface BalancePanelProps {
  userId: string
}

export function BalancePanel({ userId }: BalancePanelProps) {
  return (
    <section aria-label="Leave balance">
      <h2 className="mb-3 text-sm font-semibold text-gray-700 uppercase tracking-wide">
        Leave Balance
      </h2>
      <Suspense fallback={<SkeletonText lines={2} />}>
        <BalancePanelClient userId={userId} />
      </Suspense>
    </section>
  )
}
