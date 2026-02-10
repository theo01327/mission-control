import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';
import fs from 'fs';
import path from 'path';

// Force dynamic rendering (reads from filesystem)
export const dynamic = 'force-dynamic';

const OUTREACH_BASE = '/home/ec2-user/clawd/projects/outreach-engine';

const PLATFORMS = {
  reddit: {
    draftsDir: `${OUTREACH_BASE}/reddit/drafts`,
    doneDir: `${OUTREACH_BASE}/reddit/done`,
    label: 'Reddit',
    color: 'orange',
  },
  instagram: {
    draftsDir: `${OUTREACH_BASE}/instagram/drafts`,
    doneDir: `${OUTREACH_BASE}/instagram/done`,
    label: 'Instagram',
    color: 'pink',
  },
  tiktok: {
    draftsDir: `${OUTREACH_BASE}/tiktok/drafts`,
    doneDir: `${OUTREACH_BASE}/tiktok/done`,
    label: 'TikTok',
    color: 'cyan',
  },
  x: {
    draftsDir: `${OUTREACH_BASE}/x/drafts`,
    doneDir: `${OUTREACH_BASE}/x/done`,
    label: 'X',
    color: 'blue',
  },
};

type Draft = {
  id: string;
  platform: string;
  filename: string;
  title: string;
  url: string;
  label: string;
  content: string;
  caption: string;
  hashtags: string;
  assets: string[];
  createdAt: number;
};

function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .trim();
}

function parseDraft(platform: string, filename: string, content: string, draftsDir: string): Draft | null {
  try {
    // Extract title
    const titleMatch = content.match(/^#\s+(.+?)(?:\n|$)/m);
    let title = titleMatch ? titleMatch[1] : filename;
    // Clean up title prefixes
    title = title.replace(/^(Reddit Comment|Instagram Post|TikTok Post|X Reply):\s*/i, '');
    
    // Extract URL (for Reddit/X)
    const urlMatch = content.match(/\*\*URL:\*\*\s*(https?:\/\/[^\s]+)/);
    const url = urlMatch ? urlMatch[1] : '';
    
    // Extract label (subreddit, username, etc.)
    let label = '';
    if (platform === 'reddit') {
      const subredditMatch = content.match(/r\/(\w+)/);
      label = subredditMatch ? `r/${subredditMatch[1]}` : '';
    } else if (platform === 'x') {
      const usernameMatch = content.match(/@(\w+)/);
      label = usernameMatch ? `@${usernameMatch[1]}` : '';
    } else if (platform === 'instagram' || platform === 'tiktok') {
      const typeMatch = content.match(/\*\*Type:\*\*\s*(\w+)/);
      label = typeMatch ? typeMatch[1] : 'post';
    }
    
    // Extract main content (Comment Draft, Content, or Reply section)
    let mainContent = '';
    const contentPatterns = [
      /## Comment Draft\s*\n+([\s\S]*?)(?=\n---|\n\*\*Value|\n## |$)/,
      /## Reply\s*\n+([\s\S]*?)(?=\n---|\n\*\*|\n## |$)/,
      /## Content\s*\n+([\s\S]*?)(?=\n---|\n\*\*|\n## |$)/,
    ];
    for (const pattern of contentPatterns) {
      const match = content.match(pattern);
      if (match) {
        mainContent = stripMarkdown(match[1].trim());
        break;
      }
    }
    
    // Extract caption (for Instagram/TikTok)
    let caption = '';
    const captionMatch = content.match(/## Caption\s*\n+([\s\S]*?)(?=\n---|\n##|$)/);
    if (captionMatch) {
      caption = captionMatch[1].trim();
    }
    
    // Extract hashtags
    let hashtags = '';
    const hashtagMatch = content.match(/## Hashtags\s*\n+([\s\S]*?)(?=\n---|\n##|$)/);
    if (hashtagMatch) {
      hashtags = hashtagMatch[1].trim();
    }
    
    // Extract assets
    const assets: string[] = [];
    const assetsMatch = content.match(/## Assets\s*\n+([\s\S]*?)(?=\n---|\n##|$)/);
    if (assetsMatch) {
      const assetLines = assetsMatch[1].trim().split('\n');
      for (const line of assetLines) {
        const pathMatch = line.match(/[\/\w\-\.]+\.(png|jpg|jpeg|mp4|mov)/i);
        if (pathMatch) assets.push(pathMatch[0]);
      }
    }
    
    // Get file stats
    const stats = fs.statSync(path.join(draftsDir, filename));
    
    return {
      id: `${platform}:${filename.replace('.md', '')}`,
      platform,
      filename,
      title,
      url,
      label,
      content: mainContent,
      caption,
      hashtags,
      assets,
      createdAt: stats.mtimeMs,
    };
  } catch (e) {
    console.error('Error parsing draft:', platform, filename, e);
    return null;
  }
}

export async function GET() {
  try {
    const allDrafts: Draft[] = [];
    const stats: Record<string, { pending: number; completed: number }> = {};
    
    for (const [platform, config] of Object.entries(PLATFORMS)) {
      stats[platform] = { pending: 0, completed: 0 };
      
      // Count completed
      if (fs.existsSync(config.doneDir)) {
        stats[platform].completed = fs.readdirSync(config.doneDir).filter(f => f.endsWith('.md')).length;
      }
      
      // Get pending drafts
      if (fs.existsSync(config.draftsDir)) {
        const files = fs.readdirSync(config.draftsDir).filter(f => f.endsWith('.md'));
        stats[platform].pending = files.length;
        
        for (const file of files) {
          const content = fs.readFileSync(path.join(config.draftsDir, file), 'utf-8');
          const draft = parseDraft(platform, file, content, config.draftsDir);
          if (draft && (draft.content || draft.caption)) {
            allDrafts.push(draft);
          }
        }
      }
    }
    
    // Sort by created date, newest first
    allDrafts.sort((a, b) => b.createdAt - a.createdAt);
    
    return NextResponse.json({ 
      drafts: allDrafts, 
      stats,
      platforms: PLATFORMS,
    });
  } catch (error) {
    console.error('Outreach API error:', error);
    return NextResponse.json({ drafts: [], stats: {}, platforms: PLATFORMS, error: 'Failed to load drafts' });
  }
}

// Mark a draft as done (move to done folder)
export async function POST(request: NextRequest) {
  try {
    const { id, action } = await request.json();
    
    if (action !== 'done') {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
    
    // Parse platform:filename from id
    const [platform, fileId] = id.split(':');
    if (!platform || !fileId || !PLATFORMS[platform as keyof typeof PLATFORMS]) {
      return NextResponse.json({ error: 'Invalid draft ID' }, { status: 400 });
    }
    
    const config = PLATFORMS[platform as keyof typeof PLATFORMS];
    const filename = `${fileId}.md`;
    const sourcePath = path.join(config.draftsDir, filename);
    const destPath = path.join(config.doneDir, filename);
    
    if (!fs.existsSync(sourcePath)) {
      return NextResponse.json({ error: 'Draft not found' }, { status: 404 });
    }
    
    // Create done directory if needed
    if (!fs.existsSync(config.doneDir)) {
      fs.mkdirSync(config.doneDir, { recursive: true });
    }
    
    // Move file
    fs.renameSync(sourcePath, destPath);
    
    return NextResponse.json({ success: true, id });
  } catch (error) {
    console.error('Outreach POST error:', error);
    return NextResponse.json({ error: 'Failed to mark as done' }, { status: 500 });
  }
}
