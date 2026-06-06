'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import type { Session } from '@/types/user'

const DEMO_SESSIONS: Record<'employee' | 'manager', Session> = {
  employee: {
    user: { id: 'user-emp-001', role: 'employee', email: 'alice@example.com', name: 'Alice Chen' },
    expiresAt: new Date(Date.now() + 86400_000).toISOString(),
  },
  manager: {
    user: { id: 'user-mgr-001', role: 'manager', email: 'bob@example.com', name: 'Bob Smith' },
    expiresAt: new Date(Date.now() + 86400_000).toISOString(),
  },
}

export async function setDemoSession(role: 'employee' | 'manager') {
  const session = DEMO_SESSIONS[role]
  const cookieStore = await cookies()
  cookieStore.set('session', JSON.stringify(session), {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 86400,
    path: '/',
  })
  redirect(role === 'employee' ? '/dashboard' : '/manager/dashboard')
}

export async function clearSession() {
  const cookieStore = await cookies()
  cookieStore.delete('session')
  redirect('/')
}
