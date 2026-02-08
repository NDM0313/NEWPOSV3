/**
 * GitHub API Service
 * Complete integration for GitHub Pull Requests
 */

export interface GitHubPullRequest {
  id: number;
  number: number;
  title: string;
  body: string;
  state: 'open' | 'closed' | 'merged';
  created_at: string;
  updated_at: string;
  merged_at: string | null;
  user: {
    login: string;
    avatar_url: string;
  };
  head: {
    ref: string;
    sha: string;
    repo: {
      name: string;
      full_name: string;
    };
  };
  base: {
    ref: string;
    sha: string;
  };
  mergeable: boolean | null;
  mergeable_state: string;
  merged: boolean;
  comments: number;
  review_comments: number;
  commits: number;
  additions: number;
  deletions: number;
  changed_files: number;
  html_url: string;
  diff_url: string;
  patch_url: string;
  labels: Array<{
    id: number;
    name: string;
    color: string;
  }>;
  assignees: Array<{
    login: string;
    avatar_url: string;
  }>;
  requested_reviewers: Array<{
    login: string;
    avatar_url: string;
  }>;
}

export interface CreatePullRequestParams {
  title: string;
  body: string;
  head: string; // source branch
  base: string; // target branch
  draft?: boolean;
  maintainer_can_modify?: boolean;
}

export interface PullRequestComment {
  id: number;
  body: string;
  user: {
    login: string;
    avatar_url: string;
  };
  created_at: string;
  updated_at: string;
}

export interface PullRequestReview {
  id: number;
  state: 'APPROVED' | 'CHANGES_REQUESTED' | 'COMMENTED' | 'DISMISSED';
  body: string;
  user: {
    login: string;
    avatar_url: string;
  };
  submitted_at: string;
}

class GitHubService {
  private baseUrl = 'https://api.github.com';
  private owner: string;
  private repo: string;
  private token: string | null = null;

  constructor(owner: string = 'NDM0313', repo: string = 'NEWPOSV3') {
    this.owner = owner;
    this.repo = repo;
    // Get token from environment or localStorage
    this.token = import.meta.env.VITE_GITHUB_TOKEN || 
                 localStorage.getItem('github_token') || 
                 null;
  }

  /**
   * Set GitHub token for authentication
   */
  setToken(token: string) {
    this.token = token;
    localStorage.setItem('github_token', token);
  }

  /**
   * Get authentication headers
   */
  private getHeaders(): HeadersInit {
    const headers: HeadersInit = {
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
    };

    if (this.token) {
      headers['Authorization'] = `token ${this.token}`;
    }

    return headers;
  }

  /**
   * Make API request
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}/repos/${this.owner}/${this.repo}${endpoint}`;
    
    const response = await fetch(url, {
      ...options,
      headers: {
        ...this.getHeaders(),
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: response.statusText }));
      throw new Error(error.message || `GitHub API error: ${response.status}`);
    }

    return response.json();
  }

  /**
   * Get all pull requests
   */
  async getPullRequests(params?: {
    state?: 'open' | 'closed' | 'all';
    head?: string;
    base?: string;
    sort?: 'created' | 'updated' | 'popularity';
    direction?: 'asc' | 'desc';
    per_page?: number;
    page?: number;
  }): Promise<GitHubPullRequest[]> {
    const queryParams = new URLSearchParams();
    
    if (params?.state) queryParams.append('state', params.state);
    if (params?.head) queryParams.append('head', params.head);
    if (params?.base) queryParams.append('base', params.base);
    if (params?.sort) queryParams.append('sort', params.sort);
    if (params?.direction) queryParams.append('direction', params.direction);
    if (params?.per_page) queryParams.append('per_page', params.per_page.toString());
    if (params?.page) queryParams.append('page', params.page.toString());

    const query = queryParams.toString();
    const endpoint = `/pulls${query ? `?${query}` : ''}`;
    
    return this.request<GitHubPullRequest[]>(endpoint);
  }

  /**
   * Get a single pull request by number
   */
  async getPullRequest(prNumber: number): Promise<GitHubPullRequest> {
    return this.request<GitHubPullRequest>(`/pulls/${prNumber}`);
  }

  /**
   * Create a new pull request
   */
  async createPullRequest(params: CreatePullRequestParams): Promise<GitHubPullRequest> {
    return this.request<GitHubPullRequest>('/pulls', {
      method: 'POST',
      body: JSON.stringify({
        title: params.title,
        body: params.body,
        head: params.head,
        base: params.base,
        draft: params.draft || false,
        maintainer_can_modify: params.maintainer_can_modify || false,
      }),
    });
  }

  /**
   * Update a pull request
   */
  async updatePullRequest(
    prNumber: number,
    updates: {
      title?: string;
      body?: string;
      state?: 'open' | 'closed';
      base?: string;
    }
  ): Promise<GitHubPullRequest> {
    return this.request<GitHubPullRequest>(`/pulls/${prNumber}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  }

  /**
   * Merge a pull request
   */
  async mergePullRequest(
    prNumber: number,
    options?: {
      commit_title?: string;
      commit_message?: string;
      merge_method?: 'merge' | 'squash' | 'rebase';
    }
  ): Promise<{ merged: boolean; message: string }> {
    return this.request(`/pulls/${prNumber}/merge`, {
      method: 'PUT',
      body: JSON.stringify({
        commit_title: options?.commit_title,
        commit_message: options?.commit_message,
        merge_method: options?.merge_method || 'merge',
      }),
    });
  }

  /**
   * Get pull request comments
   */
  async getPullRequestComments(prNumber: number): Promise<PullRequestComment[]> {
    return this.request<PullRequestComment[]>(`/pulls/${prNumber}/comments`);
  }

  /**
   * Get pull request reviews
   */
  async getPullRequestReviews(prNumber: number): Promise<PullRequestReview[]> {
    return this.request<PullRequestReview[]>(`/pulls/${prNumber}/reviews`);
  }

  /**
   * Add a comment to a pull request
   */
  async addPullRequestComment(
    prNumber: number,
    body: string
  ): Promise<PullRequestComment> {
    return this.request<PullRequestComment>(`/pulls/${prNumber}/comments`, {
      method: 'POST',
      body: JSON.stringify({ body }),
    });
  }

  /**
   * Get pull request files
   */
  async getPullRequestFiles(prNumber: number): Promise<Array<{
    filename: string;
    status: string;
    additions: number;
    deletions: number;
    changes: number;
    patch?: string;
  }>> {
    return this.request(`/pulls/${prNumber}/files`);
  }

  /**
   * Get repository branches
   */
  async getBranches(): Promise<Array<{
    name: string;
    commit: {
      sha: string;
      url: string;
    };
    protected: boolean;
  }>> {
    return this.request('/branches');
  }

  /**
   * Check if authenticated
   */
  isAuthenticated(): boolean {
    return !!this.token;
  }

  /**
   * Get repository info
   */
  async getRepository(): Promise<{
    name: string;
    full_name: string;
    description: string;
    html_url: string;
    default_branch: string;
    open_issues_count: number;
    stargazers_count: number;
    forks_count: number;
  }> {
    return this.request('');
  }
}

// Export singleton instance
export const githubService = new GitHubService();

// Export for custom instances
export default GitHubService;
