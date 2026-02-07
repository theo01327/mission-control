import { NextResponse } from 'next/server';
import { readFile } from 'fs/promises';

export const dynamic = 'force-dynamic';

const WORK_QUEUE_PATH = '/home/ec2-user/clawd/work-queue.md';

type Task = {
  id: string;
  title: string;
  status: 'ready' | 'in-progress' | 'done' | 'blocked';
  assignee?: string;
  priority?: string;
  section: string;
};

export async function GET() {
  try {
    const content = await readFile(WORK_QUEUE_PATH, 'utf8');
    
    const tasks: Task[] = [];
    let currentSection = 'Uncategorized';
    let taskId = 0;
    
    const lines = content.split('\n');
    
    for (const line of lines) {
      // Section headers
      if (line.startsWith('## ')) {
        currentSection = line.replace('## ', '').trim();
        continue;
      }
      
      // Task lines - [ ], [x], [-], [>]
      const taskMatch = line.match(/^[-*]\s*\[([ x\->])\]\s*(.+)$/);
      if (taskMatch) {
        const [, marker, text] = taskMatch;
        
        let status: Task['status'] = 'ready';
        if (marker === 'x') status = 'done';
        else if (marker === '-') status = 'in-progress';
        else if (marker === '>') status = 'blocked';
        
        // Extract assignee if present (e.g., @dev-agent)
        const assigneeMatch = text.match(/@(\w+-?\w*)/);
        const assignee = assigneeMatch ? assigneeMatch[1] : undefined;
        
        // Extract priority if present (e.g., P1, P2)
        const priorityMatch = text.match(/\b(P[0-3])\b/);
        const priority = priorityMatch ? priorityMatch[1] : undefined;
        
        tasks.push({
          id: `task-${++taskId}`,
          title: text.replace(/@\w+-?\w*/, '').replace(/\bP[0-3]\b/, '').trim(),
          status,
          assignee,
          priority,
          section: currentSection,
        });
      }
    }
    
    return NextResponse.json({ tasks });
  } catch (error) {
    console.error('Tasks API error:', error);
    return NextResponse.json({ tasks: [], error: 'Failed to read work queue' }, { status: 200 });
  }
}
