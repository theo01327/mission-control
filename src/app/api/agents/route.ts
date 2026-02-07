import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // List agents from the agents directory
    const { stdout } = await execAsync(
      'ls -1 /home/ec2-user/.openclaw/agents/ 2>/dev/null || echo ""',
      { timeout: 5000 }
    );
    
    const agentDirs = stdout.trim().split('\n').filter(Boolean);
    
    const agents = agentDirs.map(id => ({
      id,
      configured: true, // If the directory exists, it's configured
    }));
    
    return NextResponse.json({ agents });
  } catch (error) {
    console.error('Agents API error:', error);
    return NextResponse.json({ agents: [], error: 'Failed to fetch' }, { status: 200 });
  }
}
