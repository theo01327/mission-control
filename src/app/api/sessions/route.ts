import { NextResponse } from 'next/server';
import { readdir, readFile, stat } from 'fs/promises';
import { join } from 'path';

export const dynamic = 'force-dynamic';

const SESSIONS_DIR = '/home/ec2-user/.openclaw/agents/main/sessions';

export async function GET() {
  try {
    const files = await readdir(SESSIONS_DIR).catch(() => []);
    
    const sessions = [];
    
    // Only look at active .jsonl files (not deleted)
    const activeFiles = files.filter(f => f.endsWith('.jsonl') && !f.includes('.deleted'));
    
    for (const file of activeFiles.slice(0, 30)) {
      try {
        const filePath = join(SESSIONS_DIR, file);
        const stats = await stat(filePath);
        
        // Read first line for session metadata
        const content = await readFile(filePath, 'utf8');
        const firstLine = content.split('\n')[0];
        
        if (firstLine) {
          try {
            const data = JSON.parse(firstLine);
            sessions.push({
              key: file.replace('.jsonl', ''),
              kind: data.kind || 'session',
              channel: data.channel || 'unknown',
              displayName: data.displayName || data.key || file.replace('.jsonl', '').slice(0, 8),
              model: data.model,
              updatedAt: stats.mtimeMs,
              totalTokens: data.totalTokens || 0,
            });
          } catch {
            // Not valid JSON in first line
          }
        }
      } catch {
        // Skip files we can't read
      }
    }
    
    // Sort by most recent
    sessions.sort((a, b) => b.updatedAt - a.updatedAt);
    
    return NextResponse.json({ sessions: sessions.slice(0, 20) });
  } catch (error) {
    console.error('Sessions API error:', error);
    return NextResponse.json({ sessions: [], error: 'Failed to fetch' }, { status: 200 });
  }
}
