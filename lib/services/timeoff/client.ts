const TO_BASE_URL = process.env.TIMEOFF_SERVICE_URL ?? ''
const TO_SERVICE_TOKEN = process.env.TIMEOFF_SERVICE_TOKEN ?? ''

export class TimeOffServiceError extends Error {
  constructor(
    public readonly code: string,
    public readonly statusCode: number,
    message: string
  ) {
    super(message)
    this.name = 'TimeOffServiceError'
  }
}

export async function toFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const res = await fetch(`${TO_BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${TO_SERVICE_TOKEN}`,
      ...options.headers,
    },
  })

  if (!res.ok) {
    let body: { code?: string; message?: string } = {}
    try {
      body = await res.json()
    } catch {
      // ignore
    }
    throw new TimeOffServiceError(
      body.code ?? 'UNKNOWN',
      res.status,
      body.message ?? `Time-Off service responded with ${res.status}`
    )
  }

  return res.json() as Promise<T>
}
