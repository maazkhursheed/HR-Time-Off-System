import type { HCMError } from './types'
import type { AppError } from '@/types/errors'

const HCM_BASE_URL = process.env.HCM_API_URL ?? ''
const HCM_API_KEY = process.env.HCM_API_KEY ?? ''

const TIMEOUTS = {
  realtime: 2000,
  batch: 5000,
}

class HCMServiceError extends Error {
  constructor(
    public readonly appError: AppError,
    public readonly statusCode: number
  ) {
    super(appError.message)
    this.name = 'HCMServiceError'
  }
}

async function hcmFetch<T>(
  path: string,
  options: RequestInit & { timeoutMs?: number } = {}
): Promise<T> {
  const { timeoutMs = TIMEOUTS.realtime, ...fetchOptions } = options
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  let res: Response
  try {
    res = await fetch(`${HCM_BASE_URL}${path}`, {
      ...fetchOptions,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': HCM_API_KEY,
        ...fetchOptions.headers,
      },
    })
  } catch (err) {
    clearTimeout(timer)
    if ((err as Error).name === 'AbortError') {
      throw new HCMServiceError(
        { code: 'HCM_UNAVAILABLE', message: 'HCM request timed out.' },
        504
      )
    }
    throw new HCMServiceError(
      { code: 'HCM_UNAVAILABLE', message: 'HCM is unreachable.' },
      503
    )
  }
  clearTimeout(timer)

  if (!res.ok) {
    let hcmErr: HCMError | null = null
    try {
      hcmErr = await res.json()
    } catch {
      // ignore parse error
    }
    throw new HCMServiceError(
      {
        code: res.status >= 500 ? 'HCM_UNAVAILABLE' : 'HCM_REJECTED',
        message: hcmErr?.errorMessage ?? `HCM responded with ${res.status}`,
        field: hcmErr?.field,
      },
      res.status
    )
  }

  return res.json() as Promise<T>
}

export { hcmFetch, HCMServiceError, TIMEOUTS }
