'use client'

import { useState } from 'react'
import { searchRepo, getMemoryFiles } from '@/lib/github'

type SearchResult = {
  type: 'code' | 'file'
  name: string
  path: string
  url: string
  fragment?: string
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
      const codeResults = await searchRepo(query)
      
      const combined: SearchResult[] = codeResults.map((item: any) => ({
        type: 'code' as const,
        name: item.name,
        path: item.path,
        url: item.html_url,
        fragment: item.text_matches?.[0]?.fragment,
      }))

      setResults(combined)
    } catch (error) {
      console.error('Search error:', error)
    }

    setLoading(false)
  }

  return (
    <div>
      <form onSubmit={handleSearch} className="mb-6">
        <div className="flex gap-2">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search memories, documents, code..."
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
              {results.map((result, i) => (
                <a 
                  key={`${result.path}-${i}`}
                  href={result.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block bg-gray-900 rounded-lg p-4 border border-gray-800 hover:border-gray-600 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <span className="text-xl">📄</span>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-medium">{result.name}</h3>
                      </div>
                      <p className="text-sm text-gray-400 font-mono">
                        {result.path}
                      </p>
                      {result.fragment && (
                        <p className="text-sm text-gray-500 mt-2 line-clamp-2">
                          ...{result.fragment}...
                        </p>
                      )}
                    </div>
                  </div>
                </a>
              ))}
            </div>
          )}
        </div>
      )}

      {!searched && (
        <div className="text-center py-12 text-gray-500">
          <p className="text-4xl mb-4">🔍</p>
          <p>Search through all of Theo's workspace on GitHub</p>
        </div>
      )}
    </div>
  )
}
