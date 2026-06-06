'use client'

interface DateRangePickerProps {
  startDate: string
  endDate: string
  onStartChange: (date: string) => void
  onEndChange: (date: string) => void
  disabled?: boolean
  minDate?: string
}

export function DateRangePicker({
  startDate,
  endDate,
  onStartChange,
  onEndChange,
  disabled,
  minDate,
}: DateRangePickerProps) {
  const today = minDate ?? new Date().toISOString().split('T')[0]

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div>
        <label htmlFor="start-date" className="mb-1.5 block text-sm font-medium text-gray-700">
          Start date <span className="text-red-500">*</span>
        </label>
        <input
          id="start-date"
          type="date"
          value={startDate}
          min={today}
          onChange={(e) => onStartChange(e.target.value)}
          disabled={disabled}
          className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-50 disabled:opacity-60"
        />
      </div>
      <div>
        <label htmlFor="end-date" className="mb-1.5 block text-sm font-medium text-gray-700">
          End date <span className="text-red-500">*</span>
        </label>
        <input
          id="end-date"
          type="date"
          value={endDate}
          min={startDate || today}
          onChange={(e) => onEndChange(e.target.value)}
          disabled={disabled}
          className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-50 disabled:opacity-60"
        />
      </div>
    </div>
  )
}
