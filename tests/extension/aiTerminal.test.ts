import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { promises as fs } from 'fs'
import * as os from 'os'
import * as path from 'path'
import {
  buildAITerminalLaunch,
  buildFeaturePrompt,
  getAITerminalOptions,
  normalizeAIAgent,
  normalizeAIPermissionMode
} from '../../src/extension/aiTerminal'

describe('aiTerminal', () => {
  it('starts Cursor interactively and uses its explicit Plan mode without bypassing permissions', () => {
    const prompt = 'literal "prompt" ; & %PATH% $(whoami)'
    expect(normalizeAIAgent('cursor')).toBe('cursor')
    for (const mode of ['default', 'acceptEdits', 'bypassPermissions'] as const) {
      expect(buildAITerminalLaunch('cursor', mode, prompt)).toEqual({
        name: 'Cursor', shellPath: 'agent', shellArgs: [prompt]
      })
    }
    expect(buildAITerminalLaunch('cursor', 'plan', prompt).shellArgs).toEqual(['--mode', 'plan', prompt])
  })
  it('builds a feature prompt from feature context', () => {
    const prompt = buildFeaturePrompt({
      title: 'Add swimlanes',
      priority: 'high',
      labels: ['ui', 'planning'],
      content: '# Add swimlanes\n\nGroup cards by epic.',
      filePath: '/workspace/.devtool/features/add-swimlanes.md'
    })

    expect(prompt).toBe(
      'Implement this feature: "Add swimlanes" (high priority) [ui, planning]. # Add swimlanes Group cards by epic. See full details in: /workspace/.devtool/features/add-swimlanes.md'
    )
  })

  it('truncates long descriptions using the existing 200 character limit', () => {
    const prompt = buildFeaturePrompt({
      title: 'Long feature',
      priority: 'medium',
      labels: [],
      content: 'x'.repeat(201),
      filePath: '/workspace/feature.md'
    })

    expect(prompt).toContain(`${'x'.repeat(200)}... See full details in: /workspace/feature.md`)
  })

  it('passes prompts with shell metacharacters as one terminal argument', () => {
    const prompt = buildFeaturePrompt({
      title: "bad'; Write-Host pwned; '",
      priority: 'critical',
      labels: ['security'],
      content: "Do not split this: $(whoami) & calc.exe | echo 'owned'",
      filePath: 'C:\\workspace\\feature.md'
    })

    const launch = buildAITerminalLaunch('claude', 'default', prompt)

    expect(launch).toEqual({
      name: 'Claude Code',
      shellPath: 'claude',
      shellArgs: [prompt]
    })
    expect(launch.shellArgs[0]).toContain("bad'; Write-Host pwned; '")
    expect(launch.shellArgs[0]).not.toContain("'\\''")
  })

  it('adds Claude permission mode arguments before the prompt', () => {
    const launch = buildAITerminalLaunch('claude', 'acceptEdits', 'prompt')

    expect(launch).toEqual({
      name: 'Claude Code',
      shellPath: 'claude',
      shellArgs: ['--permission-mode', 'acceptEdits', 'prompt']
    })
  })

  it('maps Codex permission modes to approval arguments', () => {
    expect(buildAITerminalLaunch('codex', 'default', 'prompt').shellArgs)
      .toEqual(['--ask-for-approval', 'on-request', 'prompt'])
    expect(buildAITerminalLaunch('codex', 'plan', 'prompt').shellArgs)
      .toEqual(['--ask-for-approval', 'on-request', 'prompt'])
    expect(buildAITerminalLaunch('codex', 'acceptEdits', 'prompt').shellArgs)
      .toEqual(['--ask-for-approval', 'never', 'prompt'])
    expect(buildAITerminalLaunch('codex', 'bypassPermissions', 'prompt').shellArgs)
      .toEqual(['--dangerously-bypass-approvals-and-sandbox', 'prompt'])
  })

  it('starts OpenCode interactively with the prompt', () => {
    expect(buildAITerminalLaunch('opencode', 'default', 'prompt')).toEqual({
      name: 'OpenCode',
      shellPath: 'opencode',
      shellArgs: ['--prompt', 'prompt']
    })
  })

  it('starts Copilot interactively with the prompt', () => {
    expect(buildAITerminalLaunch('copilot', 'default', 'prompt')).toEqual({
      name: 'GitHub Copilot',
      shellPath: 'copilot',
      shellArgs: ['--interactive', 'prompt']
    })
  })

  it('normalizes unknown webview/config values to safe defaults', () => {
    expect(normalizeAIAgent('copilot')).toBe('copilot')
    expect(normalizeAIAgent('powershell')).toBe('claude')
    expect(normalizeAIAgent(undefined)).toBe('claude')

    expect(normalizeAIPermissionMode('plan')).toBe('plan')
    expect(normalizeAIPermissionMode('unsafe-mode')).toBe('default')
    expect(normalizeAIPermissionMode(undefined)).toBe('default')
  })
})

