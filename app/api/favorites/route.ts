import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const favoriteSchema = z.object({
  quoteId: z.string(),
})

// GET /api/favorites - Get user's favorite quotes
export async function GET() {
  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const favorites = await prisma.favorite.findMany({
      where: { userId: session.user.id },
      include: {
        quote: true,
      },
      orderBy: { createdAt: 'desc' },
    })

    const favoriteQuotes = favorites.map(fav => ({
      ...fav.quote,
      isFavorited: true,
      favoritedAt: fav.createdAt,
    }))

    return NextResponse.json(favoriteQuotes)
  } catch (error) {
    console.error('Get favorites error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST /api/favorites - Add a quote to favorites
export async function POST(request: Request) {
  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { quoteId } = favoriteSchema.parse(body)

    // Check if already favorited
    const existing = await prisma.favorite.findUnique({
      where: {
        userId_quoteId: {
          userId: session.user.id,
          quoteId,
        },
      },
    })

    if (existing) {
      return NextResponse.json(
        { error: 'Quote already favorited' },
        { status: 400 }
      )
    }

    const favorite = await prisma.favorite.create({
      data: {
        userId: session.user.id,
        quoteId,
      },
      include: {
        quote: true,
      },
    })

    return NextResponse.json(favorite, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid data', details: error.errors },
        { status: 400 }
      )
    }
    
    console.error('Add favorite error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE /api/favorites - Remove a quote from favorites
export async function DELETE(request: Request) {
  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { quoteId } = favoriteSchema.parse(body)

    await prisma.favorite.delete({
      where: {
        userId_quoteId: {
          userId: session.user.id,
          quoteId,
        },
      },
    })

    return NextResponse.json({ message: 'Favorite removed' })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid data', details: error.errors },
        { status: 400 }
      )
    }
    
    console.error('Remove favorite error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
