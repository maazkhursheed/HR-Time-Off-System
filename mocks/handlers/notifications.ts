import { http, HttpResponse, delay } from 'msw'

export const notificationHandlers = [
  http.get('/api/notifications', async () => {
    await delay(100)
    return HttpResponse.json({ data: [], unreadCount: 0 })
  }),

  http.patch('/api/notifications', async () => {
    await delay(100)
    return HttpResponse.json({ success: true })
  }),
]
