import { http, HttpResponse, delay } from 'msw'
import { MOCK_PENDING_REQUEST } from '@/mocks/fixtures/requests'
import type { LeaveRequest } from '@/types/leave'

// Simulates Pattern A: HCM accepts submission but later changes status to rejected_by_hcm
// On first poll returns pending; subsequent polls return rejected_by_hcm

let pollCount = 0

export const silentFailureHandlers = [
  http.post('/api/requests', async () => {
    await delay(400)
    pollCount = 0
    return HttpResponse.json({ data: { ...MOCK_PENDING_REQUEST, status: 'pending' } }, { status: 201 })
  }),

  http.get('/api/requests/:id', async ({ params }) => {
    await delay(200)
    pollCount++
    const status: LeaveRequest['status'] = pollCount >= 2 ? 'rejected_by_hcm' : 'pending'
    return HttpResponse.json({ data: { ...MOCK_PENDING_REQUEST, id: params.id, status } })
  }),
]
