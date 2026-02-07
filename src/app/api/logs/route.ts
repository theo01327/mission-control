import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const jobId = searchParams.get('jobId');
  const limit = searchParams.get('limit') || '5';
  
  try {
    // If specific job requested, get just that one
    if (jobId) {
      const { stdout } = await execAsync(
        `openclaw cron runs --id ${jobId} --limit ${limit} 2>/dev/null`,
        { timeout: 15000 }
      );
      
      const jsonMatch = stdout.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const data = JSON.parse(jsonMatch[0]);
        return NextResponse.json(data);
      }
      return NextResponse.json({ entries: [] });
    }
    
    // Otherwise, get logs from all jobs
    // First get the job list
    const { stdout: jobsOut } = await execAsync(
      'openclaw cron list --json 2>/dev/null',
      { timeout: 15000 }
    );
    
    const jobsMatch = jobsOut.match(/\{[\s\S]*\}/);
    if (!jobsMatch) {
      return NextResponse.json({ entries: [] });
    }
    
    const jobsData = JSON.parse(jobsMatch[0]);
    const jobs = jobsData.jobs || [];
    
    // Get recent runs for each job
    const allEntries: any[] = [];
    
    for (const job of jobs.slice(0, 10)) { // Limit to 10 jobs
      try {
        const { stdout: runsOut } = await execAsync(
          `openclaw cron runs --id ${job.id} --limit 3 2>/dev/null`,
          { timeout: 10000 }
        );
        
        const runsMatch = runsOut.match(/\{[\s\S]*\}/);
        if (runsMatch) {
          const runsData = JSON.parse(runsMatch[0]);
          for (const entry of runsData.entries || []) {
            allEntries.push({
              ...entry,
              jobName: job.name,
            });
          }
        }
      } catch {
        // Skip jobs we can't fetch
      }
    }
    
    // Sort by timestamp descending
    allEntries.sort((a, b) => b.ts - a.ts);
    
    return NextResponse.json({ entries: allEntries.slice(0, 20) });
  } catch (error) {
    console.error('Logs API error:', error);
    return NextResponse.json({ entries: [], error: 'Failed to fetch logs' }, { status: 200 });
  }
}
