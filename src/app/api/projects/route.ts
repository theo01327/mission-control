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
      
      // Try to read PROJECT.md or README.md for description and status
      let description: string | undefined;
      let status: string | undefined;
      
      for (const readmeFile of ['PROJECT.md', 'README.md']) {
        try {
          const content = await readFile(join(projectPath, readmeFile), 'utf8');
          
          // Extract status if present (e.g., "Status: Active")
          const statusMatch = content.match(/Status:\s*(.+)/i);
          if (statusMatch) status = statusMatch[1].trim();
          
          // Get description from first non-header paragraph
          const lines = content.split('\n').filter(l => l.trim() && !l.startsWith('#') && !l.startsWith('Status:'));
          description = lines[0]?.slice(0, 150);
          break;
        } catch {}
      }
      
      projects.push({
        id: entry.name,
        name: entry.name.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
        description,
        status,
        hasReadme: projectFiles.some(f => f.endsWith('.md')),
        files: projectFiles.length,
        updatedAt: stats.mtimeMs,
      });
    }
    
    // Sort by most recently updated
    projects.sort((a, b) => b.updatedAt - a.updatedAt);
    
    return NextResponse.json({ projects });
  } catch (error) {
    console.error('Projects API error:', error);
    return NextResponse.json({ projects: [], error: 'Failed to fetch' }, { status: 200 });
  }
}
