import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'
import * as path from 'path'
import Papa from 'papaparse'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

interface QuoteRow {
  Author: string
  Quote: string
}

async function main() {
  console.log('🌱 Starting database seed...')
  
  // Clear existing data
  await prisma.favorite.deleteMany()
  await prisma.quote.deleteMany()
  await prisma.userPreferences.deleteMany()
  await prisma.session.deleteMany()
  await prisma.account.deleteMany()
  await prisma.user.deleteMany()
  
  console.log('✅ Cleared existing data')
  
  // Create a demo user
  const hashedPassword = await bcrypt.hash('demo123', 10)
  const demoUser = await prisma.user.create({
    data: {
      email: 'demo@example.com',
      password: hashedPassword,
      name: 'Demo User',
      preferences: {
        create: {
          rotationInterval: 30,
          quoteSource: 'BOTH',
          theme: 'SYSTEM',
          showAuthor: true,
          enableAnimations: true,
          fontSize: 'MEDIUM',
        }
      }
    }
  })
  
  console.log('✅ Created demo user (email: demo@example.com, password: demo123)')
  
  // Read and parse the CSV file
  const csvPath = path.join(process.cwd(), 'quotes.csv')
  const csvContent = fs.readFileSync(csvPath, 'utf-8')
  
  const parseResult = Papa.parse<QuoteRow>(csvContent, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: true,
  })
  
  if (parseResult.errors.length > 0) {
    console.error('❌ Errors parsing CSV:', parseResult.errors)
    return
  }

  console.log(`📚 Found ${parseResult.data.length} quotes to import`)
  
  // Filter out quotes with empty authors and import in batches
  const validQuotes = parseResult.data.filter(row => row.Quote && row.Author && row.Quote.trim() && row.Author.trim())
  
  console.log(`📚 Found ${validQuotes.length} valid quotes to import (filtered from ${parseResult.data.length})`)
  
  const batchSize = 100
  let importedCount = 0
  
  for (let i = 0; i < validQuotes.length; i += batchSize) {
    const batch = validQuotes.slice(i, i + batchSize)
    
    await prisma.quote.createMany({
      data: batch.map(row => ({
        text: row.Quote.trim(),
        author: row.Author.trim(),
        isPreloaded: true,
      }))
    })
    
    importedCount += batch.length
    console.log(`✅ Imported ${importedCount}/${validQuotes.length} quotes`)
  }
  
  // Add a few custom quotes for the demo user
  await prisma.quote.createMany({
    data: [
      {
        text: "The only way to do great work is to love what you do.",
        author: "Steve Jobs",
        userId: demoUser.id,
        isPreloaded: false,
      },
      {
        text: "Innovation distinguishes between a leader and a follower.",
        author: "Steve Jobs",
        userId: demoUser.id,
        isPreloaded: false,
      },
      {
        text: "Life is what happens when you're busy making other plans.",
        author: "John Lennon",
        userId: demoUser.id,
        isPreloaded: false,
      }
    ]
  })
  
  console.log('✅ Added custom quotes for demo user')
  
  // Add some favorites for the demo user
  const randomQuotes = await prisma.quote.findMany({
    where: { isPreloaded: true },
    take: 5,
  })
  
  for (const quote of randomQuotes) {
    await prisma.favorite.create({
      data: {
        userId: demoUser.id,
        quoteId: quote.id,
      }
    })
  }

  console.log('✅ Added favorite quotes for demo user')
  console.log('🎉 Seed completed successfully!')
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
