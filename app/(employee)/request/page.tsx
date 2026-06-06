import { cookies } from 'next/headers'
import { LeaveRequestForm } from '@/components/employee/LeaveRequestForm/LeaveRequestForm'
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

export default async function RequestLeavePage() {
  const session = (await getSession()) ?? DEMO_SESSION
  const userId = session.user.id

  return (
    <main className="mx-auto max-w-xl px-4 py-8">
      <div className="mb-6">
        <a href="/dashboard" className="text-sm text-blue-600 hover:underline">
          ← Back to dashboard
        </a>
        <h1 className="mt-2 text-xl font-semibold text-gray-900">New Leave Request</h1>
        <p className="mt-1 text-sm text-gray-500">
          Your manager will be notified once your request is submitted.
        </p>
      </div>
      <LeaveRequestForm userId={userId} managerId="user-mgr-001" />
    </main>
  )
}
