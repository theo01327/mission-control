import { NextResponse } from 'next/server';
import { readdir, readFile, stat } from 'fs/promises';
import { join } from 'path';

export const dynamic = 'force-dynamic';

const AGENTS_DIR = '/home/ec2-user/.openclaw/agents';

type Session = {
  id: string;
  key: string;
  agent: string;
  kind: string;
  channel: string;
  displayName?: string;
  model?: string;
  updatedAt: number;
  totalTokens: number;
  messageCount: number;
  recentMessages: { role: string; preview: string; timestamp: number }[];
};

async function getSessionsForAgent(agentName: string): Promise<Session[]> {
  const sessions: Session[] = [];
  const sessionsDir = join(AGENTS_DIR, agentName, 'sessions');
  
  try {
    const files = await readdir(sessionsDir);
    const activeFiles = files.filter(f => f.endsWith('.jsonl') && !f.includes('.deleted'));
    
    for (const file of activeFiles.slice(0, 20)) {
      try {
        const filePath = join(sessionsDir, file);
        const stats = await stat(filePath);
        const content = await readFile(filePath, 'utf8');
        const lines = content.split('\n').filter(Boolean);
        
        if (lines.length === 0) continue;
        
        // Parse session metadata from first line
        const firstLine = JSON.parse(lines[0]);
        
        // Get message count and recent messages
        let messageCount = 0;
        const recentMessages: Session['recentMessages'] = [];
        
        for (let i = lines.length - 1; i >= 0 && recentMessages.length < 3; i--) {
          try {
            const entry = JSON.parse(lines[i]);
            if (entry.type === 'message' && entry.message) {
              messageCount++;
              const msg = entry.message;
              
              if (msg.role === 'user' || msg.role === 'assistant') {
                let preview = '';
                if (Array.isArray(msg.content)) {
                  const textPart = msg.content.find((c: any) => c.type === 'text');
                  preview = textPart?.text?.slice(0, 100) || '';
                } else if (typeof msg.content === 'string') {
                  preview = msg.content.slice(0, 100);
                }
                
                if (preview && recentMessages.length < 3) {
                  recentMessages.unshift({
                    role: msg.role,
                    preview: preview.replace(/\n/g, ' '),
                    timestamp: new Date(entry.timestamp).getTime(),
                  });
                }
              }
            }
          } catch {}
        }
        
        // Count all messages
        messageCount = lines.filter(l => l.includes('"type":"message"')).length;
        
        sessions.push({
          id: file.replace('.jsonl', ''),
          key: firstLine.key || file.replace('.jsonl', ''),
          agent: agentName,
          kind: firstLine.kind || 'session',
          channel: firstLine.channel || 'unknown',
          displayName: firstLine.displayName || file.replace('.jsonl', '').slice(0, 8),
          model: firstLine.model,
          updatedAt: stats.mtimeMs,
          totalTokens: firstLine.totalTokens || 0,
          messageCount,
          recentMessages,
        });
      } catch {}
    }
  } catch {}
  
  return sessions;
}

export async function GET() {
  try {
    const allSessions: Session[] = [];
    
    // Get sessions from all agents
    const agentDirs = await readdir(AGENTS_DIR, { withFileTypes: true });
    
    for (const agentDir of agentDirs) {
      if (!agentDir.isDirectory()) continue;
      
      const sessions = await getSessionsForAgent(agentDir.name);
      allSessions.push(...sessions);
    }
    
    // Sort by most recent
    allSessions.sort((a, b) => b.updatedAt - a.updatedAt);
    
    return NextResponse.json({ sessions: allSessions.slice(0, 30) });
  } catch (error) {
    console.error('Sessions API error:', error);
    return NextResponse.json({ sessions: [], error: 'Failed to fetch' }, { status: 200 });
  }
}
