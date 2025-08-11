'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Heart, RefreshCw, Plus, LogOut, Settings, Maximize, Menu, X } from 'lucide-react'
import { signOut, useSession } from 'next-auth/react'
import { useTheme } from 'next-themes'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import Link from 'next/link'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { useOptimizedQuotes } from '@/hooks/use-optimized-quotes'


export default function OptimizedQuotesPage() {
  const { data: session, status } = useSession()
  const queryClient = useQueryClient()
  const { setTheme } = useTheme()
  const [showAddForm, setShowAddForm] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [wakeLock, setWakeLock] = useState<WakeLockSentinel | null>(null)
  const [showMobileMenu, setShowMobileMenu] = useState(false)
  const [newQuote, setNewQuote] = useState({ text: '', author: '', category: '', source: '' })

  // Use our optimized quotes hook
  const {
    currentQuote,
    getNextQuote,
    toggleFavorite,
    reset,
    isLoading,
    stats
  } = useOptimizedQuotes({
    batchSize: 20, // Fetch 20 quotes at a time
    prefetchThreshold: 5 // Start fetching next batch when 5 quotes remain
  })

  // Fetch user preferences
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

  // Auto-rotation in fullscreen
  useEffect(() => {
    if (isFullscreen && preferences?.rotationInterval && currentQuote) {
      const interval = setInterval(() => {
        getNextQuote()
      }, preferences.rotationInterval * 1000)

      return () => clearInterval(interval)
    }
  }, [isFullscreen, preferences?.rotationInterval, currentQuote, getNextQuote])

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
      queryClient.invalidateQueries({ queryKey: ['quote-ids'] })
      setShowAddForm(false)
      setNewQuote({ text: '', author: '', category: '', source: '' })
      reset() // Reset the optimized quotes system
      toast.success('Quote added successfully!')
    },
    onError: () => {
      toast.error('Failed to add quote')
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

  // Fullscreen functions
  const enterFullscreen = async () => {
    try {
      await document.documentElement.requestFullscreen()
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

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900"></div>
      </div>
    )
  }

  if (!session) {
    return null
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
          
          <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 flex gap-4 opacity-30 hover:opacity-100 transition-opacity">
            <button
              onClick={(e) => { e.stopPropagation(); getNextQuote(); }}
              className="p-3 bg-white/20 dark:bg-gray-800/50 rounded-full backdrop-blur-sm"
            >
              <RefreshCw className="h-6 w-6 text-gray-800 dark:text-white" />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); toggleFavorite(currentQuote.id); }}
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
            Click anywhere to exit • Auto-rotating every {preferences?.rotationInterval || 30}s
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
          <h1 className="text-2xl md:text-3xl font-bold text-gray-800 dark:text-white">
            Inspirational Quotes
          </h1>
          
          {/* Desktop Navigation */}
          <div className="hidden md:flex gap-2">
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
              <Button variant="outline" size="sm">
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

          {/* Mobile Navigation */}
          <div className="md:hidden flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAddForm(!showAddForm)}
            >
              <Plus className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowMobileMenu(!showMobileMenu)}
            >
              {showMobileMenu ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        {/* Mobile Menu Dropdown */}
        <AnimatePresence>
          {showMobileMenu && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="md:hidden mb-6"
            >
              <Card className="p-4">
                <div className="space-y-2">
                  <Link href="/settings" className="block">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full justify-start"
                      onClick={() => setShowMobileMenu(false)}
                    >
                      <Settings className="h-4 w-4 mr-2" />
                      Settings
                    </Button>
                  </Link>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start"
                    onClick={() => {
                      setShowMobileMenu(false)
                      signOut()
                    }}
                  >
                    <LogOut className="h-4 w-4 mr-2" />
                    Sign Out
                  </Button>
                </div>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

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
                      <Button type="submit" disabled={addQuoteMutation.isPending}>
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
              onClick={getNextQuote}
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
              onClick={() => toggleFavorite(currentQuote.id)}
              disabled={isLoading}
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

        {/* Stats Info */}
        {stats && (
          <div className="text-center text-gray-600 dark:text-gray-400 space-y-2">
            <p className="text-sm">
              Welcome back, {session.user?.name || session.user?.email}!
            </p>
            <p className="text-xs">
              {stats.totalQuotes} total quotes • {stats.cachedQuotes} cached • 
              Position {stats.currentPosition}/{stats.totalQuotes}
            </p>
            <p className="text-xs text-green-600 dark:text-green-400">
              ✨ Optimized: Only {Math.ceil(stats.totalQuotes / 20)} DB calls needed for all quotes!
            </p>
          </div>
        )}

        {/* Loading State */}
        {isLoading && !currentQuote && (
          <Card className="text-center py-12">
            <CardContent>
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto mb-4"></div>
              <p className="text-gray-600 dark:text-gray-400">Loading quotes...</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}