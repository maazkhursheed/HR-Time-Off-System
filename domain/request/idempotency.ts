const STORAGE_KEY_PREFIX = 'idempotency:'

export function generateIdempotencyKey(): string {
  return crypto.randomUUID()
}

export function getOrCreateIdempotencyKey(formInstanceId: string): string {
  const storageKey = `${STORAGE_KEY_PREFIX}${formInstanceId}`
  const existing = sessionStorage.getItem(storageKey)
  if (existing) return existing

  const key = generateIdempotencyKey()
  sessionStorage.setItem(storageKey, key)
  return key
}

export function clearIdempotencyKey(formInstanceId: string): void {
  sessionStorage.removeItem(`${STORAGE_KEY_PREFIX}${formInstanceId}`)
}
