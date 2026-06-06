import '@testing-library/jest-dom'

// Silence React 19 act() warnings in hook tests; they are cosmetic, not failures.
const originalError = console.error.bind(console.error)
beforeAll(() => {
  console.error = (...args: unknown[]) => {
    if (typeof args[0] === 'string' && args[0].includes('act(')) return
    originalError(...args)
  }
})
afterAll(() => {
  console.error = originalError
})
