'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'

type SearchResult = {
  type: 'activity' | 'document' | 'task'
  id: string
  title: string
  description: string | null
  created_at: string
  metadata?: Record<string, any>
}

export default function Search() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    if (!query.trim()) return

    setLoading(true)
    setSearched(true)

    try {
      // Search activities
      const { data: activities } = await supabase
        .from('activities')
        .select('id, title, description, created_at, metadata')
        .or(`title.ilike.%${query}%,description.ilike.%${query}%`)
        .order('created_at', { ascending: false })
        .limit(20)

      // Search documents
      const { data: documents } = await supabase
        .from('documents')
        .select('id, title, content_preview, created_at, path')
        .or(`title.ilike.%${query}%,content_preview.ilike.%${query}%`)
        .limit(20)

      // Search scheduled tasks
      const { data: tasks } = await supabase
        .from('scheduled_tasks')
        .select('id, name, description, created_at')
        .or(`name.ilike.%${query}%,description.ilike.%${query}%`)
        .limit(20)

      const combined: SearchResult[] = [
        ...(activities || []).map(a => ({
          type: 'activity' as const,
          id: a.id,
          title: a.title,
          description: a.description,
          created_at: a.created_at,
          metadata: a.metadata
        })),
        ...(documents || []).map(d => ({
          type: 'document' as const,
          id: d.id,
          title: d.title || d.path,
          description: d.content_preview,
          created_at: d.created_at,
        })),
        ...(tasks || []).map(t => ({
          type: 'task' as const,
          id: t.id,
          title: t.name,
          description: t.description,
          created_at: t.created_at,
        })),
      ]

      // Sort by date
      combined.sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )

      setResults(combined)
    } catch (error) {
      console.error('Search error:', error)
    }

    setLoading(false)
  }

  const typeIcons: Record<string, string> = {
    activity: '📊',
    document: '📄',
    task: '⏰',
  }

  return (
    <div>
      <form onSubmit={handleSearch} className="mb-6">
        <div className="flex gap-2">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search memories, documents, tasks..."
            className="flex-1 px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg focus:outline-none focus:border-white"
          />
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-3 bg-white text-black rounded-lg font-medium hover:bg-gray-200 disabled:opacity-50"
          >
            {loading ? 'Searching...' : 'Search'}
          </button>
        </div>
      </form>

      {searched && (
        <div>
          <p className="text-gray-400 mb-4">
            {results.length} result{results.length !== 1 ? 's' : ''} for "{query}"
          </p>

          {results.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No results found. Try different keywords.
            </div>
          ) : (
            <div className="space-y-3">
              {results.map((result) => (
                <div 
                  key={`${result.type}-${result.id}`}
                  className="bg-gray-900 rounded-lg p-4 border border-gray-800"
                >
                  <div className="flex items-start gap-3">
                    <span className="text-xl">{typeIcons[result.type]}</span>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-medium">{result.title}</h3>
                        <span className="text-xs text-gray-500 bg-gray-800 px-2 py-0.5 rounded">
                          {result.type}
                        </span>
                      </div>
                      {result.description && (
                        <p className="text-gray-400 text-sm line-clamp-2">
                          {result.description}
                        </p>
                      )}
                      <p className="text-xs text-gray-600 mt-2">
                        {new Date(result.created_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {!searched && (
        <div className="text-center py-12 text-gray-500">
          <p className="text-4xl mb-4">🔍</p>
          <p>Search through all of Theo's memories, documents, and tasks</p>
        </div>
      )}
    </div>
  )
}
