import { NextResponse } from 'next/server';
import { readFile, stat } from 'fs/promises';

export const dynamic = 'force-dynamic';

const CONFIG_PATH = '/home/ec2-user/.openclaw/openclaw.json';
const MAIN_SESSION = '/home/ec2-user/.openclaw/agents/main/sessions/2a21c0fb-1fc6-42a9-a524-61c6126ae830.jsonl';

export async function GET() {
  try {
    // Read config for heartbeat settings
    const configContent = await readFile(CONFIG_PATH, 'utf8');
    const config = JSON.parse(configContent);
    
    const heartbeatConfig = 
      config?.agents?.main?.heartbeat || 
      config?.agents?.defaults?.heartbeat || 
      {};
    
    // Get last activity from main session file
    let lastActivity: number | null = null;
    try {
      const sessionStat = await stat(MAIN_SESSION);
      lastActivity = sessionStat.mtimeMs;
    } catch {}
    
    // Calculate next heartbeat based on interval
    const intervalMs = parseInterval(heartbeatConfig.every || '30m');
    const nextHeartbeat = lastActivity ? lastActivity + intervalMs : null;
    
    // Simple run tracking - last few activity windows
    const now = Date.now();
    const runs = [];
    
    if (lastActivity) {
      // Estimate recent heartbeats based on interval
      let runTime = lastActivity;
      for (let i = 0; i < 5; i++) {
        if (runTime < now - 24 * 60 * 60 * 1000) break; // Only last 24h
        runs.push({
          timestamp: runTime,
          response: 'Session activity',
          status: 'ok' as const,
          model: heartbeatConfig.model || 'gemini-2.0-flash',
        });
        runTime -= intervalMs;
      }
    }
    
    return NextResponse.json({
      config: {
        every: heartbeatConfig.every || '30m',
        model: heartbeatConfig.model || 'default',
        activeHours: heartbeatConfig.activeHours || { start: '00:00', end: '23:59' },
        target: heartbeatConfig.target || 'last',
      },
      lastHeartbeat: lastActivity,
      nextHeartbeat,
      status: 'active',
      runs,
    });
  } catch (error) {
    console.error('Heartbeat API error:', error);
    return NextResponse.json({ 
      config: { every: '30m' },
      status: 'unknown',
      runs: [],
      error: 'Failed to read' 
    }, { status: 200 });
  }
}

function parseInterval(interval: string): number {
  const match = interval.match(/^(\d+)(m|h|s)$/);
  if (!match) return 30 * 60 * 1000;
  
  const value = parseInt(match[1]);
  const unit = match[2];
  
  switch (unit) {
    case 's': return value * 1000;
    case 'm': return value * 60 * 1000;
    case 'h': return value * 60 * 60 * 1000;
    default: return 30 * 60 * 1000;
  }
}
