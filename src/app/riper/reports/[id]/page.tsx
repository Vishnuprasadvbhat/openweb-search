'use client'

import { useParams, useRouter } from 'next/navigation'
import { useConvexAuth, useQuery } from 'convex/react'
import { api } from '../../../../../convex/_generated/api'
import { Id } from '../../../../../convex/_generated/dataModel'
import { Loader2, ArrowLeft, Calendar, Zap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

export default function ReportDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { isLoading: authLoading, isAuthenticated } = useConvexAuth()

  const reportId = params.id as Id<"reports">
  const report = useQuery(api.riper.missions.getReport, { reportId })

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

  if (report === undefined) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-orange-500" />
      </div>
    )
  }

  if (report === null) {
    return <p className="text-center py-20 text-gray-500">Report not found.</p>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/riper/reports">
          <Button variant="outline" size="sm" className="gap-1">
            <ArrowLeft className="h-3 w-3" /> Back
          </Button>
        </Link>
        <div className="flex items-center gap-4 text-sm text-gray-400">
          <span className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            {new Date(report.synthesizedAt).toLocaleString()}
          </span>
          <span className="flex items-center gap-1">
            <Zap className="h-3 w-3" />
            {report.triggeredBy.replace('_', ' ')}
          </span>
          <span>{report.itemsIncluded.length} source items</span>
        </div>
      </div>

      <div className="border rounded-lg p-6 bg-white prose prose-sm max-w-none prose-headings:text-gray-900 prose-a:text-orange-600">
        <div
          dangerouslySetInnerHTML={{
            __html: markdownToHtml(report.markdownContent),
          }}
        />
      </div>
    </div>
  )
}

/**
 * Minimal markdown → HTML converter for report display.
 * Handles headings, bold, links, lists, paragraphs.
 */
function markdownToHtml(md: string): string {
  return md
    .split('\n')
    .map((line) => {
      // Headings
      if (line.startsWith('#### ')) return `<h4>${esc(line.slice(5))}</h4>`
      if (line.startsWith('### ')) return `<h3>${esc(line.slice(4))}</h3>`
      if (line.startsWith('## ')) return `<h2>${esc(line.slice(3))}</h2>`
      if (line.startsWith('# ')) return `<h1>${esc(line.slice(2))}</h1>`
      // List items
      if (line.startsWith('- ')) return `<li>${inlineFormat(line.slice(2))}</li>`
      if (/^\d+\.\s/.test(line)) return `<li>${inlineFormat(line.replace(/^\d+\.\s/, ''))}</li>`
      // Horizontal rule
      if (line.trim() === '---') return '<hr />'
      // Empty line
      if (line.trim() === '') return '<br />'
      // Paragraph
      return `<p>${inlineFormat(line)}</p>`
    })
    .join('\n')
}

function inlineFormat(text: string): string {
  return esc(text)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\[(.+?)\]\((https?:\/\/.+?)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
    .replace(/`(.+?)`/g, '<code>$1</code>')
}

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}
