import { http, HttpResponse, delay } from 'msw'

// Override handlers that simulate HCM being down (consecutive 5xx)
export const degradedModeHandlers = [
  http.get('/api/balance', async () => {
    await delay(300)
    return HttpResponse.json(
      { error: { code: 'HCM_UNAVAILABLE', message: 'HCM is temporarily unavailable.' } },
      { status: 503 }
    )
  }),

  http.get('/api/team/balances', async () => {
    await delay(300)
    return HttpResponse.json(
      { error: { code: 'HCM_UNAVAILABLE', message: 'HCM batch endpoint is unavailable.' } },
      { status: 503 }
    )
  }),

  http.post('/api/requests', async () => {
    await delay(300)
    return HttpResponse.json(
      { error: { code: 'HCM_UNAVAILABLE', message: 'Cannot submit request: HCM is down.' } },
      { status: 503 }
    )
  }),
]
