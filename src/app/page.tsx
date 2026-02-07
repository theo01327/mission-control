'use client';

import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Clock, Bot, Zap, CheckCircle, XCircle, AlertCircle, ListTodo, FileText, Calendar, ChevronDown, ChevronRight, Wrench, FolderOpen } from 'lucide-react';

type CronJob = {
  id: string;
  name: string;
  enabled: boolean;
  schedule: { kind: string; expr?: string; everyMs?: number; tz?: string };
  state?: { nextRunAtMs?: number; lastRunAtMs?: number; lastStatus?: string; lastError?: string };
  payload: { kind: string; model?: string };
};

type Agent = { id: string; configured: boolean };
type Session = { key: string; kind: string; channel: string; displayName?: string; model?: string; updatedAt: number; totalTokens: number };
type Task = { id: string; title: string; status: 'ready' | 'in-progress' | 'done' | 'blocked'; assignee?: string; priority?: string; section: string };
type LogEntry = { ts: number; jobId: string; action: string; status: string; summary?: string; error?: string; durationMs?: number; jobName?: string };
type Skill = { id: string; name: string; description?: string; hasReadme: boolean; files: number; updatedAt: number };
type Project = { id: string; name: string; description?: string; status?: string; hasReadme: boolean; files: number; updatedAt: number };

function formatRelative(ms: number) {
  const now = Date.now();
  const diff = ms - now;
  const absDiff = Math.abs(diff);
  if (absDiff < 60000) return diff > 0 ? 'in <1m' : '<1m ago';
  if (absDiff < 3600000) return diff > 0 ? `in ${Math.round(absDiff / 60000)}m` : `${Math.round(absDiff / 60000)}m ago`;
  if (absDiff < 86400000) return diff > 0 ? `in ${Math.round(absDiff / 3600000)}h` : `${Math.round(absDiff / 3600000)}h ago`;
  return diff > 0 ? `in ${Math.round(absDiff / 86400000)}d` : `${Math.round(absDiff / 86400000)}d ago`;
}

function StatusBadge({ status }: { status?: string }) {
  if (status === 'ok') return <span className="flex items-center gap-1 text-xs text-green-500"><CheckCircle size={12} /> OK</span>;
  if (status === 'error') return <span className="flex items-center gap-1 text-xs text-red-500"><XCircle size={12} /> Error</span>;
  return <span className="flex items-center gap-1 text-xs text-gray-500"><AlertCircle size={12} /> Pending</span>;
}

function TaskStatusBadge({ status }: { status: Task['status'] }) {
  const colors = { 'ready': 'bg-gray-700 text-gray-300', 'in-progress': 'bg-blue-900 text-blue-300', 'done': 'bg-green-900 text-green-300', 'blocked': 'bg-red-900 text-red-300' };
  return <span className={`px-2 py-0.5 rounded text-xs ${colors[status]}`}>{status}</span>;
}

