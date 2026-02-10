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
  scheduledTime: string | null; // ISO timestamp
  scheduledLabel: string | null; // "Today 3pm", "Tomorrow 9am", etc.
};

function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .trim();
}

// Suggest optimal posting times for X (Pacific timezone)
function suggestPostTime(): { iso: string; label: string } {
  const now = new Date();
  const pacific = new Date(now.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }));
  const hour = pacific.getHours();
  
  // Optimal X posting times: 8am, 12pm, 5pm, 8pm Pacific
  const optimalHours = [8, 12, 17, 20];
  
  // Find next optimal time
  let targetHour = optimalHours.find(h => h > hour);
  let targetDate = new Date(pacific);
  
  if (!targetHour) {
    // All today's times passed, schedule for tomorrow
    targetHour = optimalHours[0];
    targetDate.setDate(targetDate.getDate() + 1);
  }
  
  targetDate.setHours(targetHour, 0, 0, 0);
  
  // Convert back to UTC for storage
  const utcDate = new Date(targetDate.toLocaleString('en-US', { timeZone: 'UTC' }));
  
  // Create label
  const isToday = targetDate.getDate() === pacific.getDate();
  const isTomorrow = targetDate.getDate() === pacific.getDate() + 1;
  const timeStr = targetHour <= 12 ? `${targetHour}am` : `${targetHour - 12}pm`;
  const dayStr = isToday ? 'Today' : isTomorrow ? 'Tomorrow' : targetDate.toLocaleDateString('en-US', { weekday: 'short' });
  
  return {
    iso: targetDate.toISOString(),
    label: `${dayStr} ${timeStr} PT`
  };
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
    
    // Extract assets - check for directory or file paths
    const assets: string[] = [];
    const assetsMatch = content.match(/## Assets\s*\n+([\s\S]*?)(?=\n---|\n##|$)/);
    if (assetsMatch) {
      const assetText = assetsMatch[1].trim();
      // Check if it's a directory path
      const dirMatch = assetText.match(/(\/home\/ec2-user\/clawd\/[^\s\n]+)/);
      if (dirMatch) {
        const dirPath = dirMatch[1].replace(/\/$/, '');
        if (fs.existsSync(dirPath) && fs.statSync(dirPath).isDirectory()) {
          // List image files in directory
          const files = fs.readdirSync(dirPath)
            .filter(f => /\.(png|jpg|jpeg|gif)$/i.test(f))
            .sort()
            .map(f => path.join(dirPath, f));
          assets.push(...files);
        }
      }
      // Also check for individual file paths
      const fileMatches = assetText.match(/\/home\/ec2-user\/clawd\/[^\s\n]+\.(png|jpg|jpeg|mp4|mov)/gi);
      if (fileMatches) {
        for (const filePath of fileMatches) {
          if (!assets.includes(filePath) && fs.existsSync(filePath)) {
            assets.push(filePath);
          }
        }
      }
    }
    
    // Get file stats
    const stats = fs.statSync(path.join(draftsDir, filename));
    
    // Extract scheduled time if present, or suggest one for X
    let scheduledTime: string | null = null;
    let scheduledLabel: string | null = null;
    const scheduledMatch = content.match(/\*\*Scheduled:\*\*\s*(.+)/);
    if (scheduledMatch) {
      const parsed = new Date(scheduledMatch[1].trim());
      if (!isNaN(parsed.getTime())) {
        scheduledTime = parsed.toISOString();
        scheduledLabel = scheduledMatch[1].trim();
      }
    } else if (platform === 'x') {
      // Auto-suggest time for X posts
      const suggested = suggestPostTime();
      scheduledTime = suggested.iso;
      scheduledLabel = suggested.label;
    }
    
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
      scheduledTime,
      scheduledLabel,
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
