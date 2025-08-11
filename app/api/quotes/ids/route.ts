import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getQuoteIds } from '@/lib/quote-service'

// GET /api/quotes/ids - Get all available quote IDs (lightweight)
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const source = request.nextUrl.searchParams.get('source') || 'BOTH'
    const category = request.nextUrl.searchParams.get('category') || undefined
    
    const quoteIds = await getQuoteIds({
      source: source as 'PRELOADED' | 'CUSTOM' | 'FAVORITES' | 'BOTH',
      userId: session.user.id,
      category
    })
    
    return NextResponse.json({ 
      ids: quoteIds,
      total: quoteIds.length 
    })
  } catch (error) {
    console.error('Get quote IDs error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}