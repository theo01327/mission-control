// GitHub API client for Mission Control - no auth needed for public repos
const REPO_OWNER = 'theo01327';
const REPO_NAME = 'clawd-workspace';

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
      { next: { revalidate: 60 } }
    );
    
    if (!response.ok) return [];
    
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
      { next: { revalidate: 60 } }
    );
    
    if (!response.ok) return [];
    
    return await response.json();
  } catch (error) {
    console.error('Error fetching memory files:', error);
    return [];
  }
}

// Search repository (requires auth for code search, so we'll search commits instead)
export async function searchRepo(query: string): Promise<any[]> {
  try {
    // Search commits for the query
    const response = await fetch(
      `https://api.github.com/search/commits?q=${encodeURIComponent(query)}+repo:${REPO_OWNER}/${REPO_NAME}`,
      { 
        headers: { 'Accept': 'application/vnd.github.cloak-preview' }
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
