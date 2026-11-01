import { promises as fs } from 'fs'
import * as path from 'path'
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
  shellPath: string
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

const agentPackages: Record<AIAgent, string> = {
  claude: '@anthropic-ai/claude-code',
  codex: '@openai/codex',
  copilot: '@github/copilot',
  opencode: 'opencode-ai'
}

/** Resolve npm's Windows shims to their entry point, without executing cmd.exe. */
export async function getAITerminalOptions(
  agent: AIAgent,
  permissionMode: AIPermissionMode,
  prompt: string,
  platform: NodeJS.Platform = process.platform,
  env: NodeJS.ProcessEnv = process.env
): Promise<AITerminalLaunch> {
  const launch = buildAITerminalLaunch(agent, permissionMode, prompt)
  if (platform !== 'win32') return launch

  const searchPath = Object.entries(env).find(([key]) => key.toLowerCase() === 'path')?.[1] || ''
  for (const entry of searchPath.split(';')) {
    const directory = entry.replace(/^"|"$/g, '')
    if (!path.isAbsolute(directory)) continue

    const executable = path.join(directory, `${agent}.exe`)
    if (await isFile(executable)) return { ...launch, shellPath: executable }
    if (!await isFile(path.join(directory, `${agent}.cmd`))) continue

    // npm global bins sit beside node_modules; local bins live in node_modules/.bin.
    const modules = path.basename(directory) === '.bin' ? path.dirname(directory) : path.join(directory, 'node_modules')
    const packageDirectory = path.join(modules, agentPackages[agent])
    const manifest = JSON.parse(await fs.readFile(path.join(packageDirectory, 'package.json'), 'utf8'))
    const bin = typeof manifest.bin === 'string' ? manifest.bin : manifest.bin?.[agent]
    if (typeof bin !== 'string') throw new Error(`No executable found for ${agent}`)
    const entryPoint = path.resolve(packageDirectory, bin)
    if (!await isFile(entryPoint)) throw new Error(`No executable found for ${agent}`)
    if (path.extname(entryPoint).toLowerCase() === '.exe') {
      return { ...launch, shellPath: entryPoint }
    }
    if (!['', '.js', '.cjs', '.mjs'].includes(path.extname(entryPoint).toLowerCase())) {
      throw new Error(`Unsupported executable for ${agent}: ${entryPoint}`)
    }
    const localNode = path.join(directory, 'node.exe')
    return {
      ...launch,
      shellPath: await isFile(localNode) ? localNode : 'node.exe',
      shellArgs: [entryPoint, ...launch.shellArgs]
    }
  }

  // Use an explicit executable suffix so VS Code cannot resolve a .cmd/.bat file.
  return { ...launch, shellPath: `${agent}.exe` }
}

async function isFile(filePath: string): Promise<boolean> {
  try {
    return (await fs.stat(filePath)).isFile()
  } catch {
    return false
  }
}

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
      return { name: agentNames[agent], shellPath: agent, shellArgs: ['--interactive', prompt] }
    case 'opencode':
      return { name: agentNames[agent], shellPath: agent, shellArgs: ['--prompt', prompt] }
  }
}
