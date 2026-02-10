import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';

const execAsync = promisify(exec);

export const dynamic = 'force-dynamic';

const OUTREACH_BASE = '/home/ec2-user/clawd/projects/outreach-engine';
const X_ENV_PATH = `${OUTREACH_BASE}/x/.env`;

// Load X credentials from .env file
function loadCredentials(): { ct0: string; authToken: string } | null {
  try {
    if (!fs.existsSync(X_ENV_PATH)) return null;
    const content = fs.readFileSync(X_ENV_PATH, 'utf-8');
    const ct0Match = content.match(/X_CT0=(.+)/);
    const authMatch = content.match(/X_AUTH_TOKEN=(.+)/);
    if (ct0Match && authMatch) {
      return { ct0: ct0Match[1].trim(), authToken: authMatch[1].trim() };
    }
    return null;
  } catch {
    return null;
  }
}

// Extract tweet ID from URL
function extractTweetId(url: string): string | null {
  const match = url.match(/status\/(\d+)/);
  return match ? match[1] : null;
}

export async function POST(request: NextRequest) {
  try {
    const { action, draftId, text, replyToUrl, scheduleTime } = await request.json();
    
    const creds = loadCredentials();
    if (!creds) {
      return NextResponse.json({ error: 'X credentials not configured' }, { status: 500 });
    }
    
    if (action === 'post') {
      // Post immediately
      let command: string;
      
      if (replyToUrl) {
        // Reply to a specific tweet
        const tweetId = extractTweetId(replyToUrl);
        if (!tweetId) {
          return NextResponse.json({ error: 'Invalid tweet URL' }, { status: 400 });
        }
        command = `bird --auth-token "${creds.authToken}" --ct0 "${creds.ct0}" reply "${tweetId}" "${text.replace(/"/g, '\\"')}"`;
      } else {
        // New tweet
        command = `bird --auth-token "${creds.authToken}" --ct0 "${creds.ct0}" tweet "${text.replace(/"/g, '\\"')}"`;
      }
      
      try {
        const { stdout, stderr } = await execAsync(command, { timeout: 30000 });
        
        // Move draft to done if draftId provided
        if (draftId) {
          const [platform, fileId] = draftId.split(':');
          if (platform === 'x') {
            const sourcePath = path.join(OUTREACH_BASE, 'x/drafts', `${fileId}.md`);
            const destPath = path.join(OUTREACH_BASE, 'x/done', `${fileId}.md`);
            if (fs.existsSync(sourcePath)) {
              if (!fs.existsSync(path.join(OUTREACH_BASE, 'x/done'))) {
                fs.mkdirSync(path.join(OUTREACH_BASE, 'x/done'), { recursive: true });
              }
              fs.renameSync(sourcePath, destPath);
            }
          }
        }
        
        return NextResponse.json({ 
          success: true, 
          message: 'Posted successfully',
          output: stdout || stderr
        });
      } catch (execError: any) {
        console.error('Bird exec error:', execError);
        return NextResponse.json({ 
          error: 'Failed to post', 
          details: execError.message || execError.stderr 
        }, { status: 500 });
      }
    }
    
    if (action === 'schedule') {
      // Schedule for later using OpenClaw cron
      if (!scheduleTime) {
        return NextResponse.json({ error: 'Schedule time required' }, { status: 400 });
      }
      
      // For now, return info about scheduling
      // Full cron integration would require more setup
      return NextResponse.json({ 
        success: true, 
        message: `Scheduled for ${scheduleTime}`,
        note: 'Scheduling feature coming soon - use Post Now for immediate posting'
      });
    }
    
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('X-post API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Check if credentials are configured
export async function GET() {
  const creds = loadCredentials();
  return NextResponse.json({ 
    configured: !!creds,
    account: creds ? '@SolaBibleApp' : null
  });
}
