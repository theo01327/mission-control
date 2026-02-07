import { NextResponse } from 'next/server';
import { readdir, readFile, stat } from 'fs/promises';
import { join } from 'path';

export const dynamic = 'force-dynamic';

const AGENTS_DIR = '/home/ec2-user/.openclaw/agents';

type Agent = {
  id: string;
  name: string;
  configured: boolean;
  hasWorkspace: boolean;
  hasSoul: boolean;
  skillCount: number;
  sessionCount: number;
  lastActivity: number | null;
  description?: string;
};

export async function GET() {
  try {
    const agents: Agent[] = [];
    
    const entries = await readdir(AGENTS_DIR, { withFileTypes: true });
    
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      
      const agentPath = join(AGENTS_DIR, entry.name);
      const workspacePath = join(agentPath, 'workspace');
      const sessionsPath = join(agentPath, 'sessions');
      const skillsPath = join(workspacePath, 'skills');
      const soulPath = join(workspacePath, 'SOUL.md');
      
      // Check what exists
      let hasWorkspace = false;
      let hasSoul = false;
      let skillCount = 0;
      let sessionCount = 0;
      let lastActivity: number | null = null;
      let description: string | undefined;
      
      try {
        await stat(workspacePath);
        hasWorkspace = true;
        
        // Check for SOUL.md and extract description
        try {
          const soulContent = await readFile(soulPath, 'utf8');
          hasSoul = true;
          // Extract first paragraph after "## Overview" or first non-header line
          const lines = soulContent.split('\n').filter(l => l.trim() && !l.startsWith('#'));
          description = lines[0]?.slice(0, 150);
        } catch {}
        
        // Count skills
        try {
          const skills = await readdir(skillsPath);
          skillCount = skills.filter(s => !s.startsWith('.')).length;
        } catch {}
      } catch {}
      
      // Count sessions and get last activity
      try {
        const sessions = await readdir(sessionsPath);
        const activeFiles = sessions.filter(s => s.endsWith('.jsonl') && !s.includes('.deleted'));
        sessionCount = activeFiles.length;
        
        // Get most recent session
        if (activeFiles.length > 0) {
          const sessionStats = await Promise.all(
            activeFiles.slice(0, 5).map(async f => {
              try {
                const s = await stat(join(sessionsPath, f));
                return s.mtimeMs;
              } catch { return 0; }
            })
          );
          lastActivity = Math.max(...sessionStats);
        }
      } catch {}
      
      agents.push({
        id: entry.name,
        name: entry.name.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
        configured: hasWorkspace,
        hasWorkspace,
        hasSoul,
        skillCount,
        sessionCount,
        lastActivity,
        description,
      });
    }
    
    // Sort: main first, then by last activity
    agents.sort((a, b) => {
      if (a.id === 'main') return -1;
      if (b.id === 'main') return 1;
      return (b.lastActivity || 0) - (a.lastActivity || 0);
    });
    
    return NextResponse.json({ agents });
  } catch (error) {
    console.error('Agents API error:', error);
    return NextResponse.json({ agents: [], error: 'Failed to fetch' }, { status: 200 });
  }
}
