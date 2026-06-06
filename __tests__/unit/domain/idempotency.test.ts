import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  generateIdempotencyKey,
  getOrCreateIdempotencyKey,
  clearIdempotencyKey,
} from '@/domain/request/idempotency'

// jsdom provides sessionStorage

beforeEach(() => sessionStorage.clear())
afterEach(() => sessionStorage.clear())

const FORM_ID = 'test-form-instance'
const KEY_PREFIX = 'idempotency:'

// ── generateIdempotencyKey ────────────────────────────────────────────────────
// Protects: each call must produce a unique, RFC-4122-format key

describe('generateIdempotencyKey', () => {
  it('returns a UUID-shaped string', () => {
    const key = generateIdempotencyKey()
    expect(key).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    )
  })

  it('returns a different value on every call', () => {
    expect(generateIdempotencyKey()).not.toBe(generateIdempotencyKey())
  })
})

// ── getOrCreateIdempotencyKey ─────────────────────────────────────────────────
// Protects: network-retry on the same form instance must send the identical key,
// so HCM can de-duplicate the submission rather than creating a duplicate request.

describe('getOrCreateIdempotencyKey', () => {
  it('creates a new key and persists it to sessionStorage', () => {
    const key = getOrCreateIdempotencyKey(FORM_ID)
    expect(sessionStorage.getItem(`${KEY_PREFIX}${FORM_ID}`)).toBe(key)
  })

  it('returns the same key on subsequent calls (idempotent)', () => {
    const first = getOrCreateIdempotencyKey(FORM_ID)
    const second = getOrCreateIdempotencyKey(FORM_ID)
    expect(first).toBe(second)
  })

  it('different formInstanceIds produce different keys', () => {
    const a = getOrCreateIdempotencyKey('form-a')
    const b = getOrCreateIdempotencyKey('form-b')
    expect(a).not.toBe(b)
  })

  it('re-uses an existing key already in sessionStorage', () => {
    const existingKey = 'pre-seeded-uuid-value'
    sessionStorage.setItem(`${KEY_PREFIX}${FORM_ID}`, existingKey)
    expect(getOrCreateIdempotencyKey(FORM_ID)).toBe(existingKey)
  })
})

// ── clearIdempotencyKey ───────────────────────────────────────────────────────
// Protects: after a successful submission the old key is removed, so re-opening
// the form generates a fresh key rather than replaying a previously used one.

describe('clearIdempotencyKey', () => {
  it('removes the key from sessionStorage', () => {
    getOrCreateIdempotencyKey(FORM_ID) // create
    clearIdempotencyKey(FORM_ID)
    expect(sessionStorage.getItem(`${KEY_PREFIX}${FORM_ID}`)).toBeNull()
  })

  it('after clearing, getOrCreate generates a brand-new key', () => {
    const first = getOrCreateIdempotencyKey(FORM_ID)
    clearIdempotencyKey(FORM_ID)
    const second = getOrCreateIdempotencyKey(FORM_ID)
    expect(second).not.toBe(first)
  })

  it('clearing is a no-op when the key does not exist', () => {
    expect(() => clearIdempotencyKey('nonexistent-form')).not.toThrow()
  })
})
