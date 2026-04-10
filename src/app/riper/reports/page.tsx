'use client'

import { useConvexAuth, useQuery } from 'convex/react'
import { api } from '../../../../convex/_generated/api'
import { useRouter } from 'next/navigation'
import { Loader2, FileText } from 'lucide-react'
import Link from 'next/link'

export default function ReportsPage() {
  const router = useRouter()
  const { isLoading: authLoading, isAuthenticated } = useConvexAuth()
  const reports = useQuery(api.riper.missions.getReportsForUser, { limit: 50 })

  if (authLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
      </div>
    )
  }

  if (!isAuthenticated) {
    router.push('/')
    return null
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Reports</h1>

      {!reports ? (
        <div className="text-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-orange-500 mx-auto" />
        </div>
      ) : reports.length === 0 ? (
        <p className="text-center py-8 text-gray-400">
          No reports yet. Run a search on a mission to generate one.
        </p>
      ) : (
        <div className="space-y-2">
          {reports.map((report: any) => (
            <Link
              key={report._id}
              href={`/riper/reports/${report._id}`}
              className="border rounded-lg p-4 bg-white flex items-center gap-4 hover:border-orange-300 transition-colors block"
            >
              <FileText className="h-5 w-5 text-gray-400 flex-shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-gray-900">
                  {report.markdownContent.split('\n')[0]?.replace(/^#+\s*/, '').substring(0, 100) || 'Report'}
                </p>
                <div className="flex gap-4 text-xs text-gray-400 mt-1">
                  <span>{new Date(report.synthesizedAt).toLocaleString()}</span>
                  <span className="capitalize">{report.triggeredBy.replace('_', ' ')}</span>
                  <span>{report.itemsIncluded.length} source items</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
