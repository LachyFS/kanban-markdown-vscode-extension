import * as vscode from 'vscode'
import { exec } from 'child_process'
import { getTitleFromContent, generateFeatureFilename } from '../shared/types'
import type { Feature, FeatureStatus, GitHubMeta, GitHubComment, GitHubReactions } from '../shared/types'

export type SyncStatus = 'idle' | 'syncing' | 'success' | 'error'

export interface SyncResult {
  created: Feature[]
  updated: Feature[]
  pushed: Feature[]
  errors: string[]
}

interface GitHubIssue {
  number: number
  title: string
  body: string | null
  state: 'open' | 'closed'
  html_url: string
  updated_at: string
  pull_request?: unknown
  assignee?: { login: string } | null
  labels: { name: string; color: string }[]
  user: { login: string; avatar_url: string } | null
  created_at: string
  reactions?: GitHubReactions
}

export class GitHubService {
  private _repo: string | null = null
  private _syncing = false
  private _currentUserLogin: string | null = null

  constructor(
    private readonly _workspaceRoot: string,
    private readonly _onStatusChange: (status: SyncStatus, message?: string) => void
  ) {}

  async initialize(): Promise<void> {
    const config = vscode.workspace.getConfiguration('kanban-markdown')
    const configRepo = config.get<string>('github.repo')

    if (configRepo) {
      this._repo = configRepo
    } else {
      this._repo = await this._detectRepo()
    }

    if (this._repo) {
      this._onStatusChange('idle')
    }
  }

  isConnected(): boolean {
    return this._repo !== null
  }

  getRepo(): string | null {
    return this._repo
  }

  async sync(features: Feature[]): Promise<SyncResult> {
    if (this._syncing) {
      return { created: [], updated: [], pushed: [], errors: ['Sync already in progress'] }
    }

    if (!this._repo) {
      await this.initialize()
      if (!this._repo) {
        return { created: [], updated: [], pushed: [], errors: ['No GitHub repository configured or detected'] }
      }
    }

    this._syncing = true
    this._onStatusChange('syncing')

    const result: SyncResult = { created: [], updated: [], pushed: [], errors: [] }

    try {
      // Pull: fetch issues from GitHub
      const issues = await this._fetchIssues()

      // Build lookup of existing synced features by issue number
      const syncedByNumber = new Map<number, Feature>()
      for (const feature of features) {
        if (feature.github && feature.github.repo === this._repo) {
          syncedByNumber.set(feature.github.issueNumber, feature)
        }
      }

      for (const issue of issues) {
        const existing = syncedByNumber.get(issue.number)

        if (!existing) {
          // New issue — create local feature
          const feature = this._issueToFeature(issue)
          result.created.push(feature)
        } else {
          // Existing — check who's newer
          const issueUpdated = new Date(issue.updated_at).getTime()
          const syncedAt = new Date(existing.github!.syncedAt).getTime()
          const localModified = new Date(existing.modified).getTime()

          if (issueUpdated > syncedAt && localModified > syncedAt) {
            // Both changed — GitHub wins ties
            if (issueUpdated >= localModified) {
              this._updateFeatureFromIssue(existing, issue)
              result.updated.push(existing)
            } else {
              // Local wins — push
              const pushed = await this._pushFeatureToGitHub(existing)
              if (pushed) result.pushed.push(existing)
            }
          } else if (issueUpdated > syncedAt) {
            // GitHub is newer
            this._updateFeatureFromIssue(existing, issue)
            result.updated.push(existing)
          } else if (localModified > syncedAt) {
            // Local is newer — push
            const pushed = await this._pushFeatureToGitHub(existing)
            if (pushed) result.pushed.push(existing)
          }
          // Otherwise both unchanged — skip

          syncedByNumber.delete(issue.number)
        }
      }

      this._onStatusChange('success')
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      result.errors.push(message)
      this._onStatusChange('error', message)
    } finally {
      this._syncing = false
    }

    return result
  }

  async pushFeature(feature: Feature): Promise<Feature> {
    if (!this._repo || !feature.github) {
      return feature
    }

    await this._pushFeatureToGitHub(feature)
    return feature
  }

  async fetchComments(issueNumber: number): Promise<{
    issueBody: string
    issueAuthor: string
    issueAuthorAvatar: string
    issueCreatedAt: string
    issueReactions: GitHubReactions
    comments: GitHubComment[]
  }> {
    if (!this._repo) {
      throw new Error('No GitHub repository configured')
    }

    const { data: issue } = await this._apiRequest<GitHubIssue>(
      'GET',
      `/repos/${this._repo}/issues/${issueNumber}`
    )

    interface GitHubCommentResponse {
      id: number
      user: { login: string; avatar_url: string } | null
      body: string | null
      created_at: string
      reactions?: GitHubReactions
    }

    const { data: rawComments } = await this._apiRequest<GitHubCommentResponse[]>(
      'GET',
      `/repos/${this._repo}/issues/${issueNumber}/comments?per_page=100`
    )

    const emptyReactions: GitHubReactions = { '+1': 0, '-1': 0, laugh: 0, hooray: 0, confused: 0, heart: 0, rocket: 0, eyes: 0 }

    const comments: GitHubComment[] = rawComments.map(c => ({
      id: c.id,
      author: c.user?.login || 'unknown',
      avatarUrl: c.user?.avatar_url || '',
      body: c.body || '',
      createdAt: c.created_at,
      reactions: c.reactions || emptyReactions
    }))

    return {
      issueBody: issue.body || '',
      issueAuthor: issue.user?.login || 'unknown',
      issueAuthorAvatar: issue.user?.avatar_url || '',
      issueCreatedAt: issue.created_at,
      issueReactions: issue.reactions || emptyReactions,
      comments
    }
  }

