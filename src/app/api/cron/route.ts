import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Use openclaw CLI to get cron jobs - extract only the JSON part
    const { stdout, stderr } = await execAsync(
      'openclaw cron list --json 2>/dev/null | grep -A 10000 "^{" | head -10000',
      { timeout: 15000 }
    );
    
    let jobs = [];
    try {
      // Find the JSON object in the output
      const jsonMatch = stdout.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const data = JSON.parse(jsonMatch[0]);
        jobs = data.jobs || [];
      }
    } catch (e) {
      console.error('Parse error:', e);
      jobs = [];
    }
    
    return NextResponse.json({ jobs });
  } catch (error) {
    console.error('Cron API error:', error);
    return NextResponse.json({ jobs: [], error: 'Failed to fetch' }, { status: 200 });
  }
}
