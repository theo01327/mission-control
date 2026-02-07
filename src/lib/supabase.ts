import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export type Activity = {
  id: string
  created_at: string
  action_type: string
  title: string
  description: string | null
  metadata: Record<string, any>
  session_key: string | null
  cost_usd: number | null
  tokens_used: number | null
}

export type ScheduledTask = {
  id: string
  cron_job_id: string
  name: string
  description: string | null
  schedule_type: string
  schedule_config: Record<string, any>
  next_run_at: string | null
  last_run_at: string | null
  enabled: boolean
}
