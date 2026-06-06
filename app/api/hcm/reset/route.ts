// Dev-only endpoint to reset the HCM mock store (forces re-seeding with latest seed data)
import { resetStore } from '../_store'

export async function POST() {
  if (process.env.NODE_ENV === 'production') {
    return Response.json({ error: 'Not available in production.' }, { status: 403 })
  }
  resetStore()
  return Response.json({ ok: true, message: 'HCM mock store reset.' })
}
