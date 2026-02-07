import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import { readFile, writeFile } from 'fs/promises';

const execAsync = promisify(exec);

export const dynamic = 'force-dynamic';

const CACHE_PATH = '/tmp/cron-cache.json';
const CACHE_TTL = 30000; // 30 seconds

type CacheData = {
  jobs: any[];
  timestamp: number;
};

async function getCache(): Promise<CacheData | null> {
  try {
    const content = await readFile(CACHE_PATH, 'utf8');
    const cache = JSON.parse(content) as CacheData;
    if (Date.now() - cache.timestamp < CACHE_TTL) {
      return cache;
    }
  } catch {}
  return null;
}

async function setCache(jobs: any[]): Promise<void> {
  try {
    await writeFile(CACHE_PATH, JSON.stringify({ jobs, timestamp: Date.now() }));
  } catch {}
}

export async function GET() {
  try {
    // Check cache first
    const cached = await getCache();
    if (cached) {
      return NextResponse.json({ jobs: cached.jobs, cached: true });
    }
    
    // Fetch fresh data with timeout
    const { stdout } = await execAsync(
      'timeout 10 openclaw cron list --json 2>/dev/null || echo "{}"',
      { timeout: 15000 }
    );
    
    let jobs: any[] = [];
    try {
      const jsonMatch = stdout.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const data = JSON.parse(jsonMatch[0]);
        jobs = data.jobs || [];
      }
    } catch {}
    
    // Cache the result
    if (jobs.length > 0) {
      await setCache(jobs);
    }
    
    return NextResponse.json({ jobs });
  } catch (error) {
    console.error('Cron API error:', error);
    
    // Try to return stale cache on error
    try {
      const content = await readFile(CACHE_PATH, 'utf8');
      const cache = JSON.parse(content) as CacheData;
      return NextResponse.json({ jobs: cache.jobs, stale: true });
    } catch {}
    
    return NextResponse.json({ jobs: [], error: 'Failed to fetch' }, { status: 200 });
  }
}
