'use client'

import { useState } from 'react'
import { useConvexAuth, useQuery } from 'convex/react'
import { api } from '../../../../convex/_generated/api'
import { useRouter } from 'next/navigation'
import { Loader2, ExternalLink, Filter } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Id } from '../../../../convex/_generated/dataModel'

export default function IntelligencePage() {
  const router = useRouter()
  const { isLoading: authLoading, isAuthenticated } = useConvexAuth()
  const missions = useQuery(api.riper.missions.list)

  const [selectedMission, setSelectedMission] = useState<string>('')
  const [confidenceFilter, setConfidenceFilter] = useState<string>('')
  const [statusFilter, setStatusFilter] = useState<string>('active')

  // Build query args based on filters
  const queryArgs = selectedMission
    ? {
        missionId: selectedMission as Id<"missions">,
        limit: 100,
        ...(confidenceFilter ? { confidence: confidenceFilter as any } : {}),
        ...(statusFilter ? { status: statusFilter as any } : {}),
      }
    : null

  const items = useQuery(
    selectedMission
      ? api.riper.intelligence.getRecent
      : api.riper.intelligence.getRecentForUser,
    selectedMission ? queryArgs! : { limit: 100 }
  )

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

  // For the user-level query, apply filters in-memory
  const filteredItems = selectedMission
    ? items
    : items?.filter((item: any) => {
        if (confidenceFilter && item.confidence !== confidenceFilter) return false
        if (statusFilter && item.status !== statusFilter) return false
        return true
      })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Intelligence Feed</h1>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-gray-400" />
          <span className="text-sm text-gray-500">
            {filteredItems?.length ?? 0} items
          </span>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 p-4 border rounded-lg bg-white">
        <div>
          <label className="text-xs text-gray-500 block mb-1">Mission</label>
          <select
            value={selectedMission}
            onChange={(e) => setSelectedMission(e.target.value)}
            className="text-sm border rounded px-2 py-1.5 bg-white"
          >
            <option value="">All missions</option>
            {missions?.map((m) => (
              <option key={m._id} value={m._id}>{(m as any).name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs text-gray-500 block mb-1">Confidence</label>
          <select
            value={confidenceFilter}
            onChange={(e) => setConfidenceFilter(e.target.value)}
            className="text-sm border rounded px-2 py-1.5 bg-white"
          >
            <option value="">All</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>
        <div>
          <label className="text-xs text-gray-500 block mb-1">Status</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-sm border rounded px-2 py-1.5 bg-white"
          >
            <option value="">All</option>
            <option value="active">Active</option>
            <option value="superseded">Superseded</option>
            <option value="excluded">Excluded</option>
          </select>
        </div>
      </div>

      {/* Items */}
      {!filteredItems ? (
        <div className="text-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-orange-500 mx-auto" />
        </div>
      ) : filteredItems.length === 0 ? (
        <p className="text-center py-8 text-gray-400">No intelligence items match your filters.</p>
      ) : (
        <div className="space-y-2">
          {filteredItems.map((item: any) => (
            <div
              key={item._id}
              className="border rounded-lg p-4 bg-white"
            >
              <div className="flex items-start gap-3">
                <span
                  className={`mt-1 w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                    item.confidence === 'high'
                      ? 'bg-green-500'
                      : item.confidence === 'medium'
                      ? 'bg-yellow-500'
                      : 'bg-gray-300'
                  }`}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-gray-900">{item.extractedFact}</p>
                  <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-gray-400">
                    {item.sourceUrl && !item.sourceUrl.startsWith('web_search:') ? (
                      <a
                        href={item.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-orange-600 hover:underline flex items-center gap-1"
                      >
                        <ExternalLink className="h-3 w-3" />
                        {(() => { try { return new URL(item.sourceUrl).hostname } catch { return item.sourceUrl } })()}
                      </a>
                    ) : (
                      <span>{item.sourceUrl}</span>
                    )}
                    {item.sourcePublishedAt && (
                      <span>Published: {new Date(item.sourcePublishedAt).toLocaleDateString()}</span>
                    )}
                    <span>Extracted: {new Date(item.extractedAt).toLocaleDateString()}</span>
                    {item.supersededBy && (
                      <span className="text-yellow-600">Superseded</span>
                    )}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                  <span
                    className={`text-xs px-2 py-0.5 rounded font-medium ${
                      item.confidence === 'high'
                        ? 'bg-green-50 text-green-700'
                        : item.confidence === 'medium'
                        ? 'bg-yellow-50 text-yellow-700'
                        : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    {item.confidence}
                  </span>
                  <span
                    className={`text-xs px-2 py-0.5 rounded ${
                      item.status === 'active'
                        ? 'bg-green-50 text-green-600'
                        : item.status === 'superseded'
                        ? 'bg-yellow-50 text-yellow-600'
                        : 'bg-gray-100 text-gray-400'
                    }`}
                  >
                    {item.status}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