describe('Windows agent resolution', () => {
  let directory: string

  beforeEach(async () => {
    directory = await fs.mkdtemp(path.join(os.tmpdir(), 'kanban-agent-'))
  })
  afterEach(async () => { await fs.rm(directory, { recursive: true, force: true }) })

  async function npmAgent(bin: string, binDirectory = directory) {
    const modules = path.basename(binDirectory) === '.bin' ? path.dirname(binDirectory) : path.join(binDirectory, 'node_modules')
    const packageDirectory = path.join(modules, '@openai', 'codex')
    await fs.mkdir(binDirectory, { recursive: true })
    await fs.mkdir(path.dirname(path.join(packageDirectory, bin)), { recursive: true })
    await fs.writeFile(path.join(binDirectory, 'codex.cmd'), '@echo should never run')
    await fs.writeFile(path.join(packageDirectory, 'package.json'), JSON.stringify({ bin: { codex: bin } }))
    await fs.writeFile(path.join(packageDirectory, bin), '')
    return path.join(packageDirectory, bin)
  }

  it('bypasses Cursor shell wrappers and ignores staged versions', async () => {
    await fs.writeFile(path.join(directory, 'agent.cmd'), '@echo must not run')
    for (const version of ['2026.9.30-abc', '2026.10.22-27dcf5f', '2099.01.01-abc.new', '2099.01.01-abc.previous']) {
      const versionDirectory = path.join(directory, 'versions', version)
      await fs.mkdir(versionDirectory, { recursive: true })
      await fs.writeFile(path.join(versionDirectory, 'node.exe'), '')
      await fs.writeFile(path.join(versionDirectory, 'index.js'), '')
    }
    const prompt = '" & echo injected & %PATH% !PATH!'
    const launch = await getAITerminalOptions('cursor', 'plan', prompt, 'win32', { PATH: directory })
    const versionDirectory = path.join(directory, 'versions', '2026.10.22-27dcf5f')
    expect(launch.shellPath).toBe(path.join(versionDirectory, 'node.exe'))
    expect(launch.shellArgs).toEqual([path.join(versionDirectory, 'index.js'), '--mode', 'plan', prompt])
  })

  it('resolves native Cursor as agent.exe, never cursor.exe or a batch fallback', async () => {
    expect((await getAITerminalOptions('cursor', 'default', 'prompt', 'win32', { PATH: directory })).shellPath).toBe('agent.exe')
    await fs.writeFile(path.join(directory, 'agent.exe'), '')
    expect((await getAITerminalOptions('cursor', 'default', 'prompt', 'win32', { PATH: directory })).shellPath).toBe(path.join(directory, 'agent.exe'))
  })

  it('launches global npm JavaScript directly through Node, preserving hostile arguments', async () => {
    const entryPoint = await npmAgent('bin/codex.js')
    const prompt = '" & echo injected & rem %PATH% !PATH! $(whoami) `x`\nnext line'
    const launch = await getAITerminalOptions('codex', 'default', prompt, 'win32', { Path: directory })
    expect(launch.shellPath).toBe('node.exe')
    expect(launch.shellArgs).toEqual([entryPoint, '--ask-for-approval', 'on-request', prompt])
  })

  it('resolves local npm bins and a Node executable alongside the shim', async () => {
    const binDirectory = path.join(directory, 'node_modules', '.bin')
    const entryPoint = await npmAgent('bin/codex.js', binDirectory)
    const nodePath = path.join(binDirectory, 'node.exe')
    await fs.writeFile(nodePath, '')
    const launch = await getAITerminalOptions('codex', 'default', 'prompt', 'win32', { PATH: binDirectory })
    expect(launch.shellPath).toBe(nodePath)
    expect(launch.shellArgs[0]).toBe(entryPoint)
  })

  it('launches a native npm binary without Node', async () => {
    const entryPoint = await npmAgent('bin/codex.exe')
    const launch = await getAITerminalOptions('codex', 'default', 'prompt', 'win32', { PATH: directory })
    expect(launch.shellPath).toBe(entryPoint)
    expect(launch.shellArgs).toEqual(['--ask-for-approval', 'on-request', 'prompt'])
  })

  it('prefers the native executable beside an npm shim', async () => {
    await npmAgent('bin/codex.js')
    const executable = path.join(directory, 'codex.exe')
    await fs.writeFile(executable, '')
    const launch = await getAITerminalOptions('codex', 'default', 'prompt', 'win32', { PATH: directory })
    expect(launch.shellPath).toBe(executable)
  })

  it('never falls back to executing batch files', async () => {
    await npmAgent('bin/codex.cmd')
    await expect(getAITerminalOptions('codex', 'default', 'prompt', 'win32', { PATH: directory }))
      .rejects.toThrow('Unsupported executable')
  })

  it('uses an explicit exe suffix when no supported installation is found', async () => {
    const launch = await getAITerminalOptions('codex', 'default', 'prompt', 'win32', { PATH: directory })
    expect(launch.shellPath).toBe('codex.exe')
  })

  it('keeps POSIX launches as direct process arguments', async () => {
    expect(await getAITerminalOptions('claude', 'default', 'prompt', 'linux'))
      .toEqual(buildAITerminalLaunch('claude', 'default', 'prompt'))
  })
})
