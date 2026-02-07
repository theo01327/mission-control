import { NextResponse } from 'next/server';
import { readFile } from 'fs/promises';

export const dynamic = 'force-dynamic';

const WORK_QUEUE_PATH = '/home/ec2-user/clawd/work-queue.md';

type Task = {
  id: string;
  title: string;
  status: 'ready' | 'in-progress' | 'blocked' | 'done';
  assignee?: string;
  project?: string;
  priority?: string;
  section: string;
  completedAt?: string;
  deliverable?: string;
};

export async function GET() {
  try {
    const content = await readFile(WORK_QUEUE_PATH, 'utf8');
    
    const tasks: Task[] = [];
    let currentSection = 'Uncategorized';
    
    const lines = content.split('\n');
    
    for (const line of lines) {
      // Section headers (## 📋 Ready, ## 🔄 In Progress, etc.)
      if (line.startsWith('## ')) {
        const sectionMatch = line.match(/##\s*[^\s]+\s*(.+)/);
        if (sectionMatch) {
          currentSection = sectionMatch[1].trim();
        }
        continue;
      }
      
      // Task lines - [ ] or [x]
      const taskMatch = line.match(/^-\s*\[([ x])\]\s*(.+)$/);
      if (taskMatch) {
        const [, marker, text] = taskMatch;
        const isDone = marker === 'x';
        
        // Parse TASK-XXX: Description @agent #project P0/P1/P2
        const idMatch = text.match(/TASK-(\d+)/);
        const assigneeMatch = text.match(/@(\w+-?\w*)/);
        const projectMatch = text.match(/#([\w-]+)/);
        const priorityMatch = text.match(/\b(P[0-2])\b/);
        const completedMatch = text.match(/Done\s+(\d{4}-\d{2}-\d{2})/i);
        
        // Extract title (between TASK-XXX: and first @/#/P0)
        let title = text;
        const colonIndex = text.indexOf(':');
        if (colonIndex !== -1) {
          const afterColon = text.slice(colonIndex + 1);
          const endIndex = afterColon.search(/\s+[@#P]/);
          title = endIndex !== -1 ? afterColon.slice(0, endIndex).trim() : afterColon.split('@')[0].split('#')[0].trim();
        }
        
        // Determine status from section
        let status: Task['status'] = 'ready';
        if (currentSection.toLowerCase().includes('progress')) status = 'in-progress';
        else if (currentSection.toLowerCase().includes('blocked')) status = 'blocked';
        else if (currentSection.toLowerCase().includes('done') || isDone) status = 'done';
        
        tasks.push({
          id: idMatch ? `TASK-${idMatch[1]}` : `task-${tasks.length + 1}`,
          title,
          status,
          assignee: assigneeMatch ? assigneeMatch[1] : undefined,
          project: projectMatch ? projectMatch[1] : undefined,
          priority: priorityMatch ? priorityMatch[1] : undefined,
          section: currentSection,
          completedAt: completedMatch ? completedMatch[1] : undefined,
        });
      }
    }
    
    return NextResponse.json({ tasks });
  } catch (error) {
    console.error('Tasks API error:', error);
    return NextResponse.json({ tasks: [], error: 'Failed to read' }, { status: 200 });
  }
}
