'use client'

import { useConvexAuth, useQuery, useAction } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import { useRouter } from 'next/navigation'
import { Loader2, Radar, Play, FileText, TrendingUp, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { useState } from 'react'

export default function RiperDashboard() {
  const router = useRouter()
  const { isLoading: authLoading, isAuthenticated } = useConvexAuth()
  const missions = useQuery(api.riper.missions.list)
  const recentItems = useQuery(api.riper.intelligence.getRecentForUser, { limit: 10 })
  const recentReports = useQuery(api.riper.missions.getReportsForUser, { limit: 5 })

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
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Radar className="h-6 w-6 text-orange-500" />
            RIPER Dashboard
          </h1>
          <p className="text-gray-500 mt-1">Research Intelligence Pipeline</p>
        </div>
        <Link href="/riper/missions">
          <Button variant="orange">New Mission</Button>
        </Link>
      </div>

      {/* Active Missions */}
      <section>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Active Missions</h2>
        {!missions ? (
          <div className="text-center py-8 text-gray-400">
            <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />
            Loading missions...
          </div>
        ) : missions.length === 0 ? (
          <div className="border rounded-lg p-8 text-center bg-white">
            <AlertCircle className="h-8 w-8 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No active missions yet.</p>
            <Link href="/riper/missions">
              <Button variant="orange" size="sm" className="mt-4">
                Create your first mission
              </Button>
            </Link>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {missions.map((mission: any) => (
              <MissionCard key={mission._id} mission={mission} />
            ))}
          </div>
        )}
      </section>

      {/* Recent Intelligence */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Recent Intelligence</h2>
          <Link href="/riper/intelligence" className="text-sm text-orange-600 hover:underline">
            View all
          </Link>
        </div>
        {!recentItems ? (
          <div className="text-center py-4 text-gray-400">
            <Loader2 className="h-5 w-5 animate-spin mx-auto" />
          </div>
        ) : recentItems.length === 0 ? (
          <p className="text-gray-400 text-sm">No intelligence items yet. Run a search or link Observer websites to a mission.</p>
        ) : (
          <div className="space-y-2">
            {recentItems.map((item: any) => (
              <div
                key={item._id}
                className="border rounded-lg p-3 bg-white flex items-start gap-3"
              >
                <span
                  className={`inline-block mt-1 w-2 h-2 rounded-full flex-shrink-0 ${
                    item.confidence === 'high'
                      ? 'bg-green-500'
                      : item.confidence === 'medium'
                      ? 'bg-yellow-500'
                      : 'bg-gray-300'
                  }`}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-gray-900 truncate">{item.extractedFact}</p>
                  <p className="text-xs text-gray-400 mt-1">
                    {item.sourceUrl && !item.sourceUrl.startsWith('web_search:') ? (
                      <a
                        href={item.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-orange-600 hover:underline"
                      >
                        {new URL(item.sourceUrl).hostname}
                      </a>
                    ) : (
                      <span>{item.sourceUrl}</span>
                    )}
                    {' · '}
                    {new Date(item.extractedAt).toLocaleDateString()}
                  </p>
                </div>
                <span
                  className={`text-xs px-2 py-0.5 rounded font-medium ${
                    item.status === 'active'
                      ? 'bg-green-50 text-green-700'
                      : item.status === 'superseded'
                      ? 'bg-yellow-50 text-yellow-700'
                      : 'bg-gray-100 text-gray-500'
                  }`}
                >
                  {item.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Recent Reports */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Recent Reports</h2>
          <Link href="/riper/reports" className="text-sm text-orange-600 hover:underline">
            View all
          </Link>
        </div>
        {!recentReports ? (
          <div className="text-center py-4 text-gray-400">
            <Loader2 className="h-5 w-5 animate-spin mx-auto" />
          </div>
        ) : recentReports.length === 0 ? (
          <p className="text-gray-400 text-sm">No reports generated yet.</p>
        ) : (
          <div className="space-y-2">
            {recentReports.map((report: any) => (
              <Link
                key={report._id}
                href={`/riper/reports/${report._id}`}
                className="border rounded-lg p-3 bg-white flex items-center gap-3 hover:border-orange-300 transition-colors block"
              >
                <FileText className="h-4 w-4 text-gray-400 flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-gray-900">
                    {(report as any).markdownContent.split('\n')[0]?.replace(/^#+\s*/, '').substring(0, 80) || 'Report'}
                  </p>
                  <p className="text-xs text-gray-400">
                    {new Date((report as any).synthesizedAt).toLocaleString()} · {(report as any).triggeredBy} · {(report as any).itemsIncluded.length} items
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

function MissionCard({ mission }: { mission: any }) {
  const triggerSearch = useAction(api.riper.missions.triggerSearch)
  const [isSearching, setIsSearching] = useState(false)

  const handleSearch = async () => {
    setIsSearching(true)
    try {
      await triggerSearch({ missionId: mission._id })
    } finally {
      setTimeout(() => setIsSearching(false), 3000)
    }
  }

  return (
    <div className="border rounded-lg p-4 bg-white hover:border-orange-300 transition-colors">
      <div className="flex items-start justify-between">
        <Link href={`/riper/missions/${mission._id}`} className="min-w-0 flex-1">
          <h3 className="font-semibold text-gray-900 truncate">{mission.name}</h3>
          <p className="text-sm text-gray-500 mt-1 line-clamp-2">{mission.goal}</p>
        </Link>
      </div>
      <div className="flex items-center gap-2 mt-3">
        <span className="text-xs text-gray-400">
          {mission.watchedWebsiteIds.length} websites · {mission.coverageMap.topics.length} topics
        </span>
        <div className="ml-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={handleSearch}
            disabled={isSearching}
            className="gap-1"
          >
            {isSearching ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Play className="h-3 w-3" />
            )}
            Search
          </Button>
        </div>
      </div>
    </div>
  )
}
