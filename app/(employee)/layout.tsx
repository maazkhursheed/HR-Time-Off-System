import Link from 'next/link'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { clearSession } from '@/lib/actions/setDemoSession'
import type { Session } from '@/types/user'

const DEMO_SESSION: Session = {
  user: { id: 'user-emp-001', role: 'employee', email: 'alice@example.com', name: 'Alice Chen' },
  expiresAt: new Date(Date.now() + 86400_000).toISOString(),
}

async function getSession(): Promise<Session | null> {
  const cookieStore = await cookies()
  const raw = cookieStore.get('session')?.value
  if (!raw) return null
  try { return JSON.parse(raw) as Session } catch { return null }
}

export default async function EmployeeLayout({ children }: { children: React.ReactNode }) {
  const session = (await getSession()) ?? DEMO_SESSION

  if (session.user.role !== 'employee') redirect('/manager/dashboard')

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="border-b bg-white px-4 py-3">
        <div className="mx-auto flex max-w-4xl items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/dashboard" className="text-sm font-semibold text-gray-900 hover:text-blue-600">
              My Leave
            </Link>
            <Link href="/request" className="text-sm text-gray-600 hover:text-blue-600">
              New Request
            </Link>
            <Link href="/history" className="text-sm text-gray-600 hover:text-blue-600">
              History
            </Link>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-500">{session.user.name}</span>
            <form action={clearSession}>
              <button type="submit" className="text-xs text-gray-400 hover:text-gray-700 underline">
                Switch role
              </button>
            </form>
          </div>
        </div>
      </nav>
      {children}
    </div>
  )
}
