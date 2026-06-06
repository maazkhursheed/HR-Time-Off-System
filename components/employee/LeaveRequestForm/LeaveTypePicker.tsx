'use client'

import type { LeaveType } from '@/types/leave'

interface LeaveTypePickerProps {
  value: LeaveType | null
  onChange: (type: LeaveType) => void
  disabled?: boolean
}

const LEAVE_TYPES: { value: LeaveType; label: string; description: string }[] = [
  { value: 'annual', label: 'Annual', description: 'Planned holiday or personal time' },
  { value: 'sick', label: 'Sick', description: 'Illness or medical appointment' },
  { value: 'unpaid', label: 'Unpaid', description: 'Unpaid leave of absence' },
  { value: 'compassionate', label: 'Compassionate', description: 'Bereavement or family emergency' },
]

export function LeaveTypePicker({ value, onChange, disabled }: LeaveTypePickerProps) {
  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-gray-700">
        Leave type <span className="text-red-500">*</span>
      </label>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {LEAVE_TYPES.map((lt) => (
          <button
            key={lt.value}
            type="button"
            disabled={disabled}
            onClick={() => onChange(lt.value)}
            className={`rounded border p-3 text-left transition-colors ${
              value === lt.value
                ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500'
                : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
            } ${disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
          >
            <span className="block text-sm font-medium text-gray-900">{lt.label}</span>
            <span className="mt-0.5 block text-xs text-gray-500">{lt.description}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
