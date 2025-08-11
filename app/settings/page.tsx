'use client'

import { useState, useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useTheme } from 'next-themes'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { ArrowLeft, Save } from 'lucide-react'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'

interface UserPreferences {
  id: string
  rotationInterval: number
  quoteSource: 'PRELOADED' | 'CUSTOM' | 'FAVORITES' | 'BOTH'
  theme: 'LIGHT' | 'DARK' | 'SYSTEM'
  showAuthor: boolean
  enableAnimations: boolean
  fontSize: 'SMALL' | 'MEDIUM' | 'LARGE' | 'EXTRA_LARGE'
}

export default function SettingsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const queryClient = useQueryClient()
  const { setTheme } = useTheme()

  // Fetch user preferences
  const { data: preferences, isLoading } = useQuery<UserPreferences>({
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

  const [settings, setSettings] = useState<Partial<UserPreferences>>({})

  // Initialize settings when preferences load
  useEffect(() => {
    if (preferences && Object.keys(settings).length === 0) {
      setSettings(preferences)
      // Apply theme on load
      if (preferences.theme) {
        const themeMapping: Record<string, string> = {
          'LIGHT': 'light',
          'DARK': 'dark',
          'SYSTEM': 'system'
        }
        setTheme(themeMapping[preferences.theme])
      }
    }
  }, [preferences, settings, setTheme])

  // Update preferences mutation
  const updatePreferences = useMutation({
    mutationFn: async (newSettings: Partial<UserPreferences>) => {
      const response = await fetch('/api/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSettings),
      })
      if (!response.ok) {
        throw new Error('Failed to update preferences')
      }
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['preferences'] })
      // Apply theme immediately
      if (settings.theme) {
        const themeMapping: Record<string, string> = {
          'LIGHT': 'light',
          'DARK': 'dark',
          'SYSTEM': 'system'
        }
        setTheme(themeMapping[settings.theme])
      }
      toast.success('Settings saved successfully!')
    },
    onError: () => {
      toast.error('Failed to save settings')
    },
  })

  const handleSave = () => {
    updatePreferences.mutate(settings)
  }

  if (status === 'loading' || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900"></div>
      </div>
    )
  }

  if (!session) {
    router.push('/auth/login')
    return null
  }

  const rotationIntervals = [
    { value: 10, label: '10 seconds' },
    { value: 30, label: '30 seconds' },
    { value: 60, label: '1 minute' },
    { value: 300, label: '5 minutes' },
    { value: 600, label: '10 minutes' },
    { value: 1800, label: '30 minutes' },
    { value: 3600, label: '1 hour' },
  ]

  const quoteSources = [
    { value: 'PRELOADED', label: 'Preloaded Quotes Only', description: 'Show only curated quotes from our collection' },
    { value: 'CUSTOM', label: 'Your Custom Quotes Only', description: 'Show only quotes you\'ve added yourself' },
    { value: 'FAVORITES', label: 'Your Favorites Only', description: 'Show only quotes you\'ve marked as favorites' },
    { value: 'BOTH', label: 'Mixed Collection', description: 'Show both preloaded and your custom quotes' },
  ]

  const themes = [
    { value: 'LIGHT', label: 'Light Theme' },
    { value: 'DARK', label: 'Dark Theme' },
    { value: 'SYSTEM', label: 'Follow System' },
  ]

  const fontSizes = [
    { value: 'SMALL', label: 'Small' },
    { value: 'MEDIUM', label: 'Medium' },
    { value: 'LARGE', label: 'Large' },
    { value: 'EXTRA_LARGE', label: 'Extra Large' },
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Link href="/quotes">
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Quotes
            </Button>
          </Link>
          <h1 className="text-3xl font-bold text-gray-800 dark:text-white">
            Settings
          </h1>
        </div>

        <div className="space-y-6">
          {/* Quote Rotation Frequency */}
          <Card>
            <CardHeader>
              <CardTitle>Quote Rotation</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="rotation-interval">Rotation Frequency</Label>
                <select
                  id="rotation-interval"
                  className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  value={settings.rotationInterval || 30}
                  onChange={(e) => setSettings(prev => ({ 
                    ...prev, 
                    rotationInterval: parseInt(e.target.value) 
                  }))}
                >
                  {rotationIntervals.map(interval => (
                    <option key={interval.value} value={interval.value}>
                      {interval.label}
                    </option>
                  ))}
                </select>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  How often to automatically show a new quote in full-screen mode
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Quote Source Mix */}
          <Card>
            <CardHeader>
              <CardTitle>Quote Sources</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Which quotes would you like to see?</Label>
                <div className="mt-3 space-y-3">
                  {quoteSources.map(source => (
                    <div key={source.value} className="flex items-start space-x-3">
                      <input
                        type="radio"
                        id={source.value}
                        name="quoteSource"
                        value={source.value}
                        checked={settings.quoteSource === source.value}
                        onChange={(e) => setSettings(prev => ({ 
                          ...prev, 
                          quoteSource: e.target.value as 'PRELOADED' | 'CUSTOM' | 'FAVORITES' | 'BOTH'
                        }))}
                        className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                      />
                      <div className="flex-1">
                        <label htmlFor={source.value} className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                          {source.label}
                        </label>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {source.description}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Appearance Settings */}
          <Card>
            <CardHeader>
              <CardTitle>Appearance</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="theme">Theme</Label>
                <select
                  id="theme"
                  className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  value={settings.theme || 'SYSTEM'}
                  onChange={(e) => setSettings(prev => ({ 
                    ...prev, 
                    theme: e.target.value as 'LIGHT' | 'DARK' | 'SYSTEM'
                  }))}
                >
                  {themes.map(theme => (
                    <option key={theme.value} value={theme.value}>
                      {theme.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <Label htmlFor="font-size">Font Size</Label>
                <select
                  id="font-size"
                  className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  value={settings.fontSize || 'MEDIUM'}
                  onChange={(e) => setSettings(prev => ({ 
                    ...prev, 
                    fontSize: e.target.value as 'SMALL' | 'MEDIUM' | 'LARGE' | 'EXTRA_LARGE'
                  }))}
                >
                  {fontSizes.map(size => (
                    <option key={size.value} value={size.value}>
                      {size.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-3">
                <div className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    id="show-author"
                    checked={settings.showAuthor ?? true}
                    onChange={(e) => setSettings(prev => ({ 
                      ...prev, 
                      showAuthor: e.target.checked
                    }))}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label htmlFor="show-author" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Show quote authors
                  </label>
                </div>

                <div className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    id="enable-animations"
                    checked={settings.enableAnimations ?? true}
                    onChange={(e) => setSettings(prev => ({ 
                      ...prev, 
                      enableAnimations: e.target.checked
                    }))}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label htmlFor="enable-animations" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Enable animations
                  </label>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Save Button */}
          <div className="flex justify-end">
            <Button
              onClick={handleSave}
              disabled={updatePreferences.isPending}
              className="flex items-center gap-2"
            >
              {updatePreferences.isPending ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              ) : (
                <Save className="h-4 w-4" />
              )}
              {updatePreferences.isPending ? 'Saving...' : 'Save Settings'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}