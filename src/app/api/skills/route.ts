import { NextResponse } from 'next/server';
import { readdir, readFile, stat } from 'fs/promises';
import { join } from 'path';

export const dynamic = 'force-dynamic';

// Skill locations by agent
const SKILL_PATHS = [
  { agent: 'main', path: '/home/ec2-user/clawd/skills' },
  { agent: 'main (global)', path: '/home/ec2-user/.npm-global/lib/node_modules/openclaw/skills' },
];

// Also check sub-agent workspaces
const AGENTS_DIR = '/home/ec2-user/.openclaw/agents';

type Skill = {
  id: string;
  name: string;
  description?: string;
  agent: string;
  hasReadme: boolean;
  files: number;
  updatedAt: number;
};

async function getSkillsFromPath(basePath: string, agent: string): Promise<Skill[]> {
  const skills: Skill[] = [];
  
  try {
    const entries = await readdir(basePath, { withFileTypes: true });
    
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      
      const skillPath = join(basePath, entry.name);
      const skillFiles = await readdir(skillPath).catch(() => []);
      const stats = await stat(skillPath);
      
      let description: string | undefined;
      for (const readmeFile of ['SKILL.md', 'README.md']) {
        try {
          const content = await readFile(join(skillPath, readmeFile), 'utf8');
          const lines = content.split('\n').filter(l => l.trim() && !l.startsWith('#'));
          description = lines[0]?.slice(0, 150);
          break;
        } catch {}
      }
      
      skills.push({
        id: `${agent}:${entry.name}`,
        name: entry.name.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
        description,
        agent,
        hasReadme: skillFiles.some(f => f.endsWith('.md')),
        files: skillFiles.length,
        updatedAt: stats.mtimeMs,
      });
    }
  } catch {}
  
  return skills;
}

export async function GET() {
  try {
    const allSkills: Skill[] = [];
    
    // Get main agent skills
    for (const { agent, path } of SKILL_PATHS) {
      const skills = await getSkillsFromPath(path, agent);
      allSkills.push(...skills);
    }
    
    // Get sub-agent skills
    try {
      const agentDirs = await readdir(AGENTS_DIR, { withFileTypes: true });
      
      for (const agentDir of agentDirs) {
        if (!agentDir.isDirectory() || agentDir.name === 'main') continue;
        
        const skillsPath = join(AGENTS_DIR, agentDir.name, 'workspace', 'skills');
        const skills = await getSkillsFromPath(skillsPath, agentDir.name);
        allSkills.push(...skills);
      }
    } catch {}
    
    // Sort: main skills first, then by name
    allSkills.sort((a, b) => {
      if (a.agent.startsWith('main') && !b.agent.startsWith('main')) return -1;
      if (!a.agent.startsWith('main') && b.agent.startsWith('main')) return 1;
      return a.name.localeCompare(b.name);
    });
    
    return NextResponse.json({ skills: allSkills });
  } catch (error) {
    console.error('Skills API error:', error);
    return NextResponse.json({ skills: [], error: 'Failed to fetch' }, { status: 200 });
  }
}
