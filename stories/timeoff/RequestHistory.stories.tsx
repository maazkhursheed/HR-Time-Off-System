import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { queryKeys } from '@/lib/query/keys'
import { useUIStore } from '@/store/useUIStore'
import { RequestHistory } from '@/components/employee/RequestHistory/RequestHistory'
import { withQueryData, withToasts } from './_decorators'
import { ALICE_PENDING, JUST_NOW } from './_fixtures'
import type { LeaveRequest } from '@/types/leave'

const USER_ID = 'user-emp-001'
const REQUESTS_KEY = queryKeys.requests(USER_ID)

const ALICE_APPROVED: LeaveRequest = {
  id: 'req-hist-002',
  userId: USER_ID,
  type: 'annual',
  startDate: '2026-05-01',
  endDate: '2026-05-02',
  businessDays: 2,
  status: 'approved',
  idempotencyKey: 'idem-hist-002',
  createdAt: JUST_NOW,
  updatedAt: JUST_NOW,
}

const ALICE_REJECTED: LeaveRequest = {
  id: 'req-hist-003',
  userId: USER_ID,
  type: 'sick',
  startDate: '2026-04-15',
  endDate: '2026-04-15',
  businessDays: 1,
  status: 'rejected',
  idempotencyKey: 'idem-hist-003',
  createdAt: JUST_NOW,
  updatedAt: JUST_NOW,
}

const ALL_REQUESTS = [ALICE_PENDING, ALICE_APPROVED, ALICE_REJECTED]

const meta = {
  title: 'TimeOff/RequestHistory',
  component: RequestHistory,
  decorators: [withToasts],
  args: { userId: USER_ID },
} satisfies Meta<typeof RequestHistory>

export default meta
type Story = StoryObj<typeof meta>

// SkeletonText shown while requests are loading for the first time
export const Loading: Story = {
  beforeEach() {
    const orig = global.fetch
    global.fetch = () => new Promise(() => {})
    return () => { global.fetch = orig }
  },
}

// No requests — "No leave requests found." empty state
export const Empty: Story = {
  decorators: [
    withQueryData([
      [REQUESTS_KEY, []],
    ]),
  ],
}

// Three requests: pending (Cancel button visible), approved, rejected
export const WithHistory: Story = {
  decorators: [
    withQueryData([
      [REQUESTS_KEY, ALL_REQUESTS],
    ]),
  ],
  beforeEach() {
    useUIStore.setState({ activeFilters: { status: [], type: [] } })
  },
}

// activeFilters.status=['pending'] — only the pending card is shown; approved and
// rejected cards are hidden by the filter even though all three are in the cache.
export const Filtered: Story = {
  decorators: [
    withQueryData([
      [REQUESTS_KEY, ALL_REQUESTS],
    ]),
  ],
  beforeEach() {
    useUIStore.setState({ activeFilters: { status: ['pending'], type: [] } })
    return () => useUIStore.setState({ activeFilters: { status: [], type: [] } })
  },
}

// HCM unavailable — component shows "Could not load request history." error state
export const HCMError: Story = {
  beforeEach() {
    const orig = global.fetch
    global.fetch = async () => new Response(null, { status: 503 })
    return () => { global.fetch = orig }
  },
}
