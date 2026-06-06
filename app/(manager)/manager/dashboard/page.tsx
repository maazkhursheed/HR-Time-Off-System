import { cookies } from 'next/headers'
import { TeamPendingRequests } from '@/components/manager/TeamPendingRequests/TeamPendingRequests'
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

const TEAM_MEMBER_IDS = ['user-emp-001', 'user-emp-002', 'user-emp-003']

export default async function ManagerDashboardPage() {
  const session = (await getSession()) ?? DEMO_SESSION
  const managerId = session.user.id

  return (
    <main className="mx-auto max-w-5xl space-y-8 px-4 py-8">
      <header>
        <p className="text-xs uppercase tracking-wide text-gray-400">Manager view</p>
        <h1 className="text-xl font-semibold text-gray-900">Team Overview</h1>
        <p className="text-sm text-gray-500">{session.user.name}</p>
      </header>

      <section aria-label="Pending approvals">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-700">
          Pending Approvals
        </h2>
        <ErrorBoundary fallback={<p className="text-sm text-red-600">Could not load requests.</p>}>
          <TeamPendingRequests managerId={managerId} teamMemberIds={TEAM_MEMBER_IDS} />
        </ErrorBoundary>
      </section>

      <section aria-label="Team balances">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-700">
          Team Balances
        </h2>
        <ErrorBoundary fallback={<p className="text-sm text-red-600">Could not load balances.</p>}>
          <TeamBalanceSummary managerId={managerId} teamMemberIds={TEAM_MEMBER_IDS} />
        </ErrorBoundary>
      </section>
    </main>
  )
}
