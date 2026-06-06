import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { expect, screen, userEvent, within, waitFor } from 'storybook/test'
import { queryKeys } from '@/lib/query/keys'
import { TeamPendingRequests } from '@/components/manager/TeamPendingRequests/TeamPendingRequests'
import { withQueryData, withToasts } from './_decorators'
import {
  CARLOS,
  DIANA,
  CARLOS_PENDING,
  DIANA_PENDING,
  hcmRequestsResponse,
  hcmBatchBalanceResponse,
} from './_fixtures'

const MANAGER_ID = 'user-mgr-001'

const TEAM_IDS = ['user-emp-002', 'user-emp-003']
const TEAM_BALANCE_KEY = [...queryKeys.teamBalance(MANAGER_ID), TEAM_IDS]

const meta = {
  title: 'TimeOff/TeamPendingRequests',
  component: TeamPendingRequests,
  decorators: [withToasts],
  args: { managerId: MANAGER_ID, teamMemberIds: TEAM_IDS },
} satisfies Meta<typeof TeamPendingRequests>

export default meta
type Story = StoryObj<typeof meta>

// SkeletonText shown while team requests are loading for the first time
export const Loading: Story = {
  beforeEach() {
    const orig = global.fetch
    global.fetch = () => new Promise(() => {})
    return () => { global.fetch = orig }
  },
}

// No pending requests — "Queue auto-refreshes every 30s" empty state
export const Empty: Story = {
  decorators: [
    withQueryData([
      [queryKeys.teamRequests(MANAGER_ID), []],
    ]),
  ],
}

// Two pending cards with full balance context — Carlos (London) and Diana (Singapore)
export const WithRequests: Story = {
  decorators: [
    withQueryData([
      [queryKeys.teamRequests(MANAGER_ID), [CARLOS_PENDING, DIANA_PENDING]],
      [TEAM_BALANCE_KEY, [CARLOS, DIANA]],
    ]),
  ],
}

// Optimistic approve: clicking Approve removes the card immediately (before server responds).
// Card stays gone after server confirms success.
export const OptimisticApprove: Story = {
  decorators: [
    withQueryData([
      [queryKeys.teamRequests(MANAGER_ID), [CARLOS_PENDING, DIANA_PENDING]],
      [TEAM_BALANCE_KEY, [CARLOS, DIANA]],
    ]),
  ],
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
      // Serve the invalidation refetch after approval (Diana only remains)
      if (url.includes('/api/hcm/requests?managerId=')) {
        return new Response(
          JSON.stringify(hcmRequestsResponse([DIANA_PENDING])),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      }
      if (url.includes('/api/hcm/balances/batch')) {
        return new Response(
          JSON.stringify(hcmBatchBalanceResponse([DIANA])),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      }
      return orig(input as RequestInfo, init)
    }
    return () => { global.fetch = orig }
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    // Carlos's card is first — click its Approve button
    const approveButtons = canvas.getAllByRole('button', { name: /^approve$/i })
    await userEvent.click(approveButtons[0])
    // Card disappears optimistically; only Diana's card should remain
    await waitFor(() => {
      expect(canvas.getAllByRole('button', { name: /^approve$/i })).toHaveLength(1)
    }, { timeout: 2000 })
  },
}

// Optimistic rollback: clicking Approve removes the card (optimistic), but the
// server returns 409 (already-terminal). onSuccess restores the snapshot and
// shows an error toast — Carlos's card reappears.
export const OptimisticRollback: Story = {
  decorators: [
    withQueryData([
      [queryKeys.teamRequests(MANAGER_ID), [CARLOS_PENDING, DIANA_PENDING]],
      [TEAM_BALANCE_KEY, [CARLOS, DIANA]],
    ]),
  ],
  beforeEach() {
    const orig = global.fetch
    global.fetch = async (input, init) => {
      const url = String(input)
      if (url.includes('/api/hcm/request') && (init as RequestInit)?.method === 'PATCH') {
        // Server rejects — request is already in a terminal state
        return new Response(
          JSON.stringify({
            errorCode: 'ALREADY_TERMINAL',
            errorMessage: 'Request has already been processed.',
          }),
          { status: 409, headers: { 'Content-Type': 'application/json' } }
        )
      }
      // onSettled refetch returns the original data (both cards come back)
      if (url.includes('/api/hcm/requests?managerId=')) {
        return new Response(
          JSON.stringify(hcmRequestsResponse([CARLOS_PENDING, DIANA_PENDING])),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      }
      if (url.includes('/api/hcm/balances/batch')) {
        return new Response(
          JSON.stringify(hcmBatchBalanceResponse([CARLOS, DIANA])),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      }
      return orig(input as RequestInfo, init)
    }
    return () => { global.fetch = orig }
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const approveButtons = canvas.getAllByRole('button', { name: /^approve$/i })
    await userEvent.click(approveButtons[0])

    // Error toast confirms the rollback
    await waitFor(
      () => expect(screen.getByRole('alert')).toBeTruthy(),
      { timeout: 3000 }
    )
    // Both cards are restored — Carlos's card came back
    await waitFor(() => {
      expect(canvas.getAllByRole('button', { name: /^approve$/i })).toHaveLength(2)
    }, { timeout: 3000 })
  },
}
