/**
 * Quote Service - Optimized random quote delivery
 * 
 * Strategy:
 * 1. Load all quote IDs once per session
 * 2. Shuffle IDs client-side using Fisher-Yates
 * 3. Fetch quotes in batches by specific IDs
 * 4. Minimal DB queries, perfect randomization
 */

import { prisma } from '@/lib/prisma'


interface QuoteServiceOptions {
  source: 'PRELOADED' | 'CUSTOM' | 'FAVORITES' | 'BOTH'
  userId: string
  category?: string
}

// Server-side: Get all available quote IDs (lightweight query)
export async function getQuoteIds(options: QuoteServiceOptions): Promise<string[]> {
  const { source, userId, category } = options
  
  const whereClause: Record<string, unknown> = {}
  
  // Build where clause based on source preference
  switch (source) {
    case 'PRELOADED':
      whereClause.isPreloaded = true
      break
    case 'CUSTOM':
      whereClause.userId = userId
      whereClause.isPreloaded = false
      break
    case 'FAVORITES':
      const favorites = await prisma.favorite.findMany({
        where: { userId },
        select: { quoteId: true }
      })
      return favorites.map(f => f.quoteId)
    case 'BOTH':
    default:
      whereClause.OR = [
        { isPreloaded: true },
        { userId, isPreloaded: false }
      ]
  }
  
  if (category) {
    whereClause.category = category
  }
  
  // Fetch only IDs - very lightweight
  const quotes = await prisma.quote.findMany({
    where: whereClause,
    select: { id: true }
  })
  
  return quotes.map(q => q.id)
}

// Server-side: Fetch specific quotes by IDs
export async function getQuotesByIds(ids: string[], userId: string) {
  const quotes = await prisma.quote.findMany({
    where: {
      id: { in: ids }
    },
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
  
  // Get favorites for these quotes
  const favorites = await prisma.favorite.findMany({
    where: {
      userId,
      quoteId: { in: ids }
    },
    select: { quoteId: true }
  })
  
  const favoriteSet = new Set(favorites.map(f => f.quoteId))
  
  // Add favorite status and format dates
  return quotes.map(quote => ({
    ...quote,
    isFavorited: favoriteSet.has(quote.id),
    createdAt: quote.createdAt.toISOString(),
    updatedAt: quote.updatedAt.toISOString()
  }))
}

// Client-side utility: Fisher-Yates shuffle algorithm
export function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}

// Client-side utility: Get next batch of IDs
export function getNextBatch<T>(array: T[], index: number, batchSize: number): T[] {
  return array.slice(index, index + batchSize)
}