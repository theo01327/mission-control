import { NextResponse } from 'next/server';
import { readdir, readFile, stat } from 'fs/promises';
import { join } from 'path';

export const dynamic = 'force-dynamic';

const PROJECTS_DIR = '/home/ec2-user/clawd/projects';

type Project = {
  id: string;
  name: string;
  description?: string;
  status?: string;
  hasReadme: boolean;
  files: number;
  updatedAt: number;
};

export async function GET() {
  try {
    const entries = await readdir(PROJECTS_DIR, { withFileTypes: true });
    const projects: Project[] = [];
    
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      
      const projectPath = join(PROJECTS_DIR, entry.name);
      const projectFiles = await readdir(projectPath).catch(() => []);
      const stats = await stat(projectPath);
      
      let description: string | undefined;
      let status: string | undefined;
      
      // Try PROJECT.md first, then README.md
      for (const readmeFile of ['PROJECT.md', 'README.md']) {
        try {
          const content = await readFile(join(projectPath, readmeFile), 'utf8');
          
          // Extract status (e.g., "## Status: ACTIVE")
          const statusMatch = content.match(/##\s*Status:\s*(\w+)/i);
          if (statusMatch) status = statusMatch[1].trim();
          
          // Extract overview/description (first paragraph after ## Overview)
          const overviewMatch = content.match(/##\s*Overview\s*\n+([^\n#]+)/i);
          if (overviewMatch) {
            description = overviewMatch[1].trim().slice(0, 150);
          } else {
            // Fallback: first non-header, non-status line
            const lines = content.split('\n').filter(l => 
              l.trim() && 
              !l.startsWith('#') && 
              !l.toLowerCase().includes('status:') &&
              !l.toLowerCase().includes('created:')
            );
            description = lines[0]?.slice(0, 150);
          }
          break;
        } catch {}
      }
      
      projects.push({
        id: entry.name,
        name: entry.name.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
        description,
        status,
        hasReadme: projectFiles.some(f => f === 'PROJECT.md' || f === 'README.md'),
        files: projectFiles.length,
        updatedAt: stats.mtimeMs,
      });
    }
    
    // Sort: ACTIVE first, then by most recently updated
    projects.sort((a, b) => {
      const aActive = a.status?.toUpperCase() === 'ACTIVE' ? 1 : 0;
      const bActive = b.status?.toUpperCase() === 'ACTIVE' ? 1 : 0;
      if (aActive !== bActive) return bActive - aActive;
      return b.updatedAt - a.updatedAt;
    });
    
    return NextResponse.json({ projects });
  } catch (error) {
    console.error('Projects API error:', error);
    return NextResponse.json({ projects: [], error: 'Failed to fetch' }, { status: 200 });
  }
}
