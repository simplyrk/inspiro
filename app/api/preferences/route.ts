import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const preferencesSchema = z.object({
  rotationInterval: z.number().min(10).max(86400).optional(),
  quoteSource: z.enum(['PRELOADED', 'CUSTOM', 'BOTH']).optional(),
  theme: z.enum(['LIGHT', 'DARK', 'SYSTEM']).optional(),
  showAuthor: z.boolean().optional(),
  enableAnimations: z.boolean().optional(),
  fontSize: z.enum(['SMALL', 'MEDIUM', 'LARGE', 'EXTRA_LARGE']).optional(),
})

// GET /api/preferences - Get user preferences
export async function GET() {
  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    let preferences = await prisma.userPreferences.findUnique({
      where: { userId: session.user.id },
    })

    // Create default preferences if they don't exist
    if (!preferences) {
      preferences = await prisma.userPreferences.create({
        data: {
          userId: session.user.id,
          rotationInterval: 30,
          quoteSource: 'BOTH',
          theme: 'SYSTEM',
          showAuthor: true,
          enableAnimations: true,
          fontSize: 'MEDIUM',
        },
      })
    }

    return NextResponse.json(preferences)
  } catch (error) {
    console.error('Get preferences error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PUT /api/preferences - Update user preferences
export async function PUT(request: Request) {
  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const data = preferencesSchema.parse(body)

    const preferences = await prisma.userPreferences.upsert({
      where: { userId: session.user.id },
      update: data,
      create: {
        ...data,
        userId: session.user.id,
        rotationInterval: data.rotationInterval || 30,
        quoteSource: data.quoteSource || 'BOTH',
        theme: data.theme || 'SYSTEM',
        showAuthor: data.showAuthor ?? true,
        enableAnimations: data.enableAnimations ?? true,
        fontSize: data.fontSize || 'MEDIUM',
      },
    })

    return NextResponse.json(preferences)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid data', details: error.errors },
        { status: 400 }
      )
    }
    
    console.error('Update preferences error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
