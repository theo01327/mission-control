'use client'

import { useEffect, useState } from 'react'
import { getActivities, Activity } from '@/lib/github'

export default function Calendar() {
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
    return <div className="text-gray-400">Loading calendar...</div>
  }

  // Get days of current week
  const today = new Date()
  const weekStart = new Date(today)
  weekStart.setDate(today.getDate() - today.getDay())
  
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(weekStart)
    date.setDate(weekStart.getDate() + i)
    return date
  })

  // Group activities by day
  const activitiesByDay = weekDays.map(day => {
    const dayStr = day.toISOString().split('T')[0]
    return {
      date: day,
      activities: activities.filter(a => {
        return a.created_at.startsWith(dayStr)
      })
    }
  })

  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">This Week</h2>
      
      <div className="grid grid-cols-7 gap-2">
        {/* Day headers */}
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
          <div key={day} className="text-center text-xs text-gray-500 font-medium py-2">
            {day}
          </div>
        ))}
        
        {/* Day cells */}
        {activitiesByDay.map(({ date, activities }) => {
          const isToday = date.toDateString() === today.toDateString()
          
          return (
            <div 
              key={date.toISOString()}
              className={`min-h-[100px] p-2 rounded-lg border ${
                isToday 
                  ? 'border-white bg-gray-900' 
                  : 'border-gray-800 bg-gray-950'
              }`}
            >
              <div className={`text-sm mb-2 ${isToday ? 'font-bold' : 'text-gray-400'}`}>
                {date.getDate()}
              </div>
              
              {activities.slice(0, 3).map(activity => (
                <div 
                  key={activity.id}
                  className="text-xs bg-blue-900/50 text-blue-200 rounded px-1 py-0.5 mb-1 truncate"
                  title={activity.title}
                >
                  {activity.title.slice(0, 20)}...
                </div>
              ))}
              {activities.length > 3 && (
                <div className="text-xs text-gray-500">
                  +{activities.length - 3} more
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Recent activity list */}
      <div className="mt-8">
        <h3 className="text-lg font-medium mb-3">Recent Activity</h3>
        {activities.length === 0 ? (
          <p className="text-gray-500">No recent activity</p>
        ) : (
          <div className="space-y-2">
            {activities.slice(0, 10).map(activity => (
              <div key={activity.id} className="bg-gray-900 rounded-lg p-3 border border-gray-800">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-medium">{activity.title}</h4>
                    {activity.sha && (
                      <p className="text-sm text-gray-400 font-mono">{activity.sha}</p>
                    )}
                  </div>
                  <span className="text-xs text-gray-500">
                    {new Date(activity.created_at).toLocaleString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