export default function Dashboard() {
  const [cronJobs, setCronJobs] = useState<CronJob[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [activeTab, setActiveTab] = useState<string>('cron');
  const [expandedJob, setExpandedJob] = useState<string | null>(null);
  const [selectedJobLogs, setSelectedJobLogs] = useState<LogEntry[]>([]);
  const [loadingJobLogs, setLoadingJobLogs] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [cronRes, agentsRes, sessionsRes, tasksRes, logsRes, skillsRes, projectsRes] = await Promise.all([
        fetch('/api/cron'),
        fetch('/api/agents'),
        fetch('/api/sessions'),
        fetch('/api/tasks'),
        fetch('/api/logs?limit=20'),
        fetch('/api/skills'),
        fetch('/api/projects'),
      ]);
      
      const [cronData, agentsData, sessionsData, tasksData, logsData, skillsData, projectsData] = await Promise.all([
        cronRes.json(), agentsRes.json(), sessionsRes.json(), tasksRes.json(), logsRes.json(), skillsRes.json(), projectsRes.json()
      ]);
      
      setCronJobs(cronData.jobs || []);
      setAgents(agentsData.agents || []);
      setSessions(sessionsData.sessions || []);
      setTasks(tasksData.tasks || []);
      setLogs(logsData.entries || []);
      setSkills(skillsData.skills || []);
      setProjects(projectsData.projects || []);
      setLastRefresh(new Date());
    } catch (error) {
      console.error('Fetch error:', error);
    }
    setLoading(false);
  }, []);

  const fetchJobLogs = async (jobId: string) => {
    setLoadingJobLogs(true);
    try {
      const res = await fetch(`/api/logs?jobId=${jobId}&limit=10`);
      const data = await res.json();
      setSelectedJobLogs(data.entries || []);
    } catch { setSelectedJobLogs([]); }
    setLoadingJobLogs(false);
  };

  const toggleJobExpand = (jobId: string) => {
    if (expandedJob === jobId) { setExpandedJob(null); setSelectedJobLogs([]); }
    else { setExpandedJob(jobId); fetchJobLogs(jobId); }
  };

  useEffect(() => { fetchData(); }, [fetchData]);

  const tabs = [
    { id: 'cron', label: 'Cron', icon: Clock, count: cronJobs.length },
    { id: 'tasks', label: 'Tasks', icon: ListTodo, count: tasks.filter(t => t.status !== 'done').length },
    { id: 'logs', label: 'Logs', icon: FileText, count: logs.length },
    { id: 'projects', label: 'Projects', icon: FolderOpen, count: projects.length },
    { id: 'skills', label: 'Skills', icon: Wrench, count: skills.length },
    { id: 'agents', label: 'Agents', icon: Bot, count: agents.length },
    { id: 'sessions', label: 'Sessions', icon: Zap, count: sessions.length },
  ];

  return (
    <main className="min-h-screen bg-black text-white p-4 md:p-6 max-w-5xl mx-auto font-sans">
      <header className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl md:text-2xl font-semibold tracking-tight">Mission Control</h1>
          <p className="text-xs md:text-sm text-gray-500">Theo ⚔️ Dashboard</p>
        </div>
        <button onClick={fetchData} disabled={loading} className="flex items-center gap-2 px-3 py-1.5 bg-white text-black rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors disabled:opacity-50">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </header>

      {lastRefresh && <p className="text-xs text-gray-600 mb-4">Updated: {lastRefresh.toLocaleTimeString()}</p>}

      <div className="flex gap-1 mb-4 border-b border-gray-800 overflow-x-auto pb-px">
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`px-3 py-2 text-xs font-medium transition-colors border-b-2 -mb-px whitespace-nowrap ${activeTab === tab.id ? 'border-white text-white' : 'border-transparent text-gray-500 hover:text-gray-300'}`}>
            <tab.icon size={12} className="inline mr-1.5" />{tab.label} ({tab.count})
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {loading && <div className="text-center py-12 text-gray-500">Loading...</div>}

        {/* Cron Jobs */}
        {!loading && activeTab === 'cron' && cronJobs.map((job) => (
          <div key={job.id} className="bg-gray-950 border border-gray-800 rounded-lg">
            <div className="p-3 cursor-pointer hover:bg-gray-900/50" onClick={() => toggleJobExpand(job.id)}>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    {expandedJob === job.id ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    <span className={`w-2 h-2 rounded-full ${job.enabled ? 'bg-green-500' : 'bg-gray-600'}`} />
                    <h3 className="font-medium text-sm">{job.name}</h3>
                  </div>
                  <div className="mt-1 ml-6 flex flex-wrap gap-2 text-xs text-gray-500">
                    <span><Calendar size={10} className="inline mr-1" />{job.schedule.kind === 'cron' ? job.schedule.expr : `${Math.round((job.schedule.everyMs || 0) / 60000)}m`}</span>
                    {job.payload.model && <span className="text-gray-600">{job.payload.model.split('/').pop()}</span>}
                  </div>
                </div>
                <div className="text-right">
                  <StatusBadge status={job.state?.lastStatus} />
                  {job.state?.nextRunAtMs && <p className="text-xs text-gray-600 mt-0.5">{formatRelative(job.state.nextRunAtMs)}</p>}
                </div>
              </div>
            </div>
            {expandedJob === job.id && (
              <div className="border-t border-gray-800 p-3 bg-gray-900/30">
                <h4 className="text-xs font-medium mb-2">Run History</h4>
                {loadingJobLogs ? <p className="text-gray-500 text-xs">Loading...</p> : selectedJobLogs.length === 0 ? <p className="text-gray-500 text-xs">No runs yet</p> : (
                  <div className="space-y-2">
                    {selectedJobLogs.map((entry, i) => (
                      <div key={i} className="text-xs border-l-2 pl-2 py-1 border-gray-700">
                        <div className="flex items-center gap-2 mb-0.5">
                          <StatusBadge status={entry.status} />
                          <span className="text-gray-500">{formatRelative(entry.ts)}</span>
                          {entry.durationMs && <span className="text-gray-600">{Math.round(entry.durationMs / 1000)}s</span>}
                        </div>
                        {entry.summary && <p className="text-gray-400 line-clamp-2">{entry.summary.slice(0, 200)}</p>}
                        {entry.error && <p className="text-red-400 mt-0.5">{entry.error.slice(0, 100)}...</p>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}

        {/* Tasks */}
        {!loading && activeTab === 'tasks' && (tasks.length === 0 ? <div className="text-center py-12 text-gray-500">No tasks</div> : (
          Array.from(new Set(tasks.map(t => t.section))).map(section => (
            <div key={section} className="mb-4">
              <h3 className="text-xs font-medium text-gray-400 mb-2">{section}</h3>
              <div className="space-y-1">
                {tasks.filter(t => t.section === section).map(task => (
                  <div key={task.id} className="bg-gray-950 border border-gray-800 rounded-lg p-2.5">
                    <p className="text-sm text-white">{task.title}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <TaskStatusBadge status={task.status} />
                      {task.assignee && <span className="text-xs text-blue-400">@{task.assignee}</span>}
                      {task.priority && <span className={`text-xs ${task.priority === 'P0' ? 'text-red-400' : task.priority === 'P1' ? 'text-orange-400' : 'text-gray-500'}`}>{task.priority}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        ))}

        {/* Logs */}
        {!loading && activeTab === 'logs' && (logs.length === 0 ? <div className="text-center py-12 text-gray-500">No logs</div> : logs.map((entry, i) => (
          <div key={i} className="bg-gray-950 border border-gray-800 rounded-lg p-3">
            <div className="flex items-start justify-between mb-1">
              <div>
                <h4 className="text-sm font-medium">{entry.jobName || entry.jobId.slice(0, 8)}</h4>
                <p className="text-xs text-gray-500">{formatRelative(entry.ts)}</p>
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge status={entry.status} />
                {entry.durationMs && <span className="text-xs text-gray-600">{Math.round(entry.durationMs / 1000)}s</span>}
              </div>
            </div>
            {entry.summary && <p className="text-xs text-gray-400 line-clamp-2">{entry.summary.slice(0, 200)}</p>}
            {entry.error && <p className="text-xs text-red-400 mt-1">{entry.error.slice(0, 100)}...</p>}
          </div>
        )))}

        {/* Projects */}
        {!loading && activeTab === 'projects' && (projects.length === 0 ? <div className="text-center py-12 text-gray-500">No projects</div> : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {projects.map(project => (
              <div key={project.id} className="bg-gray-950 border border-gray-800 rounded-lg p-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <FolderOpen size={14} className="text-blue-400" />
                    <h3 className="font-medium text-sm">{project.name}</h3>
                  </div>
                  {project.status && <span className="text-xs px-2 py-0.5 bg-blue-900/50 text-blue-300 rounded">{project.status}</span>}
                </div>
                {project.description && <p className="text-xs text-gray-500 mt-1 line-clamp-2">{project.description}</p>}
                <div className="flex items-center gap-3 mt-2 text-xs text-gray-600">
                  <span>{project.files} files</span>
                  <span>{formatRelative(project.updatedAt)}</span>
                </div>
              </div>
            ))}
          </div>
        ))}

        {/* Skills */}
        {!loading && activeTab === 'skills' && (skills.length === 0 ? <div className="text-center py-12 text-gray-500">No skills</div> : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {skills.map(skill => (
              <div key={skill.id} className="bg-gray-950 border border-gray-800 rounded-lg p-3">
                <div className="flex items-center gap-2">
                  <Wrench size={14} className="text-green-400" />
                  <h3 className="font-medium text-sm">{skill.name}</h3>
                </div>
                {skill.description && <p className="text-xs text-gray-500 mt-1 line-clamp-2">{skill.description}</p>}
                <div className="flex items-center gap-3 mt-2 text-xs text-gray-600">
                  <span>{skill.files} files</span>
                  <span>{formatRelative(skill.updatedAt)}</span>
                </div>
              </div>
            ))}
          </div>
        ))}

        {/* Agents */}
        {!loading && activeTab === 'agents' && (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {agents.map(agent => (
              <div key={agent.id} className="bg-gray-950 border border-gray-800 rounded-lg p-3">
                <div className="flex items-center gap-2">
                  <Bot size={14} className={agent.configured ? 'text-green-500' : 'text-gray-600'} />
                  <span className="font-medium text-sm">{agent.id}</span>
                </div>
                <p className="text-xs text-gray-600 mt-1">{agent.configured ? 'Configured' : 'Not configured'}</p>
              </div>
            ))}
          </div>
        )}

        {/* Sessions */}
        {!loading && activeTab === 'sessions' && sessions.map(session => (
          <div key={session.key} className="bg-gray-950 border border-gray-800 rounded-lg p-3">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-medium text-sm">{session.displayName || session.key.slice(0, 12)}</h3>
                <div className="mt-0.5 flex gap-2 text-xs text-gray-500">
                  <span>{session.channel}</span>
                  <span>{session.kind}</span>
                  {session.model && <span className="text-gray-600">{session.model}</span>}
                </div>
              </div>
              <div className="text-right text-xs text-gray-600">
                <p>{formatRelative(session.updatedAt)}</p>
                <p>{session.totalTokens.toLocaleString()} tokens</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <footer className="mt-8 pt-4 border-t border-gray-900 text-center text-xs text-gray-600">
        Sola Bible App • Mission Control v1.2
      </footer>
    </main>
  );
}
