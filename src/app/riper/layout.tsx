'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Layout, Footer } from '@/components/layout/layout'
import { Header } from '@/components/layout/header'
import { cn } from '@/lib/utils'

const riperNav = [
  { label: 'Dashboard', href: '/riper' },
  { label: 'Missions', href: '/riper/missions' },
  { label: 'Intelligence', href: '/riper/intelligence' },
  { label: 'Reports', href: '/riper/reports' },
]

export default function RiperLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  return (
    <Layout>
      <Header />
      {/* RIPER sub-nav */}
      <div className="border-b border-zinc-200 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex gap-6 -mb-px">
            {riperNav.map((item) => {
              const isActive =
                item.href === '/riper'
                  ? pathname === '/riper'
                  : pathname.startsWith(item.href)

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'py-3 text-sm font-medium border-b-2 transition-colors',
                    isActive
                      ? 'border-orange-500 text-orange-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  )}
                >
                  {item.label}
                </Link>
              )
            })}
          </nav>
        </div>
      </div>
      <main className="flex-1 px-4 sm:px-6 lg:px-8 py-8">
        <div className="max-w-7xl mx-auto">{children}</div>
      </main>
      <Footer />
    </Layout>
  )
}
