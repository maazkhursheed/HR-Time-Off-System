'use client'

import { useRouter } from 'next/navigation'
import { useFormStore } from '@/store/useFormStore'
import { useBalance } from '@/lib/query/balance'
import { useSubmitRequest } from '@/lib/mutations/useSubmitRequest'
import { countBusinessDays, hasEnoughBalance } from '@/domain/leave/calculators'
import { getOrCreateIdempotencyKey, clearIdempotencyKey } from '@/domain/request/idempotency'
import { Button } from '@/components/ui/Button/Button'
import { LeaveTypePicker } from './LeaveTypePicker'
import { DateRangePicker } from './DateRangePicker'
import { BalancePreview } from './BalancePreview'

const FORM_SESSION_KEY = 'leave-request-form'

interface LeaveRequestFormProps {
  userId: string
  managerId?: string
}

export function LeaveRequestForm({ userId, managerId }: LeaveRequestFormProps) {
  const router = useRouter()
  const { leaveRequestDraft: draft, setDraftField, resetDraft } = useFormStore()
  const { data: balance, isError: balanceError } = useBalance(userId)
  const { mutate: submit, isPending, error: mutationError } = useSubmitRequest()

  const businessDays =
    draft.startDate && draft.endDate
      ? countBusinessDays(draft.startDate, draft.endDate)
      : 0

  const canSubmit =
    !!draft.type &&
    !!draft.startDate &&
    !!draft.endDate &&
    businessDays > 0 &&
    !isPending &&
    (draft.type === 'unpaid' ||
      !balance ||
      hasEnoughBalance(
        { ...balance, lastSynced: balance.lastSynced },
        draft.type,
        businessDays
      ))

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit || !draft.type) return

    const idempotencyKey = getOrCreateIdempotencyKey(FORM_SESSION_KEY)

    submit(
      {
        userId,
        type: draft.type,
        startDate: draft.startDate,
        endDate: draft.endDate,
        businessDays,
        notes: draft.notes || undefined,
        idempotencyKey,
        managerId,
      },
      {
        onSuccess: (result) => {
          if (result.success) {
            clearIdempotencyKey(FORM_SESSION_KEY)
            resetDraft()
            router.push('/dashboard')
          }
        },
      }
    )
  }

  // Map mutation result error (returned from Server Action, not thrown)
  const submitResult = (mutationError as null) // thrown errors are rare; handled by onError in hook
  const actionError = submitResult

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-6">
      <LeaveTypePicker
        value={draft.type}
        onChange={(t) => setDraftField('type', t)}
        disabled={isPending}
      />

      <DateRangePicker
        startDate={draft.startDate}
        endDate={draft.endDate}
        onStartChange={(d) => setDraftField('startDate', d)}
        onEndChange={(d) => setDraftField('endDate', d)}
        disabled={isPending}
      />

      <div>
        <label htmlFor="notes" className="mb-1.5 block text-sm font-medium text-gray-700">
          Notes <span className="text-gray-400">(optional)</span>
        </label>
        <textarea
          id="notes"
          rows={3}
          value={draft.notes}
          onChange={(e) => setDraftField('notes', e.target.value)}
          disabled={isPending}
          placeholder="Add any relevant context for your manager..."
          className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-50 disabled:opacity-60"
        />
      </div>

      <BalancePreview
        leaveType={draft.type}
        startDate={draft.startDate}
        endDate={draft.endDate}
        balance={balance}
      />

      {balanceError && (
        <p className="rounded border border-yellow-200 bg-yellow-50 px-3 py-2 text-sm text-yellow-800">
          Balance unavailable — HCM is unreachable. You can still submit; the balance will be validated server-side.
        </p>
      )}

      {actionError && (
        <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {String(actionError)}
        </p>
      )}

      <div className="flex items-center gap-3">
        <Button
          type="submit"
          variant="primary"
          loading={isPending}
          disabled={!canSubmit}
        >
          {isPending ? 'Submitting...' : 'Submit request'}
        </Button>
        <Button
          type="button"
          variant="ghost"
          disabled={isPending}
          onClick={() => {
            resetDraft()
            router.push('/dashboard')
          }}
        >
          Cancel
        </Button>
      </div>
    </form>
  )
}
