import { cn } from '@/lib/utils'

interface LayoutProps {
  children: React.ReactNode
  className?: string
}

export function Layout({ children, className }: LayoutProps) {
  return (
    <div className={cn("min-h-screen flex flex-col bg-zinc-50", className)}>
      {children}
    </div>
  )
}

interface MainContentProps {
  children: React.ReactNode
  className?: string
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '7xl' | 'full'
}

export function MainContent({ 
  children, 
  className,
  maxWidth = 'lg'
}: MainContentProps) {
  const maxWidthClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-4xl',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
    '7xl': 'max-w-7xl',
    full: 'max-w-full'
  }

  return (
    <main className={cn(
      "flex-1 px-4 sm:px-6 lg:px-8",
      className
    )}>
      <div className={cn(
        "mx-auto",
        maxWidthClasses[maxWidth]
      )}>
        {children}
      </div>
    </main>
  )
}

interface FooterProps {
  children?: React.ReactNode
  className?: string
}

export function Footer({ children, className }: FooterProps) {
  return (
    <footer className={cn(
      "px-4 sm:px-6 lg:px-8 py-8 mt-auto",
      className
    )}>
      <div className="max-w-7xl mx-auto">
        {children}
      </div>
    </footer>
  )
}