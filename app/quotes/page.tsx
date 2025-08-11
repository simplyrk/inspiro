'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Heart, RefreshCw, Plus, LogOut, Settings, Maximize } from 'lucide-react'
import { signOut, useSession } from 'next-auth/react'
import { useTheme } from 'next-themes'
import toast from 'react-hot-toast'
import Link from 'next/link'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'

interface Quote {
  id: string
  text: string
  author: string
  category?: string
  source?: string
  isFavorited: boolean
  createdAt: string
}

interface QuotesResponse {
  quotes: Quote[]
  total: number
}

export default function QuotesPage() {
  const { data: session, status } = useSession()
  const queryClient = useQueryClient()
  const { setTheme } = useTheme()
  const [currentQuote, setCurrentQuote] = useState<Quote | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [wakeLock, setWakeLock] = useState<WakeLockSentinel | null>(null)
  const [newQuote, setNewQuote] = useState({ text: '', author: '', category: '', source: '' })

  // Fetch random quote
  const { data: quotesData, isLoading, error, refetch } = useQuery<QuotesResponse>({
    queryKey: ['quotes', 'random'],
    queryFn: async () => {
      const response = await fetch('/api/quotes?random=true&count=1')
      if (!response.ok) {
        throw new Error('Failed to fetch quotes')
      }
      return response.json()
    },
    enabled: !!session,
  })

  // Function to get a new random quote
  const getNewQuote = useCallback(async () => {
    const { data } = await refetch()
    if (data?.quotes && data.quotes.length > 0) {
      setCurrentQuote(data.quotes[0])
    }
  }, [refetch])

  // Set current quote when data loads
  useEffect(() => {
    if (quotesData?.quotes && quotesData.quotes.length > 0 && !currentQuote) {
      setCurrentQuote(quotesData.quotes[0])
    }
  }, [quotesData?.quotes, currentQuote])

  // Add quote mutation
  const addQuoteMutation = useMutation({
    mutationFn: async (quote: { text: string; author: string; category?: string; source?: string }) => {
      const response = await fetch('/api/quotes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(quote),
      })
      if (!response.ok) {
        throw new Error('Failed to add quote')
      }
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotes'] })
      setShowAddForm(false)
      setNewQuote({ text: '', author: '', category: '', source: '' })
      getNewQuote() // Get a new random quote
      toast.success('Quote added successfully!')
    },
    onError: () => {
      toast.error('Failed to add quote')
    },
  })

  // Toggle favorite mutation
  const toggleFavoriteMutation = useMutation({
    mutationFn: async ({ quoteId, isFavorited }: { quoteId: string; isFavorited: boolean }) => {
      if (isFavorited) {
        // Remove favorite
        const response = await fetch(`/api/favorites?quoteId=${quoteId}`, {
          method: 'DELETE',
        })
        if (!response.ok) {
          throw new Error('Failed to remove favorite')
        }
      } else {
        // Add favorite
        const response = await fetch('/api/favorites', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ quoteId }),
        })
        if (!response.ok) {
          throw new Error('Failed to add favorite')
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotes'] })
    },
    onError: () => {
      toast.error('Failed to update favorite')
    },
  })


  const handleAddQuote = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newQuote.text.trim() || !newQuote.author.trim()) {
      toast.error('Quote text and author are required')
      return
    }
    addQuoteMutation.mutate(newQuote)
  }

  const handleToggleFavorite = () => {
    if (currentQuote) {
      toggleFavoriteMutation.mutate({
        quoteId: currentQuote.id,
        isFavorited: currentQuote.isFavorited,
      })
      // Update current quote state immediately for UI feedback
      setCurrentQuote(prev => prev ? { ...prev, isFavorited: !prev.isFavorited } : null)
    }
  }

  // Fetch user preferences for auto-rotation
  const { data: preferences } = useQuery({
    queryKey: ['preferences'],
    queryFn: async () => {
      const response = await fetch('/api/preferences')
      if (!response.ok) {
        throw new Error('Failed to fetch preferences')
      }
      return response.json()
    },
    enabled: !!session,
  })

  // Apply theme when preferences load
  useEffect(() => {
    if (preferences?.theme) {
      const themeMapping: Record<string, string> = {
        'LIGHT': 'light',
        'DARK': 'dark',
        'SYSTEM': 'system'
      }
      setTheme(themeMapping[preferences.theme])
    }
  }, [preferences?.theme, setTheme])

  // Auto-rotation effect
  useEffect(() => {
    if (isFullscreen && preferences?.rotationInterval && currentQuote) {
      const interval = setInterval(() => {
        getNewQuote()
      }, preferences.rotationInterval * 1000)

      return () => clearInterval(interval)
    }
  }, [isFullscreen, preferences?.rotationInterval, currentQuote, getNewQuote])

  // Fullscreen change listener
  useEffect(() => {
    const handleFullscreenChange = () => {
      const isCurrentlyFullscreen = !!document.fullscreenElement
      setIsFullscreen(isCurrentlyFullscreen)
      
      if (!isCurrentlyFullscreen && wakeLock) {
        wakeLock.release()
        setWakeLock(null)
      }
    }

    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
  }, [wakeLock])

  // Fullscreen functions
  const enterFullscreen = async () => {
    try {
      await document.documentElement.requestFullscreen()
      // Request wake lock to prevent screen from sleeping
      if ('wakeLock' in navigator) {
        try {
          const lock = await (navigator as Navigator & { wakeLock: { request: (type: string) => Promise<WakeLockSentinel> } }).wakeLock.request('screen')
          setWakeLock(lock)
          toast.success('Fullscreen mode activated with screen wake lock')
        } catch {
          toast.success('Fullscreen mode activated')
        }
      }
    } catch (error) {
      console.error('Failed to enter fullscreen:', error)
      toast.error('Failed to enter fullscreen mode')
    }
  }

  const exitFullscreen = async () => {
    try {
      await document.exitFullscreen()
    } catch (error) {
      console.error('Failed to exit fullscreen:', error)
    }
  }

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900"></div>
      </div>
    )
  }

  if (!session) {
    return null // This should redirect to login via the middleware
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-red-600">Error</CardTitle>
          </CardHeader>
          <CardContent>
            <p>Failed to load quotes. Please try again.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Fullscreen UI
  if (isFullscreen && currentQuote) {
    return (
      <div 
        className="h-screen w-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-8 cursor-pointer"
        onClick={exitFullscreen}
      >
        <div className="max-w-4xl mx-auto text-center">
          <motion.div
            key={currentQuote.id}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8 }}
            className="space-y-8"
          >
            <blockquote 
              className={`font-medium text-gray-800 dark:text-white leading-relaxed ${
                preferences?.fontSize === 'SMALL' ? 'text-2xl md:text-3xl' :
                preferences?.fontSize === 'LARGE' ? 'text-4xl md:text-5xl lg:text-6xl' :
                preferences?.fontSize === 'EXTRA_LARGE' ? 'text-5xl md:text-6xl lg:text-7xl' :
                'text-3xl md:text-4xl lg:text-5xl'
              }`}
            >
              &ldquo;{currentQuote.text}&rdquo;
            </blockquote>
            {preferences?.showAuthor !== false && (
              <cite className={`block text-gray-600 dark:text-gray-300 font-semibold ${
                preferences?.fontSize === 'SMALL' ? 'text-lg md:text-xl' :
                preferences?.fontSize === 'LARGE' ? 'text-2xl md:text-3xl' :
                preferences?.fontSize === 'EXTRA_LARGE' ? 'text-3xl md:text-4xl' :
                'text-xl md:text-2xl'
              }`}>
                — {currentQuote.author}
              </cite>
            )}
          </motion.div>
          
          {/* Subtle controls overlay */}
          <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 flex gap-4 opacity-30 hover:opacity-100 transition-opacity">
            <button
              onClick={(e) => { e.stopPropagation(); getNewQuote(); }}
              className="p-3 bg-white/20 dark:bg-gray-800/50 rounded-full backdrop-blur-sm"
            >
              <RefreshCw className="h-6 w-6 text-gray-800 dark:text-white" />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); handleToggleFavorite(); }}
              className="p-3 bg-white/20 dark:bg-gray-800/50 rounded-full backdrop-blur-sm"
            >
              <Heart 
                className={`h-6 w-6 text-gray-800 dark:text-white ${
                  currentQuote.isFavorited ? "fill-current" : ""
                }`} 
              />
            </button>
          </div>
          
          <p className="absolute top-8 left-8 text-sm text-gray-600 dark:text-gray-400 opacity-50">
            Click anywhere to exit fullscreen • Auto-rotating every {preferences?.rotationInterval || 30}s
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800 dark:text-white">
            Inspirational Quotes
          </h1>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAddForm(!showAddForm)}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Quote
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={enterFullscreen}
            >
              <Maximize className="h-4 w-4 mr-2" />
              Fullscreen
            </Button>
            <Link href="/settings">
              <Button
                variant="outline"
                size="sm"
              >
                <Settings className="h-4 w-4 mr-2" />
                Settings
              </Button>
            </Link>
            <Button
              variant="outline"
              size="sm"
              onClick={() => signOut()}
            >
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </div>

        {/* Add Quote Form */}
        <AnimatePresence>
          {showAddForm && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-8"
            >
              <Card>
                <CardHeader>
                  <CardTitle>Add New Quote</CardTitle>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleAddQuote} className="space-y-4">
                    <div>
                      <Label htmlFor="quote-text">Quote *</Label>
                      <Textarea
                        id="quote-text"
                        value={newQuote.text}
                        onChange={(e) => setNewQuote({ ...newQuote, text: e.target.value })}
                        placeholder="Enter the quote text..."
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="author">Author *</Label>
                      <Input
                        id="author"
                        value={newQuote.author}
                        onChange={(e) => setNewQuote({ ...newQuote, author: e.target.value })}
                        placeholder="Quote author"
                        required
                      />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="category">Category</Label>
                        <Input
                          id="category"
                          value={newQuote.category}
                          onChange={(e) => setNewQuote({ ...newQuote, category: e.target.value })}
                          placeholder="e.g., Motivation, Life, Success"
                        />
                      </div>
                      <div>
                        <Label htmlFor="source">Source</Label>
                        <Input
                          id="source"
                          value={newQuote.source}
                          onChange={(e) => setNewQuote({ ...newQuote, source: e.target.value })}
                          placeholder="Book, speech, etc."
                        />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        type="submit"
                        disabled={addQuoteMutation.isPending}
                      >
                        {addQuoteMutation.isPending ? 'Adding...' : 'Add Quote'}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setShowAddForm(false)}
                      >
                        Cancel
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Current Quote Display */}
        {currentQuote && (
          <motion.div
            key={currentQuote.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mb-8"
          >
            <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm shadow-xl">
              <CardContent className="p-8 text-center">
                <blockquote 
                  className={`font-medium text-gray-800 dark:text-white mb-6 leading-relaxed ${
                    preferences?.fontSize === 'SMALL' ? 'text-lg md:text-xl lg:text-2xl' :
                    preferences?.fontSize === 'LARGE' ? 'text-3xl md:text-4xl lg:text-5xl' :
                    preferences?.fontSize === 'EXTRA_LARGE' ? 'text-4xl md:text-5xl lg:text-6xl' :
                    'text-2xl md:text-3xl lg:text-4xl'
                  }`}
                >
                  &ldquo;{currentQuote.text}&rdquo;
                </blockquote>
                {preferences?.showAuthor !== false && (
                  <cite 
                    className={`block text-gray-600 dark:text-gray-300 font-semibold ${
                      preferences?.fontSize === 'SMALL' ? 'text-base md:text-lg' :
                      preferences?.fontSize === 'LARGE' ? 'text-xl md:text-2xl' :
                      preferences?.fontSize === 'EXTRA_LARGE' ? 'text-2xl md:text-3xl' :
                      'text-lg md:text-xl'
                    }`}
                  >
                    — {currentQuote.author}
                  </cite>
                )}
                {currentQuote.category && (
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                    Category: {currentQuote.category}
                  </p>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Controls */}
        {currentQuote && (
          <div className="flex justify-center gap-4 mb-8">
            <Button
              onClick={getNewQuote}
              size="lg"
              className="flex items-center gap-2"
              disabled={isLoading}
            >
              <RefreshCw className={`h-5 w-5 ${isLoading ? 'animate-spin' : ''}`} />
              New Quote
            </Button>
            <Button
              variant={currentQuote.isFavorited ? "default" : "outline"}
              size="lg"
              onClick={handleToggleFavorite}
              disabled={toggleFavoriteMutation.isPending}
              className="flex items-center gap-2"
            >
              <Heart
                className={`h-5 w-5 ${
                  currentQuote.isFavorited ? "fill-current" : ""
                }`}
              />
              {currentQuote.isFavorited ? "Favorited" : "Add to Favorites"}
            </Button>
          </div>
        )}

        {/* User Info */}
        {currentQuote && (
          <div className="text-center text-gray-600 dark:text-gray-400 space-y-2">
            <p className="text-sm">
              Welcome back, {session.user?.name || session.user?.email}!
            </p>
            {quotesData?.total && (
              <p className="text-xs">
                {quotesData.total} quotes available in your collection
              </p>
            )}
          </div>
        )}

        {/* Empty State */}
        {!currentQuote && !isLoading && (
          <Card className="text-center py-12">
            <CardContent>
              <h3 className="text-xl font-semibold mb-4">No quotes available!</h3>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                Add your first quote to get started, or check your settings to adjust quote sources.
              </p>
              <div className="flex gap-2 justify-center">
                <Button onClick={() => setShowAddForm(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Your First Quote
                </Button>
                <Link href="/settings">
                  <Button variant="outline">
                    <Settings className="h-4 w-4 mr-2" />
                    Settings
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}