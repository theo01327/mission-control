'use client';

import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Clock, Bot, Zap, CheckCircle, XCircle, AlertCircle, ListTodo, FileText, Calendar, ChevronDown, ChevronRight, Wrench, FolderOpen, Heart, User, MessageSquare } from 'lucide-react';

type CronJob = {
  id: string; name: string; enabled: boolean;
  schedule: { kind: string; expr?: string; everyMs?: number };
  state?: { nextRunAtMs?: number; lastRunAtMs?: number; lastStatus?: string; lastError?: string };
  payload: { kind: string; model?: string };
};

type Agent = {
  id: string; name: string; configured: boolean; hasWorkspace: boolean; hasSoul: boolean;
  skillCount: number; sessionCount: number; lastActivity: number | null; description?: string;
};

type Session = {
  id: string; key: string; agent: string; kind: string; channel: string;
  displayName?: string; model?: string; updatedAt: number; totalTokens: number;
  messageCount: number; recentMessages: { role: string; preview: string; timestamp: number }[];
};

type Task = { id: string; title: string; status: 'ready' | 'in-progress' | 'done' | 'blocked'; assignee?: string; priority?: string; section: string };
type LogEntry = { ts: number; jobId: string; status: string; summary?: string; error?: string; durationMs?: number; jobName?: string };
type Skill = { id: string; name: string; description?: string; agent: string; hasReadme: boolean; files: number; updatedAt: number };
type Project = { id: string; name: string; description?: string; status?: string; files: number; updatedAt: number };
type HeartbeatRun = { timestamp: number; response: string; status: 'ok' | 'action'; model?: string };
type Heartbeat = { config: { every: string; model: string }; lastHeartbeat: number | null; nextHeartbeat: number | null; runs?: HeartbeatRun[] };

function formatRelative(ms: number) {
  const now = Date.now(); const diff = ms - now; const absDiff = Math.abs(diff);
  if (absDiff < 60000) return diff > 0 ? 'in <1m' : '<1m ago';
  if (absDiff < 3600000) return diff > 0 ? `in ${Math.round(absDiff / 60000)}m` : `${Math.round(absDiff / 60000)}m ago`;
  if (absDiff < 86400000) return diff > 0 ? `in ${Math.round(absDiff / 3600000)}h` : `${Math.round(absDiff / 3600000)}h ago`;
  return diff > 0 ? `in ${Math.round(absDiff / 86400000)}d` : `${Math.round(absDiff / 86400000)}d ago`;
}

function StatusBadge({ status }: { status?: string }) {
  if (status === 'ok') return <span className="flex items-center gap-1 text-xs text-green-500"><CheckCircle size={12} /> OK</span>;
  if (status === 'error') return <span className="flex items-center gap-1 text-xs text-red-500"><XCircle size={12} /> Error</span>;
  if (status === 'action') return <span className="flex items-center gap-1 text-xs text-blue-500"><Zap size={12} /> Action</span>;
  return <span className="flex items-center gap-1 text-xs text-gray-500"><AlertCircle size={12} /> Pending</span>;
}

function AgentBadge({ agent }: { agent: string }) {
  const colors: Record<string, string> = {
    'main': 'bg-purple-900/50 text-purple-300',
    'main (global)': 'bg-blue-900/50 text-blue-300',
    'dev-agent': 'bg-green-900/50 text-green-300',
    'marketing-agent': 'bg-orange-900/50 text-orange-300',
  };
  return <span className={`text-xs px-1.5 py-0.5 rounded ${colors[agent] || 'bg-gray-800 text-gray-400'}`}>{agent}</span>;
}

