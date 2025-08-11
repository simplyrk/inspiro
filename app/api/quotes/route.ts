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

      // Use database-level randomization for true randomness
      // This is much more efficient and ensures better distribution
      if (source === 'FAVORITES') {
        // For favorites, we already have the IDs, just shuffle them
        const userFavorites = await prisma.favorite.findMany({
          where: { userId: session.user.id },
          select: { quoteId: true }
        })
        const favoriteIds = userFavorites.map(f => f.quoteId)
        
        // Shuffle the favorite IDs
        for (let i = favoriteIds.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1))
          ;[favoriteIds[i], favoriteIds[j]] = [favoriteIds[j], favoriteIds[i]]
        }
        
        const selectedIds = favoriteIds.slice(0, Math.min(count, favoriteIds.length))
        quotes = await prisma.quote.findMany({
          where: { id: { in: selectedIds } },
          select: {
            id: true,
            text: true,
            author: true,
            category: true,
            source: true,
            isPreloaded: true,
            createdAt: true,
            updatedAt: true
          }
        })
      } else {
        // Use PostgreSQL's RANDOM() for true database-level randomization
        const whereConditions = []
        const params = []
        let paramIndex = 1
        
        if (source === 'PRELOADED') {
          whereConditions.push('"isPreloaded" = true')
        } else if (source === 'CUSTOM') {
          whereConditions.push('"userId" = $' + paramIndex + ' AND "isPreloaded" = false')
          params.push(session.user.id)
          paramIndex++
        } else {
          // BOTH
          whereConditions.push('("isPreloaded" = true OR ("userId" = $' + paramIndex + ' AND "isPreloaded" = false))')
          params.push(session.user.id)
          paramIndex++
        }
        
        if (category) {
          whereConditions.push('"category" = $' + paramIndex)
          params.push(category)
          paramIndex++
        }
        
        const whereClauseStr = whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : ''
        
        // Use raw query for better randomization
        const rawQuotes = await prisma.$queryRawUnsafe<Array<{
          id: string
          text: string
          author: string
          category: string | null
          source: string | null
          isPreloaded: boolean
          createdAt: Date
          updatedAt: Date
        }>>(`
          SELECT id, text, author, category, source, "isPreloaded", "createdAt", "updatedAt"
          FROM "Quote" 
          ${whereClauseStr}
          ORDER BY RANDOM()
          LIMIT $${paramIndex}
        `, ...params, count)
        
        quotes = rawQuotes
      }
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
    const quoteIds = (quotes as Array<{ id: string }>).map(q => q.id)
    const favorites = await prisma.favorite.findMany({
      where: {
        userId: session.user.id,
        quoteId: { in: quoteIds }
      },
      select: { quoteId: true }
    })

    const favoriteQuoteIds = new Set(favorites.map(f => f.quoteId))

    // Transform to include isFavorited flag
    const quotesWithFavorites = (quotes as Array<{ 
      id: string; 
      createdAt: Date; 
      updatedAt: Date; 
      [key: string]: unknown 
    }>).map(quote => ({
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
