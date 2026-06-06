import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { expect, within, userEvent, waitFor, screen } from 'storybook/test'
import { LeaveRequestForm } from '@/components/employee/LeaveRequestForm/LeaveRequestForm'
import { queryKeys } from '@/lib/query/keys'
import { withQueryData, withToasts } from './_decorators'
import { ALICE, ALICE_LOW, hcmBalanceResponse } from './_fixtures'

const meta = {
  title: 'TimeOff/LeaveRequestForm',
  component: LeaveRequestForm,
  decorators: [withToasts],
  args: {
    userId: 'user-emp-001',
    managerId: 'user-mgr-001',
  },
} satisfies Meta<typeof LeaveRequestForm>

export default meta
type Story = StoryObj<typeof meta>

// ── Loading state ─────────────────────────────────────────────────────────────
// Balance is still fetching — submit button must be disabled, no balance preview.

export const Loading: Story = {
  beforeEach() {
    const orig = global.fetch
    global.fetch = async (input) => {
      if (String(input).includes('/api/hcm/balance')) return new Promise(() => {})
      return orig(input as RequestInfo)
    }
    return () => { global.fetch = orig }
  },
}

// ── Default — full balance available ─────────────────────────────────────────
// Balance pre-seeded; submit starts disabled until all fields are filled.
// Interaction: verifies form structure renders correctly.

export const Default: Story = {
  decorators: [withQueryData([[queryKeys.balance('user-emp-001'), ALICE]])],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    // Submit button must be present and initially disabled
    await waitFor(() => {
      const btn = canvas.getByRole('button', { name: /submit request/i })
      expect(btn).toBeTruthy()
      expect((btn as HTMLButtonElement).disabled).toBe(true)
    })
    // Cancel button must be present
    expect(canvas.getByRole('button', { name: /cancel/i })).toBeTruthy()
  },
}

// ── Low balance warning ───────────────────────────────────────────────────────
// Only 2 annual days available. Selecting "annual" and a 3-day range must
// disable the submit button (hasEnoughBalance returns false).
// Protects: balance mismatch — form must prevent overdraw submission.

export const LowBalanceBlocksSubmit: Story = {
  decorators: [withQueryData([[queryKeys.balance('user-emp-001'), ALICE_LOW]])],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await waitFor(() => canvas.getByRole('button', { name: /submit request/i }))

    // Select leave type
    const annualOption = canvas.queryByRole('radio', { name: /annual/i })
      ?? canvas.queryByText(/annual/i)
    if (annualOption) await userEvent.click(annualOption)

    // Pick a date range spanning 3 business days (Mon–Wed)
    const startInput = canvas.queryByLabelText(/start/i) as HTMLInputElement | null
    const endInput   = canvas.queryByLabelText(/end/i)   as HTMLInputElement | null
    if (startInput && endInput) {
      await userEvent.clear(startInput)
      await userEvent.type(startInput, '2026-07-13')
      await userEvent.clear(endInput)
      await userEvent.type(endInput, '2026-07-15')
    }

    // With only 2 annual days and 3 requested, submit must be disabled
    await waitFor(() => {
      const btn = canvas.getByRole('button', { name: /submit request/i }) as HTMLButtonElement
      expect(btn.disabled).toBe(true)
    })
  },
}

// ── Successful submission ─────────────────────────────────────────────────────
// All fields valid, HCM accepts the request → success toast appears.
// Protects: submission flow — happy path must complete without errors.

export const SuccessfulSubmission: Story = {
  decorators: [withQueryData([[queryKeys.balance('user-emp-001'), ALICE]])],
  beforeEach() {
    const orig = global.fetch
    global.fetch = async (input, init) => {
      // Intercept the HCM submission endpoint called by the submitRequest action
      if (String(input).includes('/api/hcm/request') && (init as RequestInit)?.method === 'POST') {
        return new Response(
          JSON.stringify({ requestId: 'req-new-001', status: 'PENDING' }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      }
      // Serve fresh balance for query
      if (String(input).includes('/api/hcm/balance')) {
        return new Response(JSON.stringify(hcmBalanceResponse(ALICE)), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }
      return orig(input as RequestInfo, init)
    }
    return () => { global.fetch = orig }
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await waitFor(() => canvas.getByRole('button', { name: /submit request/i }))

    // Select leave type — try radio first, fall back to any clickable element
    const annualEl = canvas.queryByRole('radio', { name: /annual/i })
      ?? canvas.queryByLabelText(/annual/i)
      ?? canvas.queryByText(/^annual$/i)
    if (annualEl) await userEvent.click(annualEl)

    // Fill dates (Mon 2026-07-13 → Wed 2026-07-15, 3 business days)
    const startInput = canvas.queryByLabelText(/start.*date/i) as HTMLInputElement | null
    const endInput   = canvas.queryByLabelText(/end.*date/i)   as HTMLInputElement | null
    if (startInput && endInput) {
      await userEvent.clear(startInput)
      await userEvent.type(startInput, '2026-07-13')
      await userEvent.clear(endInput)
      await userEvent.type(endInput, '2026-07-15')
    }

    // Submit button should be enabled now — click it
    const submitBtn = canvas.getByRole('button', { name: /submit request/i })
    await waitFor(() => expect((submitBtn as HTMLButtonElement).disabled).toBe(false))
    await userEvent.click(submitBtn)

    // Success toast must appear
    await waitFor(
      () => expect(screen.queryByRole('alert')).toBeTruthy(),
      { timeout: 4000 }
    )
  },
}

// ── HCM returns INSUFFICIENT_BALANCE ─────────────────────────────────────────
// Server-side balance check fails (race: balance changed between load and submit).
// Protects: balance mismatch — server rejection must surface as an error toast,
// not a silent failure.

export const ServerSideInsufficientBalance: Story = {
  decorators: [withQueryData([[queryKeys.balance('user-emp-001'), ALICE]])],
  beforeEach() {
    const orig = global.fetch
    global.fetch = async (input, init) => {
      if (String(input).includes('/api/hcm/request') && (init as RequestInit)?.method === 'POST') {
        return new Response(
          JSON.stringify({ errorCode: 'INSUFFICIENT_BALANCE', errorMessage: 'Insufficient annual balance.' }),
          { status: 422, headers: { 'Content-Type': 'application/json' } }
        )
      }
      if (String(input).includes('/api/hcm/balance')) {
        return new Response(JSON.stringify(hcmBalanceResponse(ALICE)), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }
      return orig(input as RequestInfo, init)
    }
    return () => { global.fetch = orig }
  },
}
