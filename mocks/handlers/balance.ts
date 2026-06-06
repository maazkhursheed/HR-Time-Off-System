import { http, HttpResponse, delay } from 'msw'
import { MOCK_BALANCE, MOCK_TEAM_BALANCES } from '@/mocks/fixtures/balances'

export const balanceHandlers = [
  http.get('/api/balance', async ({ request }) => {
    await delay(300)
    const userId = new URL(request.url).searchParams.get('userId')
    if (!userId) {
      return HttpResponse.json({ error: { code: 'VALIDATION', message: 'userId required' } }, { status: 400 })
    }
    return HttpResponse.json({ data: MOCK_BALANCE })
  }),

  http.get('/api/team/balances', async ({ request }) => {
    await delay(600)
    const managerId = new URL(request.url).searchParams.get('managerId')
    if (!managerId) {
      return HttpResponse.json({ error: { code: 'VALIDATION', message: 'managerId required' } }, { status: 400 })
    }
    return HttpResponse.json({ data: MOCK_TEAM_BALANCES, syncedAt: new Date().toISOString() })
  }),
]
