import { NextResponse } from 'next/server';
import { readdir, readFile, stat } from 'fs/promises';
import { join } from 'path';

export const dynamic = 'force-dynamic';

const SKILLS_DIR = '/home/ec2-user/clawd/skills';

type Skill = {
  id: string;
  name: string;
  description?: string;
  hasReadme: boolean;
  files: number;
  updatedAt: number;
};

export async function GET() {
  try {
    const entries = await readdir(SKILLS_DIR, { withFileTypes: true });
    const skills: Skill[] = [];
    
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      
      const skillPath = join(SKILLS_DIR, entry.name);
      const skillFiles = await readdir(skillPath).catch(() => []);
      const stats = await stat(skillPath);
      
      // Try to read SKILL.md or README.md for description
      let description: string | undefined;
      for (const readmeFile of ['SKILL.md', 'README.md']) {
        try {
          const content = await readFile(join(skillPath, readmeFile), 'utf8');
          // Get first paragraph or first 150 chars
          const lines = content.split('\n').filter(l => l.trim() && !l.startsWith('#'));
          description = lines[0]?.slice(0, 150);
          break;
        } catch {}
      }
      
      skills.push({
        id: entry.name,
        name: entry.name.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
        description,
        hasReadme: skillFiles.some(f => f.endsWith('.md')),
        files: skillFiles.length,
        updatedAt: stats.mtimeMs,
      });
    }
    
    // Sort by most recently updated
    skills.sort((a, b) => b.updatedAt - a.updatedAt);
    
    return NextResponse.json({ skills });
  } catch (error) {
    console.error('Skills API error:', error);
    return NextResponse.json({ skills: [], error: 'Failed to fetch' }, { status: 200 });
  }
}
