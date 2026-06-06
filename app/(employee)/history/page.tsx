import { cookies } from 'next/headers'
import { RequestHistory } from '@/components/employee/RequestHistory/RequestHistory'
import { ErrorBoundary } from '@/components/errors/ErrorBoundary'
import type { Session } from '@/types/user'

async function getSession(): Promise<Session | null> {
  const cookieStore = await cookies()
  const raw = cookieStore.get('session')?.value
  if (!raw) return null
  try { return JSON.parse(raw) as Session } catch { return null }
}

const DEMO_SESSION: Session = {
  user: { id: 'user-emp-001', role: 'employee', email: 'alice@example.com', name: 'Alice Chen' },
  expiresAt: new Date(Date.now() + 86400_000).toISOString(),
}

export default async function HistoryPage() {
  const session = (await getSession()) ?? DEMO_SESSION

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">Leave History</h1>
        <a href="/request" className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
          + Request leave
        </a>
      </div>
      <ErrorBoundary fallback={<p className="text-sm text-red-600">Could not load history.</p>}>
        <RequestHistory userId={session.user.id} />
      </ErrorBoundary>
    </main>
  )
}
