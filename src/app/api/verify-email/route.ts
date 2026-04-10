import { NextRequest, NextResponse } from 'next/server'
import { ConvexHttpClient } from "convex/browser"
import { api } from "../../../../convex/_generated/api"

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!)

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const token = searchParams.get('token')

  if (!token) {
    return NextResponse.redirect(new URL('/settings?error=missing-token', request.url))
  }

  try {
    const result = await convex.mutation(api.emailManager.verifyEmail, { token })
    
    if (!result || !result.success) {
      console.error('Email verification failed:', result)
      return NextResponse.redirect(new URL('/settings?section=notifications&error=verification-failed', request.url))
    }
    
    // Successfully verified
    return NextResponse.redirect(new URL('/settings?section=notifications&verified=true', request.url))
  } catch (error) {
    console.error('Email verification error:', error)
    
    // More specific error handling
    const errorMessage = error instanceof Error ? error.message : ''
    if (errorMessage.includes('expired')) {
      return NextResponse.redirect(new URL('/settings?section=notifications&error=token-expired', request.url))
    } else if (errorMessage.includes('Invalid')) {
      return NextResponse.redirect(new URL('/settings?section=notifications&error=invalid-token', request.url))
    }
    
    // Generic error
    return NextResponse.redirect(new URL('/settings?section=notifications&error=verification-error', request.url))
  }
}