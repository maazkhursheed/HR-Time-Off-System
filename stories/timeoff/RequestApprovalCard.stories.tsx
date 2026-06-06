import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { expect, screen, userEvent, within, waitFor } from 'storybook/test'
import { RequestApprovalCard } from '@/components/manager/TeamPendingRequests/RequestApprovalCard'
import { withToasts } from './_decorators'
import {
  CARLOS,
  DIANA,
  CARLOS_PENDING,
  DIANA_PENDING,
  CARLOS_OVERDRAW,
} from './_fixtures'

const MANAGER_ID = 'user-mgr-001'

const meta = {
  title: 'TimeOff/RequestApprovalCard',
  component: RequestApprovalCard,
  decorators: [withToasts],
  args: {
    request: CARLOS_PENDING,
    managerId: MANAGER_ID,
    employeeBalance: CARLOS,
  },
} satisfies Meta<typeof RequestApprovalCard>

export default meta
type Story = StoryObj<typeof meta>

// Normal state — balance context shows "Annual balance: 26 → 22 days after approval"
export const Default: Story = {}

// Approval would leave ≤3 annual days — yellow balance context row
export const LowBalanceAfterApproval: Story = {
  args: {
    request: { ...CARLOS_PENDING, businessDays: 24 }, // 26 - 24 = 2 remaining
  },
}

// Approval would overdraw — red balance context row, "Balance insufficient" message
export const WouldOverdraw: Story = {
  args: {
    request: CARLOS_OVERDRAW,
  },
}

// No balance context (batch query still loading) — card shows userId instead of name
export const WithoutBalance: Story = {
  args: {
    employeeBalance: undefined,
  },
}

// Sick leave — balance context shows sick days (card renders correctly for non-annual types)
export const SickLeave: Story = {
  args: {
    request: DIANA_PENDING,
    employeeBalance: DIANA,
  },
}

// Manager clicks Approve — button shows loading, success toast appears
export const Approving: Story = {
  beforeEach() {
    const orig = global.fetch
    global.fetch = async (input, init) => {
      const url = String(input)
      if (url.includes('/api/hcm/request') && (init as RequestInit)?.method === 'PATCH') {
        return new Response(
          JSON.stringify({ requestId: CARLOS_PENDING.id, status: 'APPROVED' }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      }
      return orig(input as RequestInfo, init)
    }
    return () => { global.fetch = orig }
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: /^approve$/i }))
    await waitFor(
      () => expect(screen.getByRole('alert')).toBeTruthy(),
      { timeout: 3000 }
    )
  },
}

// Manager types a rejection note and clicks Reject — success toast appears
export const Rejecting: Story = {
  beforeEach() {
    const orig = global.fetch
    global.fetch = async (input, init) => {
      const url = String(input)
      if (url.includes('/api/hcm/request') && (init as RequestInit)?.method === 'PATCH') {
        return new Response(
          JSON.stringify({ requestId: CARLOS_PENDING.id, status: 'REJECTED' }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      }
      return orig(input as RequestInfo, init)
    }
    return () => { global.fetch = orig }
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.type(
      canvas.getByPlaceholderText(/optional note/i),
      'Insufficient staffing this week'
    )
    await userEvent.click(canvas.getByRole('button', { name: /^reject$/i }))
    await waitFor(
      () => expect(screen.getByRole('alert')).toBeTruthy(),
      { timeout: 3000 }
    )
  },
}
