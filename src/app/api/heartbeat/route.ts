import { NextResponse } from 'next/server';
import { readFile } from 'fs/promises';

export const dynamic = 'force-dynamic';

const CONFIG_PATH = '/home/ec2-user/.openclaw/openclaw.json';
const STATE_PATH = '/home/ec2-user/.openclaw/agents/main/agent/state.json';

export async function GET() {
  try {
    // Read config for heartbeat settings
    const configContent = await readFile(CONFIG_PATH, 'utf8');
    const config = JSON.parse(configContent);
    
    const heartbeatConfig = 
      config?.agents?.main?.heartbeat || 
      config?.agents?.defaults?.heartbeat || 
      {};
    
    // Try to read agent state for last heartbeat info
    let lastHeartbeat: number | null = null;
    let nextHeartbeat: number | null = null;
    
    try {
      const stateContent = await readFile(STATE_PATH, 'utf8');
      const state = JSON.parse(stateContent);
      lastHeartbeat = state?.lastHeartbeatAt || state?.lastPollAt || null;
      
      // Calculate next heartbeat
      if (lastHeartbeat && heartbeatConfig.every) {
        const intervalMs = parseInterval(heartbeatConfig.every);
        nextHeartbeat = lastHeartbeat + intervalMs;
      }
    } catch {
      // State file may not exist
    }
    
    return NextResponse.json({
      config: {
        every: heartbeatConfig.every || '30m',
        model: heartbeatConfig.model || 'default',
        activeHours: heartbeatConfig.activeHours || { start: '00:00', end: '23:59' },
        target: heartbeatConfig.target || 'last',
      },
      lastHeartbeat,
      nextHeartbeat,
      status: 'active',
    });
  } catch (error) {
    console.error('Heartbeat API error:', error);
    return NextResponse.json({ 
      config: { every: '30m' },
      status: 'unknown',
      error: 'Failed to read config' 
    }, { status: 200 });
  }
}

function parseInterval(interval: string): number {
  const match = interval.match(/^(\d+)(m|h|s)$/);
  if (!match) return 30 * 60 * 1000; // Default 30m
  
  const value = parseInt(match[1]);
  const unit = match[2];
  
  switch (unit) {
    case 's': return value * 1000;
    case 'm': return value * 60 * 1000;
    case 'h': return value * 60 * 60 * 1000;
    default: return 30 * 60 * 1000;
  }
}
