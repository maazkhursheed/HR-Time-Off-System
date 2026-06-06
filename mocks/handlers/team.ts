import { http, HttpResponse, delay } from 'msw'
import { MOCK_REQUESTS } from '@/mocks/fixtures/requests'

export const teamHandlers = [
  http.get('/api/team/requests', async () => {
    await delay(300)
    const pending = MOCK_REQUESTS.filter((r) => r.status === 'pending')
    return HttpResponse.json({ data: pending, total: pending.length })
  }),

  http.get('/api/team/calendar', async () => {
    await delay(400)
    return HttpResponse.json({ data: [] })
  }),
]
