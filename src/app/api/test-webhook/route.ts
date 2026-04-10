import { NextRequest, NextResponse } from 'next/server'
import { ConvexHttpClient } from "convex/browser"
import { api } from "../../../../convex/_generated/api"

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!)

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const headers = Object.fromEntries(request.headers.entries())
    
    // Log the webhook payload
    console.log('🔔 Test Webhook Received:', {
      timestamp: new Date().toISOString(),
      headers: headers,
      body: body
    })

    // Store in database
    await convex.mutation(api.webhookPlayground.storeWebhookPayload, {
      payload: body,
      headers: headers,
      method: 'POST',
      url: request.url,
      status: 'success',
      response: {
        success: true,
        message: 'Webhook received successfully',
        receivedAt: new Date().toISOString(),
      }
    })

    // Return success response
    return NextResponse.json({
      success: true,
      message: 'Webhook received successfully',
      receivedAt: new Date().toISOString(),
      payload: body
    }, { status: 200 })
  } catch (error) {
    console.error('❌ Test Webhook Error:', error)
    
    // Try to store the error in database
    try {
      await convex.mutation(api.webhookPlayground.storeWebhookPayload, {
        payload: { error: error instanceof Error ? error.message : 'Unknown error' },
        headers: Object.fromEntries(request.headers.entries()),
        method: 'POST',
        url: request.url,
        status: 'error',
        response: {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      })
    } catch (dbError) {
      console.error('Failed to store error in database:', dbError)
    }

    return NextResponse.json({
      success: false,
      error: 'Failed to process webhook',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// Also handle GET requests for easy testing
export async function GET() {
  return NextResponse.json({
    message: 'Test webhook endpoint is working!',
    usage: 'Send a POST request to this endpoint with your webhook payload',
    examplePayload: {
      event: 'website_changed',
      website: {
        name: 'Example Site',
        url: 'https://example.com'
      },
      change: {
        detectedAt: new Date().toISOString(),
        changeType: 'content_modified'
      }
    }
  }, { status: 200 })
}