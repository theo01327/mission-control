import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';
import fs from 'fs';
import path from 'path';

const DRAFTS_DIR = '/home/ec2-user/clawd/projects/outreach-engine/reddit/drafts';
const DONE_DIR = '/home/ec2-user/clawd/projects/outreach-engine/reddit/done';

type Draft = {
  id: string;
  filename: string;
  title: string;
  url: string;
  subreddit: string;
  reply: string;
  createdAt: number;
};

function parseDraft(filename: string, content: string): Draft | null {
  try {
    // Extract title from first markdown heading
    const titleMatch = content.match(/^#\s+(.+?)(?:\n|$)/m);
    const title = titleMatch ? titleMatch[1].replace(/^Reddit Comment:\s*/i, '') : filename;
    
    // Extract URL
    const urlMatch = content.match(/\*\*URL:\*\*\s*(https?:\/\/[^\s]+)/);
    const url = urlMatch ? urlMatch[1] : '';
    
    // Extract subreddit from URL or target post line
    const subredditMatch = content.match(/r\/(\w+)/);
    const subreddit = subredditMatch ? subredditMatch[1] : 'unknown';
    
    // Extract the comment draft section
    const draftMatch = content.match(/## Comment Draft\s*\n+([\s\S]*?)(?=\n---|\n\*\*Value delivered|\n## |$)/);
    let reply = '';
    if (draftMatch) {
      reply = draftMatch[1].trim();
    }
    
    // Get file stats for date
    const stats = fs.statSync(path.join(DRAFTS_DIR, filename));
    
    return {
      id: filename.replace('.md', ''),
      filename,
      title,
      url,
      subreddit,
      reply,
      createdAt: stats.mtimeMs,
    };
  } catch (e) {
    console.error('Error parsing draft:', filename, e);
    return null;
  }
}

export async function GET() {
  try {
    if (!fs.existsSync(DRAFTS_DIR)) {
      return NextResponse.json({ drafts: [] });
    }
    
    const files = fs.readdirSync(DRAFTS_DIR).filter(f => f.endsWith('.md'));
    const drafts: Draft[] = [];
    
    for (const file of files) {
      const content = fs.readFileSync(path.join(DRAFTS_DIR, file), 'utf-8');
      const draft = parseDraft(file, content);
      if (draft && draft.url && draft.reply) {
        drafts.push(draft);
      }
    }
    
    // Sort by created date, newest first
    drafts.sort((a, b) => b.createdAt - a.createdAt);
    
    // Count completed
    let completedCount = 0;
    if (fs.existsSync(DONE_DIR)) {
      completedCount = fs.readdirSync(DONE_DIR).filter(f => f.endsWith('.md')).length;
    }
    
    return NextResponse.json({ drafts, completedCount });
  } catch (error) {
    console.error('Outreach API error:', error);
    return NextResponse.json({ drafts: [], completedCount: 0, error: 'Failed to load drafts' });
  }
}

// Mark a draft as done (move to done folder)
export async function POST(request: NextRequest) {
  try {
    const { id, action } = await request.json();
    
    if (action !== 'done') {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
    
    const filename = `${id}.md`;
    const sourcePath = path.join(DRAFTS_DIR, filename);
    const destPath = path.join(DONE_DIR, filename);
    
    if (!fs.existsSync(sourcePath)) {
      return NextResponse.json({ error: 'Draft not found' }, { status: 404 });
    }
    
    // Create done directory if it doesn't exist
    if (!fs.existsSync(DONE_DIR)) {
      fs.mkdirSync(DONE_DIR, { recursive: true });
    }
    
    // Move file to done folder
    fs.renameSync(sourcePath, destPath);
    
    return NextResponse.json({ success: true, id });
  } catch (error) {
    console.error('Outreach POST error:', error);
    return NextResponse.json({ error: 'Failed to mark as done' }, { status: 500 });
  }
}
