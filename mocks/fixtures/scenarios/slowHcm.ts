import { http, HttpResponse, delay } from 'msw'
import { MOCK_BALANCE, MOCK_TEAM_BALANCES } from '@/mocks/fixtures/balances'

// Simulates a slow HCM response (~2s) to test skeleton states
export const slowHcmHandlers = [
  http.get('/api/balance', async () => {
    await delay(2000)
    return HttpResponse.json({ data: MOCK_BALANCE })
  }),

  http.get('/api/team/balances', async () => {
    await delay(2500)
    return HttpResponse.json({ data: MOCK_TEAM_BALANCES, syncedAt: new Date().toISOString() })
  }),
]
