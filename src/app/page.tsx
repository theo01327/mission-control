'use client'

import { useState } from 'react'
import ActivityFeed from '@/components/ActivityFeed'
import Calendar from '@/components/Calendar'
import Search from '@/components/Search'

type Tab = 'activity' | 'calendar' | 'search'

export default function Home() {
  const [activeTab, setActiveTab] = useState<Tab>('activity')

  return (
    <main className="min-h-screen p-4 max-w-4xl mx-auto">
      {/* Header */}
      <header className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Mission Control</h1>
        <p className="text-gray-400">Theo ⚔️ Agent Dashboard</p>
      </header>

      {/* Navigation */}
      <nav className="flex gap-2 mb-6 border-b border-gray-800 pb-4">
        <TabButton 
          active={activeTab === 'activity'} 
          onClick={() => setActiveTab('activity')}
        >
          📊 Activity
        </TabButton>
        <TabButton 
          active={activeTab === 'calendar'} 
          onClick={() => setActiveTab('calendar')}
        >
          📅 Calendar
        </TabButton>
        <TabButton 
          active={activeTab === 'search'} 
          onClick={() => setActiveTab('search')}
        >
          🔍 Search
        </TabButton>
      </nav>

      {/* Content */}
      <div className="min-h-[60vh]">
        {activeTab === 'activity' && <ActivityFeed />}
        {activeTab === 'calendar' && <Calendar />}
        {activeTab === 'search' && <Search />}
      </div>

      {/* Footer */}
      <footer className="mt-8 pt-4 border-t border-gray-800 text-gray-500 text-sm text-center">
        Sola Bible App • {new Date().toLocaleDateString()}
      </footer>
    </main>
  )
}

function TabButton({ 
  active, 
  onClick, 
  children 
}: { 
  active: boolean
  onClick: () => void
  children: React.ReactNode 
}) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 rounded-lg transition-colors ${
        active 
          ? 'bg-white text-black' 
          : 'bg-gray-900 text-gray-300 hover:bg-gray-800'
      }`}
    >
      {children}
    </button>
  )
}
