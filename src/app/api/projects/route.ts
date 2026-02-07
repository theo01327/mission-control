import { NextResponse } from 'next/server';
import { readdir, readFile, stat } from 'fs/promises';
import { join } from 'path';

export const dynamic = 'force-dynamic';

const PROJECTS_DIR = '/home/ec2-user/clawd/projects';

type ProjectFile = {
  name: string;
  path: string;
  size: number;
  isMarkdown: boolean;
};

type Project = {
  id: string;
  name: string;
  description?: string;
  status?: string;
  files: number;
  updatedAt: number;
  markdownFiles: ProjectFile[];
};

async function getMarkdownFiles(dir: string, baseDir: string, depth = 0): Promise<ProjectFile[]> {
  if (depth > 2) return []; // Max 2 levels deep
  
  const files: ProjectFile[] = [];
  
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
      
      const fullPath = join(dir, entry.name);
      const relativePath = fullPath.replace(baseDir + '/', '');
      
      if (entry.isFile() && entry.name.endsWith('.md')) {
        const stats = await stat(fullPath);
        files.push({
          name: entry.name,
          path: relativePath,
          size: stats.size,
          isMarkdown: true,
        });
      } else if (entry.isDirectory() && depth < 2) {
        const subFiles = await getMarkdownFiles(fullPath, baseDir, depth + 1);
        files.push(...subFiles);
      }
    }
  } catch {}
  
  return files;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const fileParam = searchParams.get('file');
  const projectParam = searchParams.get('project');
  
  // If requesting specific file content
  if (fileParam && projectParam) {
    try {
      const filePath = join(PROJECTS_DIR, projectParam, fileParam);
      // Security: ensure path is within projects dir
      if (!filePath.startsWith(PROJECTS_DIR)) {
        return NextResponse.json({ error: 'Invalid path' }, { status: 400 });
      }
      const content = await readFile(filePath, 'utf8');
      return NextResponse.json({ content, path: fileParam });
    } catch {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }
  }
  
  // List all projects
  try {
    const projects: Project[] = [];
    const entries = await readdir(PROJECTS_DIR, { withFileTypes: true });
    
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name.startsWith('.')) continue;
      
      const projectPath = join(PROJECTS_DIR, entry.name);
      const projectMdPath = join(projectPath, 'PROJECT.md');
      
      let description: string | undefined;
      let status: string | undefined;
      
      try {
        const content = await readFile(projectMdPath, 'utf8');
        
        // Extract status
        const statusMatch = content.match(/##\s*Status:\s*(\w+)/i);
        if (statusMatch) status = statusMatch[1].toUpperCase();
        
        // Extract overview/description
        const overviewMatch = content.match(/##\s*Overview\s*\n+([^\n#]+)/i);
        if (overviewMatch) description = overviewMatch[1].trim().slice(0, 150);
        
        if (!description) {
          const lines = content.split('\n').filter(l => l.trim() && !l.startsWith('#'));
          description = lines[0]?.slice(0, 150);
        }
      } catch {}
      
      // Get all files count
      let fileCount = 0;
      try {
        const allFiles = await readdir(projectPath, { recursive: true });
        fileCount = allFiles.length;
      } catch {}
      
      // Get markdown files
      const markdownFiles = await getMarkdownFiles(projectPath, projectPath);
      
      const stats = await stat(projectPath);
      
      projects.push({
        id: entry.name,
        name: entry.name.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
        description,
        status,
        files: fileCount,
        updatedAt: stats.mtimeMs,
        markdownFiles: markdownFiles.slice(0, 20), // Limit to 20 files
      });
    }
    
    // Sort: ACTIVE first, then by updated
    projects.sort((a, b) => {
      if (a.status === 'ACTIVE' && b.status !== 'ACTIVE') return -1;
      if (a.status !== 'ACTIVE' && b.status === 'ACTIVE') return 1;
      return b.updatedAt - a.updatedAt;
    });
    
    return NextResponse.json({ projects });
  } catch (error) {
    console.error('Projects API error:', error);
    return NextResponse.json({ projects: [], error: 'Failed to fetch' }, { status: 200 });
  }
}
