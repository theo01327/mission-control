// OpenClaw Gateway API client
const GATEWAY_URL = process.env.OPENCLAW_GATEWAY_URL || 'http://localhost:9315';
const GATEWAY_TOKEN = process.env.OPENCLAW_GATEWAY_TOKEN || '';

async function gatewayRequest(endpoint: string, method = 'GET', body?: any) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  
  if (GATEWAY_TOKEN) {
    headers['Authorization'] = `Bearer ${GATEWAY_TOKEN}`;
  }

  const response = await fetch(`${GATEWAY_URL}${endpoint}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(`Gateway error: ${response.status}`);
  }

  return response.json();
}

export type CronJob = {
  id: string;
  name: string;
  enabled: boolean;
  schedule: {
    kind: string;
    expr?: string;
    everyMs?: number;
    tz?: string;
  };
  state?: {
    nextRunAtMs?: number;
    lastRunAtMs?: number;
    lastStatus?: string;
    lastError?: string;
  };
  payload: {
    kind: string;
    message?: string;
    model?: string;
  };
};

export type Agent = {
  id: string;
  configured: boolean;
};

export type Session = {
  key: string;
  kind: string;
  channel: string;
  displayName?: string;
  model?: string;
  updatedAt: number;
  totalTokens: number;
};

export async function getCronJobs(): Promise<CronJob[]> {
  try {
    const data = await gatewayRequest('/api/cron/list');
    return data.jobs || [];
  } catch (error) {
    console.error('Failed to fetch cron jobs:', error);
    return [];
  }
}

export async function getAgents(): Promise<Agent[]> {
  try {
    const data = await gatewayRequest('/api/agents/list');
    return data.agents || [];
  } catch (error) {
    console.error('Failed to fetch agents:', error);
    return [];
  }
}

export async function getSessions(): Promise<Session[]> {
  try {
    const data = await gatewayRequest('/api/sessions/list');
    return data.sessions || [];
  } catch (error) {
    console.error('Failed to fetch sessions:', error);
    return [];
  }
}