export default function Dashboard() {
  const [cronJobs, setCronJobs] = useState<CronJob[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [heartbeat, setHeartbeat] = useState<Heartbeat | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [activeTab, setActiveTab] = useState<string>('cron');
  const [expandedItem, setExpandedItem] = useState<string | null>(null);
  const [jobLogs, setJobLogs] = useState<LogEntry[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [showHeartbeatLogs, setShowHeartbeatLogs] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [cronRes, agentsRes, sessionsRes, tasksRes, skillsRes, projectsRes, heartbeatRes] = await Promise.all([
        fetch('/api/cron'), fetch('/api/agents'), fetch('/api/sessions'), fetch('/api/tasks'),
        fetch('/api/skills'), fetch('/api/projects'), fetch('/api/heartbeat'),
      ]);
      const [cronData, agentsData, sessionsData, tasksData, skillsData, projectsData, heartbeatData] = await Promise.all([
        cronRes.json(), agentsRes.json(), sessionsRes.json(), tasksRes.json(),
        skillsRes.json(), projectsRes.json(), heartbeatRes.json()
      ]);
      setCronJobs(cronData.jobs || []); setAgents(agentsData.agents || []);
      setSessions(sessionsData.sessions || []); setTasks(tasksData.tasks || []);
      setSkills(skillsData.skills || []); setProjects(projectsData.projects || []);
      setHeartbeat(heartbeatData); setLastRefresh(new Date());
      fetch('/api/logs?limit=15').then(r => r.json()).then(d => setLogs(d.entries || [])).catch(() => {});
    } catch (error) { console.error('Fetch error:', error); }
    setLoading(false);
  }, []);

  const fetchJobLogs = async (jobId: string) => {
    setLoadingLogs(true);
    try {
      const res = await fetch(`/api/logs?jobId=${jobId}&limit=10`);
      const data = await res.json();
      setJobLogs(data.entries || []);
    } catch { setJobLogs([]); }
    setLoadingLogs(false);
  };

  const toggleExpand = (id: string, type: 'cron' | 'agent' | 'session') => {
    const key = `${type}:${id}`;
    if (expandedItem === key) { setExpandedItem(null); setJobLogs([]); }
    else { setExpandedItem(key); if (type === 'cron') fetchJobLogs(id); }
  };

  useEffect(() => { fetchData(); }, [fetchData]);

  const tabs = [
    { id: 'cron', label: 'Cron', icon: Clock, count: cronJobs.length },
    { id: 'tasks', label: 'Tasks', icon: ListTodo, count: tasks.filter(t => t.status !== 'done').length },
    { id: 'logs', label: 'Logs', icon: FileText, count: logs.length },
    { id: 'projects', label: 'Projects', icon: FolderOpen, count: projects.length },
    { id: 'skills', label: 'Skills', icon: Wrench, count: skills.length },
    { id: 'agents', label: 'Agents', icon: Bot, count: agents.length },
    { id: 'sessions', label: 'Sessions', icon: MessageSquare, count: sessions.length },
  ];

  return (
    <main className="min-h-screen bg-black text-white p-4 md:p-6 max-w-5xl mx-auto font-sans">
      <header className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl md:text-2xl font-semibold tracking-tight">Mission Control</h1>
          <p className="text-xs md:text-sm text-gray-500">Theo ⚔️ Dashboard</p>
        </div>
        <button onClick={fetchData} disabled={loading} className="flex items-center gap-2 px-3 py-1.5 bg-white text-black rounded-lg text-sm font-medium hover:bg-gray-200 disabled:opacity-50">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </header>

      {/* Heartbeat */}
      {heartbeat && (
        <div className="mb-4 bg-gray-950 border border-gray-800 rounded-lg overflow-hidden">
          <div className="p-3 cursor-pointer hover:bg-gray-900/50" onClick={() => setShowHeartbeatLogs(!showHeartbeatLogs)}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {showHeartbeatLogs ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                <Heart size={16} className="text-red-500 animate-pulse" />
                <span className="font-medium text-sm">Heartbeat</span>
                <span className="text-xs text-gray-500">every {heartbeat.config.every}</span>
              </div>
              <div className="text-right text-xs">
                {heartbeat.lastHeartbeat && <span className="text-gray-500">Last: {formatRelative(heartbeat.lastHeartbeat)}</span>}
                {heartbeat.nextHeartbeat && <span className="text-green-500 ml-3">Next: {formatRelative(heartbeat.nextHeartbeat)}</span>}
              </div>
            </div>
          </div>
          {showHeartbeatLogs && heartbeat.runs && (
            <div className="border-t border-gray-800 p-3 bg-gray-900/30 space-y-2">
              {heartbeat.runs.map((run, i) => (
                <div key={i} className="text-xs border-l-2 pl-2 py-1 border-gray-700 flex items-center gap-2">
                  <StatusBadge status={run.status} />
                  <span className="text-gray-500">{formatRelative(run.timestamp)}</span>
                  <span className="text-gray-600">{run.model}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {lastRefresh && <p className="text-xs text-gray-600 mb-4">Updated: {lastRefresh.toLocaleTimeString()}</p>}

      <div className="flex gap-1 mb-4 border-b border-gray-800 overflow-x-auto pb-px">
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`px-3 py-2 text-xs font-medium border-b-2 -mb-px whitespace-nowrap ${activeTab === tab.id ? 'border-white text-white' : 'border-transparent text-gray-500 hover:text-gray-300'}`}>
            <tab.icon size={12} className="inline mr-1.5" />{tab.label} ({tab.count})
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {loading && <div className="text-center py-12 text-gray-500">Loading...</div>}

        {/* Cron Jobs */}
        {!loading && activeTab === 'cron' && cronJobs.map(job => (
          <div key={job.id} className="bg-gray-950 border border-gray-800 rounded-lg">
            <div className="p-3 cursor-pointer hover:bg-gray-900/50" onClick={() => toggleExpand(job.id, 'cron')}>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    {expandedItem === `cron:${job.id}` ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    <span className={`w-2 h-2 rounded-full ${job.enabled ? 'bg-green-500' : 'bg-gray-600'}`} />
                    <h3 className="font-medium text-sm">{job.name}</h3>
                  </div>
                  <div className="mt-1 ml-6 flex gap-2 text-xs text-gray-500">
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
            {expandedItem === `cron:${job.id}` && (
              <div className="border-t border-gray-800 p-3 bg-gray-900/30">
                {loadingLogs ? <p className="text-xs text-gray-500">Loading...</p> : jobLogs.length === 0 ? <p className="text-xs text-gray-500">No runs</p> : (
                  <div className="space-y-2">
                    {jobLogs.map((entry, i) => (
                      <div key={i} className="text-xs border-l-2 pl-2 py-1 border-gray-700">
                        <div className="flex items-center gap-2"><StatusBadge status={entry.status} /><span className="text-gray-500">{formatRelative(entry.ts)}</span></div>
                        {entry.summary && <p className="text-gray-400 line-clamp-2 mt-0.5">{entry.summary.slice(0, 200)}</p>}
                        {entry.error && <p className="text-red-400 mt-0.5">{entry.error.slice(0, 100)}</p>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}

        {/* Tasks */}
        {!loading && activeTab === 'tasks' && (tasks.length === 0 ? <div className="text-center py-12 text-gray-500">No tasks</div> :
          Array.from(new Set(tasks.map(t => t.section))).map(section => (
            <div key={section} className="mb-4">
              <h3 className="text-xs font-medium text-gray-400 mb-2">{section}</h3>
              {tasks.filter(t => t.section === section).map(task => (
                <div key={task.id} className="bg-gray-950 border border-gray-800 rounded-lg p-2.5 mb-1">
                  <p className="text-sm">{task.title}</p>
                  <div className="flex gap-2 mt-1">
                    <span className={`px-2 py-0.5 rounded text-xs ${task.status === 'done' ? 'bg-green-900 text-green-300' : task.status === 'in-progress' ? 'bg-blue-900 text-blue-300' : 'bg-gray-700 text-gray-300'}`}>{task.status}</span>
                    {task.assignee && <span className="text-xs text-blue-400">@{task.assignee}</span>}
                  </div>
                </div>
              ))}
            </div>
          ))
        )}

        {/* Logs */}
        {!loading && activeTab === 'logs' && logs.map((entry, i) => (
          <div key={i} className="bg-gray-950 border border-gray-800 rounded-lg p-3">
            <div className="flex justify-between mb-1">
              <div><h4 className="text-sm font-medium">{entry.jobName || entry.jobId?.slice(0, 8)}</h4><p className="text-xs text-gray-500">{formatRelative(entry.ts)}</p></div>
              <StatusBadge status={entry.status} />
            </div>
            {entry.summary && <p className="text-xs text-gray-400 line-clamp-2">{entry.summary.slice(0, 200)}</p>}
          </div>
        ))}

        {/* Projects */}
        {!loading && activeTab === 'projects' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {projects.map(p => (
              <div key={p.id} className="bg-gray-950 border border-gray-800 rounded-lg p-3">
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-2"><FolderOpen size={14} className="text-blue-400" /><h3 className="font-medium text-sm">{p.name}</h3></div>
                  {p.status && <span className={`text-xs px-2 py-0.5 rounded ${p.status === 'ACTIVE' ? 'bg-green-900/50 text-green-300' : p.status === 'PLANNING' ? 'bg-blue-900/50 text-blue-300' : 'bg-gray-800 text-gray-400'}`}>{p.status}</span>}
                </div>
                {p.description && <p className="text-xs text-gray-500 mt-1 line-clamp-2">{p.description}</p>}
              </div>
            ))}
          </div>
        )}

        {/* Skills */}
        {!loading && activeTab === 'skills' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {skills.map(skill => (
              <div key={skill.id} className="bg-gray-950 border border-gray-800 rounded-lg p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2"><Wrench size={14} className="text-green-400" /><h3 className="font-medium text-sm">{skill.name}</h3></div>
                  <AgentBadge agent={skill.agent} />
                </div>
                {skill.description && <p className="text-xs text-gray-500 mt-1 line-clamp-2">{skill.description}</p>}
                <p className="text-xs text-gray-600 mt-2">{skill.files} files</p>
              </div>
            ))}
          </div>
        )}

        {/* Agents */}
        {!loading && activeTab === 'agents' && agents.map(agent => (
          <div key={agent.id} className="bg-gray-950 border border-gray-800 rounded-lg">
            <div className="p-3 cursor-pointer hover:bg-gray-900/50" onClick={() => toggleExpand(agent.id, 'agent')}>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  {expandedItem === `agent:${agent.id}` ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  <Bot size={14} className={agent.configured ? 'text-green-500' : 'text-gray-600'} />
                  <h3 className="font-medium text-sm">{agent.name}</h3>
                  {agent.id === 'main' && <span className="text-xs px-1.5 py-0.5 bg-purple-900/50 text-purple-300 rounded">Primary</span>}
                </div>
                <div className="text-right text-xs text-gray-500">
                  {agent.sessionCount > 0 && <span>{agent.sessionCount} sessions</span>}
                  {agent.skillCount > 0 && <span className="ml-2">{agent.skillCount} skills</span>}
                </div>
              </div>
            </div>
            {expandedItem === `agent:${agent.id}` && (
              <div className="border-t border-gray-800 p-3 bg-gray-900/30 text-xs space-y-1">
                <p><span className="text-gray-500">Workspace:</span> {agent.hasWorkspace ? '✅' : '❌'}</p>
                <p><span className="text-gray-500">SOUL.md:</span> {agent.hasSoul ? '✅' : '❌'}</p>
                <p><span className="text-gray-500">Last Activity:</span> {agent.lastActivity ? formatRelative(agent.lastActivity) : 'Never'}</p>
                {agent.description && <p className="text-gray-400 mt-2">{agent.description}</p>}
              </div>
            )}
          </div>
        ))}

        {/* Sessions */}
        {!loading && activeTab === 'sessions' && sessions.map(session => (
          <div key={session.id} className="bg-gray-950 border border-gray-800 rounded-lg">
            <div className="p-3 cursor-pointer hover:bg-gray-900/50" onClick={() => toggleExpand(session.id, 'session')}>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  {expandedItem === `session:${session.id}` ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  <MessageSquare size={14} className="text-blue-400" />
                  <h3 className="font-medium text-sm">{session.displayName || session.id.slice(0, 8)}</h3>
                  <AgentBadge agent={session.agent} />
                </div>
                <div className="text-right text-xs text-gray-500">
                  <p>{formatRelative(session.updatedAt)}</p>
                  <p>{session.messageCount} msgs</p>
                </div>
              </div>
            </div>
            {expandedItem === `session:${session.id}` && (
              <div className="border-t border-gray-800 p-3 bg-gray-900/30">
                <p className="text-xs text-gray-500 mb-2">Channel: {session.channel} | Kind: {session.kind}</p>
                {session.recentMessages.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-gray-400">Recent Messages:</p>
                    {session.recentMessages.map((msg, i) => (
                      <div key={i} className="text-xs border-l-2 pl-2 py-1 border-gray-700">
                        <span className={msg.role === 'user' ? 'text-blue-400' : 'text-green-400'}>{msg.role}:</span>
                        <span className="text-gray-400 ml-2">{msg.preview}...</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      <footer className="mt-8 pt-4 border-t border-gray-900 text-center text-xs text-gray-600">Sola Bible App • Mission Control v1.5</footer>
    </main>
  );
}
