import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const createQuoteSchema = z.object({
  text: z.string().min(1).max(1000),
  author: z.string().min(1).max(100),
  category: z.string().optional(),
  source: z.string().optional(),
})

// GET /api/quotes - Get random quotes based on user preferences
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const isRandom = request.nextUrl.searchParams.get('random') === 'true'
    const count = parseInt(request.nextUrl.searchParams.get('count') || '10') // Default to 10 for prefetching

    // Get user preferences
    const preferences = await prisma.userPreferences.findUnique({
      where: { userId: session.user.id },
      select: { quoteSource: true }
    })

    const source = request.nextUrl.searchParams.get('source') || preferences?.quoteSource || 'BOTH'
    const category = request.nextUrl.searchParams.get('category')

    const whereClause: Record<string, unknown> = {}
    
    // Handle different quote source preferences
    if (source === 'PRELOADED') {
      whereClause.isPreloaded = true
    } else if (source === 'CUSTOM') {
      whereClause.userId = session.user.id
      whereClause.isPreloaded = false
    } else if (source === 'FAVORITES') {
      // Get user's favorite quotes
      const userFavorites = await prisma.favorite.findMany({
        where: { userId: session.user.id },
        select: { quoteId: true }
      })
      const favoriteIds = userFavorites.map(f => f.quoteId)
      
      if (favoriteIds.length === 0) {
        return NextResponse.json({ quotes: [], total: 0 })
      }
      
      whereClause.id = { in: favoriteIds }
    } else {
      // BOTH - get preloaded quotes OR user's custom quotes
      whereClause.OR = [
        { isPreloaded: true },
        { userId: session.user.id, isPreloaded: false }
      ]
    }

    // Add category filter if provided
    if (category) {
      whereClause.category = category
    }

    let quotes
    let totalCount

    if (isRandom) {
      // Get total count first
      totalCount = await prisma.quote.count({ where: whereClause })
      
      if (totalCount === 0) {
        return NextResponse.json({ quotes: [], total: 0 })
      }

      // Use proper randomization: get random offsets and fetch individual quotes
      const randomOffsets = new Set<number>()
      
      // Generate unique random offsets
      while (randomOffsets.size < Math.min(count, totalCount)) {
        randomOffsets.add(Math.floor(Math.random() * totalCount))
      }

      // Fetch quotes at random positions using multiple queries
      // This ensures true randomness across the entire dataset
      const randomQuotePromises = Array.from(randomOffsets).map(offset => 
        prisma.quote.findMany({
          where: whereClause,
          select: {
            id: true,
            text: true,
            author: true,
            category: true,
            source: true,
            isPreloaded: true,
            createdAt: true,
            updatedAt: true
          },
          skip: offset,
          take: 1,
        })
      )

      const randomQuoteArrays = await Promise.all(randomQuotePromises)
      quotes = randomQuoteArrays.flat() // Flatten the arrays
    } else {
      // Regular fetch with pagination (fallback)
      const page = parseInt(request.nextUrl.searchParams.get('page') || '1')
      const limit = Math.min(parseInt(request.nextUrl.searchParams.get('limit') || '10'), 100)
      const skip = (page - 1) * limit

      ;[quotes, totalCount] = await Promise.all([
        prisma.quote.findMany({
          where: whereClause,
          select: {
            id: true,
            text: true,
            author: true,
            category: true,
            source: true,
            isPreloaded: true,
            createdAt: true,
            updatedAt: true
          },
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit,
        }),
        prisma.quote.count({ where: whereClause })
      ])
    }

    // Get favorites for this user for the fetched quotes
    const quoteIds = quotes.map((q: { id: string }) => q.id)
    const favorites = await prisma.favorite.findMany({
      where: {
        userId: session.user.id,
        quoteId: { in: quoteIds }
      },
      select: { quoteId: true }
    })

    const favoriteQuoteIds = new Set(favorites.map(f => f.quoteId))

    // Transform to include isFavorited flag
    const quotesWithFavorites = quotes.map((quote: { id: string; createdAt: Date; updatedAt: Date; [key: string]: unknown }) => ({
      ...quote,
      createdAt: quote.createdAt.toISOString(),
      updatedAt: quote.updatedAt.toISOString(),
      isFavorited: favoriteQuoteIds.has(quote.id)
    }))

    return NextResponse.json({
      quotes: quotesWithFavorites,
      total: totalCount
    })
  } catch (error) {
    console.error('Get quotes error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST /api/quotes - Create a custom quote
export async function POST(request: Request) {
  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { text, author, category, source } = createQuoteSchema.parse(body)

    const quote = await prisma.quote.create({
      data: {
        text,
        author,
        category,
        source,
        userId: session.user.id,
        isPreloaded: false,
      },
    })

    return NextResponse.json(quote, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid data', details: error.errors },
        { status: 400 }
      )
    }
    
    console.error('Create quote error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
