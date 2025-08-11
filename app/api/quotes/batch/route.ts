import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getQuotesByIds } from '@/lib/quote-service'
import { z } from 'zod'

const batchSchema = z.object({
  ids: z.array(z.string()).min(1).max(50) // Limit batch size
})

// POST /api/quotes/batch - Get specific quotes by IDs
export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { ids } = batchSchema.parse(body)
    
    const quotes = await getQuotesByIds(ids, session.user.id)
    
    return NextResponse.json({ quotes })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request', details: error.errors },
        { status: 400 }
      )
    }
    
    console.error('Get quotes batch error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}