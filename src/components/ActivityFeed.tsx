'use client'

import { useEffect, useState } from 'react'
import { getActivities, Activity } from '@/lib/github'

export default function ActivityFeed() {
  const [activities, setActivities] = useState<Activity[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadActivities()
  }, [])

  async function loadActivities() {
    const data = await getActivities()
    setActivities(data)
    setLoading(false)
  }

  if (loading) {
    return <div className="text-gray-400">Loading activities...</div>
  }

  if (activities.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-400 mb-4">No activities yet</p>
        <p className="text-gray-600 text-sm">
          Activities will appear here as Theo works
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {activities.map((activity) => (
        <ActivityCard key={activity.id} activity={activity} />
      ))}
    </div>
  )
}

function ActivityCard({ activity }: { activity: Activity }) {
  const typeIcons: Record<string, string> = {
    commit: '📝',
    task: '✅',
    message: '💬',
    file: '📄',
    search: '🔍',
    cron: '⏰',
    error: '❌',
  }

  const icon = typeIcons[activity.action_type] || '📌'
  const time = new Date(activity.created_at).toLocaleTimeString()
  const date = new Date(activity.created_at).toLocaleDateString()

  return (
    <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
      <div className="flex items-start gap-3">
        <span className="text-2xl">{icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-medium truncate">{activity.title}</h3>
            {activity.sha && (
              <span className="text-xs text-gray-500 bg-gray-800 px-2 py-0.5 rounded font-mono">
                {activity.sha}
              </span>
            )}
          </div>
          <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
            <span>{date} {time}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
