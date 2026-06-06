import { setDemoSession } from '@/lib/actions/setDemoSession'

export default function HomePage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 p-8">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">HR Time-Off System</h1>
          <p className="mt-2 text-sm text-gray-500">
            Select a role to enter the demo
          </p>
        </div>

        <div className="grid gap-4">
          <form action={setDemoSession.bind(null, 'employee')}>
            <button
              type="submit"
              className="w-full rounded-lg border-2 border-blue-200 bg-white px-6 py-5 text-left shadow-sm transition hover:border-blue-400 hover:shadow-md"
            >
              <p className="text-base font-semibold text-gray-900">Employee View</p>
              <p className="mt-1 text-sm text-gray-500">
                Alice Chen · New York, US
              </p>
              <p className="mt-1 text-xs text-gray-400">
                View balances · Submit requests · Track history
              </p>
            </button>
          </form>

          <form action={setDemoSession.bind(null, 'manager')}>
            <button
              type="submit"
              className="w-full rounded-lg border-2 border-purple-200 bg-white px-6 py-5 text-left shadow-sm transition hover:border-purple-400 hover:shadow-md"
            >
              <p className="text-base font-semibold text-gray-900">Manager View</p>
              <p className="mt-1 text-sm text-gray-500">
                Bob Smith · New York, US
              </p>
              <p className="mt-1 text-xs text-gray-400">
                Review requests · Approve / reject · Monitor team balances
              </p>
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-gray-400">
          Mock HCM backend · Live API · React Query caching
        </p>
      </div>
    </main>
  )
}
