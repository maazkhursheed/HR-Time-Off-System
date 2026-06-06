import { http, HttpResponse, delay } from 'msw'
import { MOCK_REQUESTS, MOCK_PENDING_REQUEST } from '@/mocks/fixtures/requests'
import type { LeaveRequest } from '@/types/leave'

let requests: LeaveRequest[] = [...MOCK_REQUESTS]

export const requestHandlers = [
  http.get('/api/requests', async ({ request }) => {
    await delay(300)
    const userId = new URL(request.url).searchParams.get('userId')
    const filtered = requests.filter((r) => !userId || r.userId === userId)
    return HttpResponse.json({ data: filtered, total: filtered.length, page: 1 })
  }),

  http.post('/api/requests', async ({ request }) => {
    await delay(400)
    const body = await request.json() as Partial<LeaveRequest>
    const newRequest: LeaveRequest = {
      ...MOCK_PENDING_REQUEST,
      id: `req-${Date.now()}`,
      ...body,
      status: 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as LeaveRequest
    requests = [newRequest, ...requests]
    return HttpResponse.json({ data: newRequest }, { status: 201 })
  }),

  http.patch('/api/requests/:id', async ({ request, params }) => {
    await delay(300)
    const { id } = params
    const body = await request.json() as { action: string }
    const statusMap: Record<string, LeaveRequest['status']> = {
      approve: 'approved',
      reject: 'rejected',
      cancel: 'cancelled',
    }
    requests = requests.map((r) =>
      r.id === id ? { ...r, status: statusMap[body.action] ?? r.status, updatedAt: new Date().toISOString() } : r
    )
    const updated = requests.find((r) => r.id === id)
    if (!updated) return HttpResponse.json({ error: { code: 'NOT_FOUND', message: 'Request not found.' } }, { status: 404 })
    return HttpResponse.json({ data: updated })
  }),
]
