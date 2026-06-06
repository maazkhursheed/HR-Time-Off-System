import { cookies } from 'next/headers'
import { TeamPendingRequests } from '@/components/manager/TeamPendingRequests/TeamPendingRequests'
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

export default async function ManagerRequestsPage() {
  const session = (await getSession()) ?? DEMO_SESSION

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="mb-6 text-xl font-semibold text-gray-900">Approval Queue</h1>
      <p className="mb-4 text-sm text-gray-500">
        Pending requests auto-refresh every 30 seconds. Approve or reject with an optional note.
      </p>
      <ErrorBoundary fallback={<p className="text-sm text-red-600">Could not load requests.</p>}>
        <TeamPendingRequests managerId={session.user.id} teamMemberIds={TEAM_MEMBER_IDS} />
      </ErrorBoundary>
    </main>
  )
}
