'use client'

import { useState } from 'react'
import { useConvexAuth, useQuery, useMutation } from 'convex/react'
import { api } from '../../../../convex/_generated/api'
import { useRouter } from 'next/navigation'
import { Loader2, Plus, Archive, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import Link from 'next/link'

export default function MissionsPage() {
  const router = useRouter()
  const { isLoading: authLoading, isAuthenticated } = useConvexAuth()
  const missions = useQuery(api.riper.missions.listAll)
  const createMission = useMutation(api.riper.missions.create)
  const archiveMission = useMutation(api.riper.missions.archive)
  const websites = useQuery(api.websites.getUserWebsites)

  const [showCreate, setShowCreate] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [form, setForm] = useState({
    name: '',
    role: '',
    goal: '',
    topics: '',
    keywords: '',
    sourceTypes: '',
    decisionRules: '',
    selectedWebsiteIds: [] as string[],
  })

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

  const handleCreate = async () => {
    if (!form.name || !form.role || !form.goal) return
    setIsCreating(true)
    try {
      const missionId = await createMission({
        name: form.name,
        role: form.role,
        goal: form.goal,
        coverageMap: {
          topics: form.topics.split('\n').map((t) => t.trim()).filter(Boolean),
          keywords: form.keywords.split('\n').map((k) => k.trim()).filter(Boolean),
          sourceTypes: form.sourceTypes.split('\n').map((s) => s.trim()).filter(Boolean),
          outputSchema: {},
          decisionRules: form.decisionRules.split('\n').map((r) => r.trim()).filter(Boolean),
        },
        watchedWebsiteIds: form.selectedWebsiteIds as any[],
      })
      setShowCreate(false)
      setForm({ name: '', role: '', goal: '', topics: '', keywords: '', sourceTypes: '', decisionRules: '', selectedWebsiteIds: [] })
      router.push(`/riper/missions/${missionId}`)
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Missions</h1>
        <Button variant="orange" onClick={() => setShowCreate(!showCreate)} className="gap-1">
          <Plus className="h-4 w-4" />
          New Mission
        </Button>
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="border rounded-lg p-6 bg-white space-y-4">
          <h2 className="text-lg font-semibold">Create Mission</h2>

          <div>
            <Label>Name</Label>
            <Input
              placeholder="e.g. 共立電機"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="mt-1"
            />
          </div>

          <div>
            <Label>Role</Label>
            <Textarea
              placeholder="Describe the intelligence role..."
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
              className="mt-1"
              rows={2}
            />
          </div>

          <div>
            <Label>Goal</Label>
            <Textarea
              placeholder="Primary objective for this mission..."
              value={form.goal}
              onChange={(e) => setForm({ ...form, goal: e.target.value })}
              className="mt-1"
              rows={2}
            />
          </div>

          <div>
            <Label>Topics (one per line)</Label>
            <Textarea
              placeholder="Construction projects&#10;Distributor relationships&#10;Bid announcements"
              value={form.topics}
              onChange={(e) => setForm({ ...form, topics: e.target.value })}
              className="mt-1 font-mono text-sm"
              rows={4}
            />
          </div>

          <div>
            <Label>Keywords (one per line)</Label>
            <Textarea
              placeholder="電気設備工事&#10;配電盤&#10;キュービクル"
              value={form.keywords}
              onChange={(e) => setForm({ ...form, keywords: e.target.value })}
              className="mt-1 font-mono text-sm"
              rows={4}
            />
          </div>

          <div>
            <Label>Source Types (one per line)</Label>
            <Textarea
              placeholder="Government procurement portals&#10;Industry news&#10;Press releases"
              value={form.sourceTypes}
              onChange={(e) => setForm({ ...form, sourceTypes: e.target.value })}
              className="mt-1 font-mono text-sm"
              rows={3}
            />
          </div>

          <div>
            <Label>Decision Rules (one per line)</Label>
            <Textarea
              placeholder="Quality over quantity&#10;All results must have dates&#10;Cite all sources"
              value={form.decisionRules}
              onChange={(e) => setForm({ ...form, decisionRules: e.target.value })}
              className="mt-1 font-mono text-sm"
              rows={3}
            />
          </div>

          {/* Observer websites picker */}
          {websites && websites.length > 0 && (
            <div>
              <Label>Link Observer Websites</Label>
              <p className="text-xs text-gray-500 mb-2">
                Select websites to automatically feed intelligence from Observer diffs
              </p>
              <div className="border rounded-lg max-h-48 overflow-y-auto">
                {websites.map((site: any) => (
                  <label
                    key={site._id}
                    className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 cursor-pointer border-b last:border-b-0"
                  >
                    <input
                      type="checkbox"
                      checked={form.selectedWebsiteIds.includes(site._id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setForm({ ...form, selectedWebsiteIds: [...form.selectedWebsiteIds, site._id] })
                        } else {
                          setForm({ ...form, selectedWebsiteIds: form.selectedWebsiteIds.filter((id) => id !== site._id) })
                        }
                      }}
                      className="rounded border-gray-300"
                    />
                    <span className="text-sm truncate">{site.name}</span>
                    <span className="text-xs text-gray-400 ml-auto truncate">{site.url}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setShowCreate(false)}>
              Cancel
            </Button>
            <Button
              variant="orange"
              onClick={handleCreate}
              disabled={isCreating || !form.name || !form.role || !form.goal}
            >
              {isCreating ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Create Mission'}
            </Button>
          </div>
        </div>
      )}

      {/* Mission list */}
      {!missions ? (
        <div className="text-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-orange-500 mx-auto" />
        </div>
      ) : missions.length === 0 ? (
        <p className="text-gray-400 text-center py-8">No missions yet. Create one to get started.</p>
      ) : (
        <div className="space-y-2">
          {missions.map((mission: any) => (
            <Link
              key={mission._id}
              href={`/riper/missions/${mission._id}`}
              className="border rounded-lg p-4 bg-white flex items-center gap-4 hover:border-orange-300 transition-colors block"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-gray-900">{mission.name}</h3>
                  {!mission.isActive && (
                    <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded">Archived</span>
                  )}
                </div>
                <p className="text-sm text-gray-500 truncate mt-1">{mission.goal}</p>
                <div className="flex gap-4 text-xs text-gray-400 mt-2">
                  <span>{mission.watchedWebsiteIds.length} websites</span>
                  <span>{mission.coverageMap.topics.length} topics</span>
                  <span>{mission.coverageMap.keywords.length} keywords</span>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-gray-300 flex-shrink-0" />
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
