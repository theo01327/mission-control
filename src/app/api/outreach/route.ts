import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const DRAFTS_DIR = '/home/ec2-user/clawd/projects/outreach-engine/reddit/drafts';

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
    
    return NextResponse.json({ drafts });
  } catch (error) {
    console.error('Outreach API error:', error);
    return NextResponse.json({ drafts: [], error: 'Failed to load drafts' });
  }
}
