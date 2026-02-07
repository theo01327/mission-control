'use client'

import { useEffect, useState } from 'react'
import { supabase, ScheduledTask } from '@/lib/supabase'

export default function Calendar() {
  const [tasks, setTasks] = useState<ScheduledTask[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadTasks()
  }, [])

  async function loadTasks() {
    const { data, error } = await supabase
      .from('scheduled_tasks')
      .select('*')
      .eq('enabled', true)
      .order('next_run_at', { ascending: true })

    if (error) {
      console.error('Error loading tasks:', error)
    } else {
      setTasks(data || [])
    }
    setLoading(false)
  }

  if (loading) {
    return <div className="text-gray-400">Loading scheduled tasks...</div>
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

  // Group tasks by day
  const tasksByDay = weekDays.map(day => {
    const dayStr = day.toISOString().split('T')[0]
    return {
      date: day,
      tasks: tasks.filter(task => {
        if (!task.next_run_at) return false
        return task.next_run_at.startsWith(dayStr)
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
        {tasksByDay.map(({ date, tasks }) => {
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
              
              {tasks.map(task => (
                <div 
                  key={task.id}
                  className="text-xs bg-blue-900/50 text-blue-200 rounded px-1 py-0.5 mb-1 truncate"
                  title={task.name}
                >
                  {task.next_run_at && new Date(task.next_run_at).toLocaleTimeString([], { 
                    hour: '2-digit', 
                    minute: '2-digit' 
                  })}
                  {' '}{task.name}
                </div>
              ))}
            </div>
          )
        })}
      </div>

      {/* Upcoming tasks list */}
      <div className="mt-8">
        <h3 className="text-lg font-medium mb-3">Upcoming Tasks</h3>
        {tasks.length === 0 ? (
          <p className="text-gray-500">No scheduled tasks</p>
        ) : (
          <div className="space-y-2">
            {tasks.slice(0, 10).map(task => (
              <div key={task.id} className="bg-gray-900 rounded-lg p-3 border border-gray-800">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-medium">{task.name}</h4>
                    {task.description && (
                      <p className="text-sm text-gray-400">{task.description}</p>
                    )}
                  </div>
                  <span className="text-xs text-gray-500">
                    {task.next_run_at && new Date(task.next_run_at).toLocaleString()}
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
