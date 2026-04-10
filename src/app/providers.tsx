'use client'

import { ConvexReactClient } from "convex/react"
import { ConvexAuthProvider } from "@convex-dev/auth/react"
import { ReactNode } from "react"
import { ToastProvider } from "@/hooks/use-toast"

const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!)

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ConvexAuthProvider client={convex}>
      <ToastProvider>
        {children}
      </ToastProvider>
    </ConvexAuthProvider>
  )
}