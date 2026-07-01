import { describe, expect, it } from 'vitest'
import {
  buildAITerminalLaunch,
  buildFeaturePrompt,
  normalizeAIAgent,
  normalizeAIPermissionMode
} from '../../src/extension/aiTerminal'

describe('aiTerminal', () => {
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

  it('normalizes unknown webview/config values to safe defaults', () => {
    expect(normalizeAIAgent('copilot')).toBe('copilot')
    expect(normalizeAIAgent('powershell')).toBe('claude')
    expect(normalizeAIAgent(undefined)).toBe('claude')

    expect(normalizeAIPermissionMode('plan')).toBe('plan')
    expect(normalizeAIPermissionMode('unsafe-mode')).toBe('default')
    expect(normalizeAIPermissionMode(undefined)).toBe('default')
  })
})
