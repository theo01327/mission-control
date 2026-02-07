// GitHub API client for Mission Control
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const REPO_OWNER = 'theo01327';
const REPO_NAME = 'clawd-workspace';

const headers: Record<string, string> = {
  'Accept': 'application/vnd.github.v3+json',
};

if (GITHUB_TOKEN) {
  headers['Authorization'] = `Bearer ${GITHUB_TOKEN}`;
}

export type Activity = {
  id: string;
  created_at: string;
  action_type: string;
  title: string;
  description: string | null;
  sha?: string;
};

// Get recent commits as activities
export async function getActivities(): Promise<Activity[]> {
  try {
    const response = await fetch(
      `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/commits?per_page=50`,
      { headers, cache: 'no-store' }
    );
    
    if (!response.ok) {
      console.error('GitHub API error:', response.status, await response.text());
      return [];
    }
    
    const commits = await response.json();
    
    return commits.map((commit: any) => ({
      id: commit.sha,
      created_at: commit.commit.author.date,
      action_type: 'commit',
      title: commit.commit.message.split('\n')[0],
      description: commit.commit.message,
      sha: commit.sha.slice(0, 7),
    }));
  } catch (error) {
    console.error('Error fetching commits:', error);
    return [];
  }
}

// Get files from memory directory
export async function getMemoryFiles(): Promise<any[]> {
  try {
    const response = await fetch(
      `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/memory`,
      { headers, cache: 'no-store' }
    );
    
    if (!response.ok) return [];
    
    return await response.json();
  } catch (error) {
    console.error('Error fetching memory files:', error);
    return [];
  }
}

// Search repository commits
export async function searchRepo(query: string): Promise<any[]> {
  try {
    const response = await fetch(
      `https://api.github.com/search/commits?q=${encodeURIComponent(query)}+repo:${REPO_OWNER}/${REPO_NAME}`,
      { 
        headers: {
          ...headers,
          'Accept': 'application/vnd.github.cloak-preview+json'
        },
        cache: 'no-store'
      }
    );
    
    if (!response.ok) return [];
    
    const data = await response.json();
    return (data.items || []).map((item: any) => ({
      type: 'commit',
      name: item.commit.message.split('\n')[0],
      path: item.sha.slice(0, 7),
      url: item.html_url,
      fragment: item.commit.message,
    }));
  } catch (error) {
    console.error('Error searching:', error);
    return [];
  }
}
