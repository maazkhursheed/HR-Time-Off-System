'use client'

import { useState } from 'react'
import { Modal } from '@/components/ui/Modal/Modal'
import type { LeaveBalance } from '@/types/leave'

interface EmployeeBalanceRowProps {
  employee: { id: string; name: string }
  balance?: LeaveBalance
}

export function EmployeeBalanceRow({ employee, balance }: EmployeeBalanceRowProps) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <tr
        className="cursor-pointer hover:bg-gray-50"
        onClick={() => setOpen(true)}
      >
        <td className="px-4 py-2 font-medium text-gray-900">{employee.name}</td>
        <td className="px-4 py-2 tabular-nums">{balance?.annual ?? '—'}</td>
        <td className="px-4 py-2 tabular-nums">{balance?.sick ?? '—'}</td>
      </tr>

      <Modal open={open} onClose={() => setOpen(false)} title={`${employee.name} — Balance Detail`}>
        {balance ? (
          <dl className="space-y-2 text-sm">
            {(['annual', 'sick', 'unpaid', 'compassionate'] as const).map((type) => (
              <div key={type} className="flex justify-between">
                <dt className="capitalize text-gray-600">{type}</dt>
                <dd className="font-medium tabular-nums">{balance[type]} days</dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="text-sm text-gray-500">Balance unavailable.</p>
        )}
      </Modal>
    </>
  )
}
