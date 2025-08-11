'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { shuffleArray } from '@/lib/quote-service'
import toast from 'react-hot-toast'

interface Quote {
  id: string
  text: string
  author: string
  category?: string
  source?: string
  isFavorited: boolean
  createdAt: string
  updatedAt: string
}

interface UseOptimizedQuotesOptions {
  batchSize?: number // How many quotes to fetch at once
  prefetchThreshold?: number // When to fetch next batch
}

export function useOptimizedQuotes(options: UseOptimizedQuotesOptions = {}) {
  const { batchSize = 20, prefetchThreshold = 5 } = options
  
  // State management
  const [allQuoteIds, setAllQuoteIds] = useState<string[]>([])
  const [shuffledIds, setShuffledIds] = useState<string[]>([])
  const [currentIdIndex, setCurrentIdIndex] = useState(0)
  const [quotesCache, setQuotesCache] = useState<Map<string, Quote>>(new Map())
  const [currentQuote, setCurrentQuote] = useState<Quote | null>(null)
  const [isInitialized, setIsInitialized] = useState(false)
  
  // Track which IDs we've fetched
  const fetchedIds = useRef(new Set<string>())
  
  // Step 1: Fetch all quote IDs (one-time, lightweight)
  const { data: idsData, isLoading: idsLoading, refetch: refetchIds } = useQuery({
    queryKey: ['quote-ids'],
    queryFn: async () => {
      const response = await fetch('/api/quotes/ids?source=BOTH')
      if (!response.ok) throw new Error('Failed to fetch quote IDs')
      return response.json()
    },
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    gcTime: 10 * 60 * 1000, // Keep in cache for 10 minutes
  })
  
  // Initialize and shuffle IDs when loaded
  useEffect(() => {
    if (idsData?.ids && idsData.ids.length > 0 && !isInitialized) {
      const ids = idsData.ids as string[]
      const shuffled = shuffleArray(ids)
      setAllQuoteIds(ids)
      setShuffledIds(shuffled)
      setIsInitialized(true)
    }
  }, [idsData, isInitialized])
  
  // Batch fetch mutation
  const fetchBatchMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const response = await fetch('/api/quotes/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids })
      })
      if (!response.ok) throw new Error('Failed to fetch quotes batch')
      return response.json()
    },
    onSuccess: (data) => {
      // Add quotes to cache
      const newCache = new Map(quotesCache)
      data.quotes.forEach((quote: Quote) => {
        newCache.set(quote.id, quote)
        fetchedIds.current.add(quote.id)
      })
      setQuotesCache(newCache)
    },
    onError: () => {
      toast.error('Failed to load quotes')
    }
  })
  
  // Prefetch next batch when running low
  const prefetchNextBatch = useCallback(async () => {
    if (!shuffledIds.length) return
    
    const remainingIds = shuffledIds.length - currentIdIndex
    const unfetchedCount = shuffledIds
      .slice(currentIdIndex, currentIdIndex + batchSize)
      .filter(id => !fetchedIds.current.has(id))
      .length
    
    if (unfetchedCount > 0 && remainingIds <= prefetchThreshold + batchSize) {
      // Get next batch of IDs that haven't been fetched
      const nextBatchIds = shuffledIds
        .slice(currentIdIndex, currentIdIndex + batchSize)
        .filter(id => !fetchedIds.current.has(id))
      
      if (nextBatchIds.length > 0) {
        fetchBatchMutation.mutate(nextBatchIds)
      }
    }
  }, [shuffledIds, currentIdIndex, batchSize, prefetchThreshold, fetchBatchMutation])
  
  // Get next quote
  const getNextQuote = useCallback(async () => {
    if (!shuffledIds.length) return
    
    let nextIndex = currentIdIndex
    let quote: Quote | undefined
    
    // Find next quote in cache or fetch it
    while (nextIndex < shuffledIds.length && !quote) {
      const nextId = shuffledIds[nextIndex]
      quote = quotesCache.get(nextId)
      
      if (!quote && !fetchedIds.current.has(nextId)) {
        // Need to fetch this quote
        const batchEnd = Math.min(nextIndex + batchSize, shuffledIds.length)
        const idsToFetch = shuffledIds
          .slice(nextIndex, batchEnd)
          .filter(id => !fetchedIds.current.has(id))
        
        if (idsToFetch.length > 0) {
          await fetchBatchMutation.mutateAsync(idsToFetch)
          quote = quotesCache.get(nextId)
        }
      }
      
      if (quote) {
        setCurrentQuote(quote)
        setCurrentIdIndex(nextIndex + 1)
        
        // Prefetch if running low
        prefetchNextBatch()
        
        // If we've gone through all quotes, reshuffle
        if (nextIndex + 1 >= shuffledIds.length) {
          const reshuffled = shuffleArray(allQuoteIds)
          setShuffledIds(reshuffled)
          setCurrentIdIndex(0)
          toast.success('Reshuffled all quotes for fresh randomness!')
        }
        
        break
      }
      
      nextIndex++
    }
  }, [shuffledIds, currentIdIndex, quotesCache, batchSize, allQuoteIds, prefetchNextBatch, fetchBatchMutation])
  
  // Initial load: fetch first batch
  useEffect(() => {
    if (shuffledIds.length > 0 && quotesCache.size === 0) {
      const firstBatchIds = shuffledIds.slice(0, batchSize)
      fetchBatchMutation.mutate(firstBatchIds)
    }
  }, [shuffledIds, batchSize, quotesCache.size])
  
  // Set initial quote when first batch loads
  useEffect(() => {
    if (quotesCache.size > 0 && !currentQuote && shuffledIds.length > 0) {
      const firstId = shuffledIds[0]
      const firstQuote = quotesCache.get(firstId)
      if (firstQuote) {
        setCurrentQuote(firstQuote)
        setCurrentIdIndex(1)
      }
    }
  }, [quotesCache, currentQuote, shuffledIds])
  
  // Toggle favorite
  const toggleFavorite = useCallback(async (quoteId: string) => {
    const quote = quotesCache.get(quoteId)
    if (!quote) return
    
    const newCache = new Map(quotesCache)
    const updatedQuote = { ...quote, isFavorited: !quote.isFavorited }
    newCache.set(quoteId, updatedQuote)
    setQuotesCache(newCache)
    
    if (currentQuote?.id === quoteId) {
      setCurrentQuote(updatedQuote)
    }
    
    // Call API to persist
    try {
      const method = quote.isFavorited ? 'DELETE' : 'POST'
      const url = quote.isFavorited 
        ? `/api/favorites?quoteId=${quoteId}`
        : '/api/favorites'
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: method === 'POST' ? JSON.stringify({ quoteId }) : undefined
      })
      
      if (!response.ok) throw new Error('Failed to update favorite')
    } catch (error) {
      // Revert on error
      newCache.set(quoteId, quote)
      setQuotesCache(newCache)
      if (currentQuote?.id === quoteId) {
        setCurrentQuote(quote)
      }
      toast.error('Failed to update favorite')
    }
  }, [quotesCache, currentQuote])
  
  // Reset everything (useful when preferences change)
  const reset = useCallback(() => {
    setIsInitialized(false)
    setShuffledIds([])
    setCurrentIdIndex(0)
    setQuotesCache(new Map())
    setCurrentQuote(null)
    fetchedIds.current.clear()
    refetchIds()
  }, [refetchIds])
  
  return {
    currentQuote,
    getNextQuote,
    toggleFavorite,
    reset,
    isLoading: idsLoading || fetchBatchMutation.isPending,
    stats: {
      totalQuotes: allQuoteIds.length,
      cachedQuotes: quotesCache.size,
      currentPosition: currentIdIndex,
      remainingInShuffle: Math.max(0, shuffledIds.length - currentIdIndex)
    }
  }
}