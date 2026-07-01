import type { AIAgent, AIPermissionMode, Priority } from '../shared/types'

interface FeaturePromptInput {
  title: string
  priority: Priority
  labels: string[]
  content: string
  filePath: string
}

interface AITerminalLaunch {
  name: string
  shellPath: AIAgent
  shellArgs: string[]
}

const agentNames: Record<AIAgent, string> = {
  claude: 'Claude Code',
  codex: 'Codex',
  copilot: 'GitHub Copilot',
  opencode: 'OpenCode'
}

const agents = new Set<string>(Object.keys(agentNames))
const permissionModes = new Set<string>(['default', 'plan', 'acceptEdits', 'bypassPermissions'])

export function normalizeAIAgent(value: string | undefined): AIAgent {
  return value && agents.has(value) ? value as AIAgent : 'claude'
}

export function normalizeAIPermissionMode(value: string | undefined): AIPermissionMode {
  return value && permissionModes.has(value) ? value as AIPermissionMode : 'default'
}

export function buildFeaturePrompt(input: FeaturePromptInput): string {
  const labels = input.labels.length > 0 ? ` [${input.labels.join(', ')}]` : ''
  const description = input.content.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim()
  const shortDesc = description.length > 200 ? description.substring(0, 200) + '...' : description

  return `Implement this feature: "${input.title}" (${input.priority} priority)${labels}. ${shortDesc} See full details in: ${input.filePath}`
}

export function buildAITerminalLaunch(
  agent: AIAgent,
  permissionMode: AIPermissionMode,
  prompt: string
): AITerminalLaunch {
  switch (agent) {
    case 'claude': {
      const shellArgs: string[] = []
      if (permissionMode !== 'default') {
        shellArgs.push('--permission-mode', permissionMode)
      }
      shellArgs.push(prompt)
      return { name: agentNames[agent], shellPath: agent, shellArgs }
    }
    case 'codex': {
      if (permissionMode === 'bypassPermissions') {
        return {
          name: agentNames[agent],
          shellPath: agent,
          shellArgs: ['--dangerously-bypass-approvals-and-sandbox', prompt]
        }
      }

      const approvalMap: Record<Exclude<AIPermissionMode, 'bypassPermissions'>, string> = {
        default: 'on-request',
        plan: 'on-request',
        acceptEdits: 'never'
      }
      return {
        name: agentNames[agent],
        shellPath: agent,
        shellArgs: ['--ask-for-approval', approvalMap[permissionMode], prompt]
      }
    }
    case 'copilot':
      return { name: agentNames[agent], shellPath: agent, shellArgs: [prompt] }
    case 'opencode':
      return { name: agentNames[agent], shellPath: agent, shellArgs: ['run', prompt] }
  }
}
