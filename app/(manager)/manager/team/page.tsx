import { cookies } from 'next/headers'
import { TeamBalanceSummary } from '@/components/manager/TeamBalanceSummary/TeamBalanceSummary'
import { ErrorBoundary } from '@/components/errors/ErrorBoundary'
import type { Session } from '@/types/user'

async function getSession(): Promise<Session | null> {
  const cookieStore = await cookies()
  const raw = cookieStore.get('session')?.value
  if (!raw) return null
  try { return JSON.parse(raw) as Session } catch { return null }
}

const DEMO_SESSION: Session = {
  user: { id: 'user-mgr-001', role: 'manager', email: 'bob@example.com', name: 'Bob Smith' },
  expiresAt: new Date(Date.now() + 86400_000).toISOString(),
}

export default async function TeamPage() {
  const session = (await getSession()) ?? DEMO_SESSION

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-900">Team Balances</h1>
        <p className="mt-1 text-sm text-gray-500">
          Batch-fetched from HCM. Refreshes every 10 minutes or after an approval/rejection.
        </p>
      </div>
      <ErrorBoundary fallback={<p className="text-sm text-red-600">Could not load team balances.</p>}>
        <TeamBalanceSummary managerId={session.user.id} />
      </ErrorBoundary>
    </main>
  )
}
