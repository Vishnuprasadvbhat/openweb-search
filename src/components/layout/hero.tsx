'use client'

import { cn } from '@/lib/utils'

interface HeroProps {
  title: string | React.ReactNode
  subtitle?: string
  className?: string
}

export function Hero({ title, subtitle, className }: HeroProps) {
  return (
    <div className={cn("px-4 sm:px-6 lg:px-8 pt-8 pb-6", className)}>
      <div className="max-w-4xl mx-auto text-center animate-slide-up">
        <h1 className="text-[2.5rem] lg:text-[3.8rem] font-semibold tracking-tight">
          {typeof title === 'string' ? (
            <span className="bg-gradient-to-tr from-red-600 to-yellow-500 bg-clip-text text-transparent">
              {title}
            </span>
          ) : (
            title
          )}
        </h1>
        
        {subtitle && (
          <p className="mt-4 text-lg text-zinc-600 dark:text-zinc-400">
            {subtitle}
          </p>
        )}
      </div>
    </div>
  )
}