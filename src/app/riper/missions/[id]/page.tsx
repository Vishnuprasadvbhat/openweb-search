'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useConvexAuth, useQuery, useMutation, useAction } from 'convex/react'
import { api } from '../../../../../convex/_generated/api'
import { Id } from '../../../../../convex/_generated/dataModel'
import { Loader2, Play, FileText, ArrowLeft, Save, Link2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import Link from 'next/link'

export default function MissionDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { isLoading: authLoading, isAuthenticated } = useConvexAuth()

  const missionId = params.id as Id<"missions">
  const mission = useQuery(api.riper.missions.getById, { missionId })
  const reports = useQuery(api.riper.missions.getReports, { missionId })
  const coverage = useQuery(api.riper.intelligence.getCoverageGaps, { missionId })
  const activeCount = useQuery(api.riper.intelligence.getActiveCount, { missionId })
  const websites = useQuery(api.websites.getUserWebsites)

  const updateMission = useMutation(api.riper.missions.update)
  const linkWebsites = useMutation(api.riper.missions.linkWebsites)
  const archiveMission = useMutation(api.riper.missions.archive)
  const triggerSearch = useAction(api.riper.missions.triggerSearch)
  const triggerSynthesis = useAction(api.riper.missions.triggerSynthesis)

  const [isSearching, setIsSearching] = useState(false)
  const [isSynthesizing, setIsSynthesizing] = useState(false)
  const [showWebsitePicker, setShowWebsitePicker] = useState(false)
  const [selectedWebsiteIds, setSelectedWebsiteIds] = useState<string[]>([])
  const [websitePickerInit, setWebsitePickerInit] = useState(false)

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

  if (mission === undefined) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-orange-500" />
      </div>
    )
  }

  if (mission === null) {
    return <p className="text-center py-20 text-gray-500">Mission not found.</p>
  }

  // Initialize the website picker selection from mission data
  if (!websitePickerInit && mission) {
    setSelectedWebsiteIds(mission.watchedWebsiteIds as string[])
    setWebsitePickerInit(true)
  }

  const handleSearch = async () => {
    setIsSearching(true)
    try {
      await triggerSearch({ missionId })
    } finally {
      setTimeout(() => setIsSearching(false), 3000)
    }
  }

  const handleSynthesis = async () => {
    setIsSynthesizing(true)
    try {
      await triggerSynthesis({ missionId })
    } finally {
      setTimeout(() => setIsSynthesizing(false), 3000)
    }
  }

  const handleSaveWebsites = async () => {
    await linkWebsites({ missionId, websiteIds: selectedWebsiteIds as any[] })
    setShowWebsitePicker(false)
  }

  return (
    <div className="space-y-6">
      {/* Back + header */}
      <div className="flex items-center gap-4">
        <Link href="/riper/missions">
          <Button variant="outline" size="sm" className="gap-1">
            <ArrowLeft className="h-3 w-3" /> Back
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">{mission.name}</h1>
          <p className="text-gray-500 text-sm mt-1">{mission.goal}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleSynthesis} disabled={isSynthesizing} className="gap-1">
            {isSynthesizing ? <Loader2 className="h-3 w-3 animate-spin" /> : <FileText className="h-3 w-3" />}
            Synthesize Report
          </Button>
          <Button variant="orange" size="sm" onClick={handleSearch} disabled={isSearching} className="gap-1">
            {isSearching ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
            Run Search
          </Button>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="border rounded-lg p-4 bg-white">
          <p className="text-sm text-gray-500">Active Items</p>
          <p className="text-2xl font-bold text-gray-900">{activeCount ?? '—'}</p>
        </div>
        <div className="border rounded-lg p-4 bg-white">
          <p className="text-sm text-gray-500">Topics Covered</p>
          <p className="text-2xl font-bold text-green-600">{coverage?.covered.length ?? '—'}</p>
        </div>
        <div className="border rounded-lg p-4 bg-white">
          <p className="text-sm text-gray-500">Coverage Gaps</p>
          <p className="text-2xl font-bold text-orange-600">{coverage?.gaps.length ?? '—'}</p>
        </div>
        <div className="border rounded-lg p-4 bg-white">
          <p className="text-sm text-gray-500">Linked Websites</p>
          <p className="text-2xl font-bold text-gray-900">{mission.watchedWebsiteIds.length}</p>
        </div>
      </div>

      {/* Coverage gaps */}
      {coverage && coverage.gaps.length > 0 && (
        <section className="border rounded-lg p-4 bg-white">
          <h3 className="font-semibold text-gray-900 mb-2">Coverage Gaps</h3>
          <div className="flex flex-wrap gap-2">
            {coverage.gaps.map((gap: string) => (
              <span key={gap} className="text-xs bg-orange-50 text-orange-700 px-2 py-1 rounded">
                {gap}
              </span>
            ))}
          </div>
        </section>
      )}

      {/* Linked websites */}
      <section className="border rounded-lg p-4 bg-white">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-gray-900">Linked Observer Websites</h3>
          <Button variant="outline" size="sm" onClick={() => setShowWebsitePicker(!showWebsitePicker)} className="gap-1">
            <Link2 className="h-3 w-3" /> Edit
          </Button>
        </div>
        {showWebsitePicker && websites ? (
          <div className="space-y-2">
            <div className="border rounded-lg max-h-48 overflow-y-auto">
              {websites.map((site: any) => (
                <label
                  key={site._id}
                  className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 cursor-pointer border-b last:border-b-0"
                >
                  <input
                    type="checkbox"
                    checked={selectedWebsiteIds.includes(site._id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedWebsiteIds([...selectedWebsiteIds, site._id])
                      } else {
                        setSelectedWebsiteIds(selectedWebsiteIds.filter((id) => id !== site._id))
                      }
                    }}
                    className="rounded border-gray-300"
                  />
                  <span className="text-sm truncate">{site.name}</span>
                  <span className="text-xs text-gray-400 ml-auto truncate">{site.url}</span>
                </label>
              ))}
            </div>
            <div className="flex justify-end">
              <Button variant="orange" size="sm" onClick={handleSaveWebsites} className="gap-1">
                <Save className="h-3 w-3" /> Save
              </Button>
            </div>
          </div>
        ) : mission.watchedWebsiteIds.length === 0 ? (
          <p className="text-sm text-gray-400">No websites linked. Click Edit to connect Observer websites.</p>
        ) : (
          <p className="text-sm text-gray-500">{mission.watchedWebsiteIds.length} website(s) linked</p>
        )}
      </section>

      {/* Mission details */}
      <section className="border rounded-lg p-4 bg-white space-y-3">
        <h3 className="font-semibold text-gray-900">Mission Details</h3>
        <div>
          <p className="text-xs text-gray-400 uppercase tracking-wide">Role</p>
          <p className="text-sm text-gray-700 whitespace-pre-wrap">{mission.role}</p>
        </div>
        <div>
          <p className="text-xs text-gray-400 uppercase tracking-wide">Keywords</p>
          <div className="flex flex-wrap gap-1 mt-1">
            {mission.coverageMap.keywords.map((kw: string) => (
              <span key={kw} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">{kw}</span>
            ))}
          </div>
        </div>
        <div>
          <p className="text-xs text-gray-400 uppercase tracking-wide">Decision Rules</p>
          <ul className="list-disc list-inside text-sm text-gray-700 mt-1">
            {mission.coverageMap.decisionRules.map((rule: string, i: number) => (
              <li key={i}>{rule}</li>
            ))}
          </ul>
        </div>
      </section>

      {/* Reports */}
      <section>
        <h3 className="font-semibold text-gray-900 mb-3">Reports</h3>
        {!reports ? (
          <Loader2 className="h-5 w-5 animate-spin text-gray-300" />
        ) : reports.length === 0 ? (
          <p className="text-sm text-gray-400">No reports yet. Run a search or synthesize manually.</p>
        ) : (
          <div className="space-y-2">
            {reports.map((report: any) => (
              <Link
                key={report._id}
                href={`/riper/reports/${report._id}`}
                className="border rounded-lg p-3 bg-white flex items-center gap-3 hover:border-orange-300 transition-colors block"
              >
                <FileText className="h-4 w-4 text-gray-400 flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-gray-900">
                    {report.markdownContent.split('\n')[0]?.replace(/^#+\s*/, '').substring(0, 80) || 'Report'}
                  </p>
                  <p className="text-xs text-gray-400">
                    {new Date(report.synthesizedAt).toLocaleString()} · {report.triggeredBy} · {report.itemsIncluded.length} items
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Archive button */}
      {mission.isActive && (
        <div className="border-t pt-4">
          <Button
            variant="outline"
            size="sm"
            className="text-red-600 hover:text-red-700"
            onClick={async () => {
              await archiveMission({ missionId })
              router.push('/riper/missions')
            }}
          >
            Archive Mission
          </Button>
        </div>
      )}
    </div>
  )
}