  dispose(): void {
    // Nothing to clean up currently
  }

  // --- Private methods ---

  private async _getSession(): Promise<vscode.AuthenticationSession> {
    const session = await vscode.authentication.getSession('github', ['repo'], { createIfNone: true })
    if (!session) {
      throw new Error('GitHub authentication required')
    }
    this._currentUserLogin = session.account.label
    return session
  }

  private async _apiRequest<T>(
    method: string,
    path: string,
    body?: unknown
  ): Promise<{ data: T; status: number }> {
    const session = await this._getSession()
    const response = await fetch(`https://api.github.com${path}`, {
      method,
      headers: {
        'Authorization': `Bearer ${session.accessToken}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'kanban-markdown-vscode'
      },
      body: body ? JSON.stringify(body) : undefined
    })

    if (response.status === 403) {
      const remaining = response.headers.get('X-RateLimit-Remaining')
      if (remaining === '0') {
        const resetTime = response.headers.get('X-RateLimit-Reset')
        const resetDate = resetTime ? new Date(parseInt(resetTime) * 1000).toLocaleTimeString() : 'soon'
        throw new Error(`GitHub API rate limit exceeded. Resets at ${resetDate}.`)
      }
    }

    if (!response.ok) {
      const text = await response.text()
      throw new Error(`GitHub API ${method} ${path} failed (${response.status}): ${text}`)
    }

    const data = await response.json() as T
    return { data, status: response.status }
  }

  private async _fetchIssues(): Promise<GitHubIssue[]> {
    const allIssues: GitHubIssue[] = []
    const maxPages = 2 // Cap at 200 issues for MVP

    for (let page = 1; page <= maxPages; page++) {
      const { data } = await this._apiRequest<GitHubIssue[]>(
        'GET',
        `/repos/${this._repo}/issues?state=all&per_page=100&page=${page}`
      )

      // Filter out pull requests
      const issues = data.filter(item => !item.pull_request)
      allIssues.push(...issues)

      if (data.length < 100) break // No more pages
    }

    return allIssues
  }

  private _resolveOpenIssueStatus(issue: GitHubIssue): FeatureStatus {
    if (this._currentUserLogin && issue.assignee?.login === this._currentUserLogin) {
      return 'todo'
    }
    return 'backlog'
  }

  private _issueToFeature(issue: GitHubIssue): Feature {
    const title = issue.title
    const body = issue.body || ''
    const content = body ? `# ${title}\n\n${body}` : `# ${title}`
    const status: FeatureStatus = issue.state === 'closed' ? 'done' : this._resolveOpenIssueStatus(issue)
    const now = new Date().toISOString()

    const github: GitHubMeta = {
      issueNumber: issue.number,
      repo: this._repo!,
      htmlUrl: issue.html_url,
      syncedAt: now
    }

    return {
      id: generateFeatureFilename(title),
      status,
      priority: 'medium',
      assignee: issue.assignee?.login || null,
      dueDate: null,
      created: now,
      modified: now,
      completedAt: status === 'done' ? now : null,
      labels: issue.labels.map(l => l.name),
      order: 0,
      content,
      filePath: '', // Will be set by KanbanPanel when writing
      github
    }
  }

  private _updateFeatureFromIssue(feature: Feature, issue: GitHubIssue): void {
    const title = issue.title
    const body = issue.body || ''
    feature.content = body ? `# ${title}\n\n${body}` : `# ${title}`

    const resolvedStatus = issue.state === 'closed' ? 'done' : this._resolveOpenIssueStatus(issue)
    if (feature.status === 'done' && resolvedStatus !== 'done') {
      // Issue was reopened
      feature.status = resolvedStatus
      feature.completedAt = null
    } else if (feature.status !== 'done' && resolvedStatus === 'done') {
      // Issue was closed
      feature.status = 'done'
      feature.completedAt = new Date().toISOString()
    }

    if (issue.assignee?.login) {
      feature.assignee = issue.assignee.login
    }

    feature.labels = issue.labels.map(l => l.name)
    feature.modified = new Date().toISOString()
    feature.github!.syncedAt = new Date().toISOString()
  }

  private async _pushFeatureToGitHub(feature: Feature): Promise<boolean> {
    if (!this._repo || !feature.github) return false

    const title = getTitleFromContent(feature.content)
    // Extract body: everything after the first # heading line
    const bodyMatch = feature.content.match(/^#\s+.+$/m)
    const body = bodyMatch
      ? feature.content.slice(bodyMatch.index! + bodyMatch[0].length).trim()
      : feature.content

    const state = feature.status === 'done' ? 'closed' : 'open'

    try {
      await this._apiRequest(
        'PATCH',
        `/repos/${this._repo}/issues/${feature.github.issueNumber}`,
        { title, body, state }
      )

      feature.github.syncedAt = new Date().toISOString()
      return true
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      vscode.window.showWarningMessage(`Failed to update GitHub issue #${feature.github.issueNumber}: ${message}`)
      return false
    }
  }

  private _detectRepo(): Promise<string | null> {
    return new Promise((resolve) => {
      exec('git remote get-url origin', { cwd: this._workspaceRoot }, (err, stdout) => {
        if (err || !stdout.trim()) {
          resolve(null)
          return
        }

        const url = stdout.trim()
        // Match: https://github.com/owner/repo.git or git@github.com:owner/repo.git
        const httpsMatch = url.match(/github\.com\/([^/]+)\/([^/.]+)/)
        const sshMatch = url.match(/github\.com:([^/]+)\/([^/.]+)/)
        const match = httpsMatch || sshMatch

        if (match) {
          resolve(`${match[1]}/${match[2]}`)
        } else {
          resolve(null)
        }
      })
    })
  }
}
