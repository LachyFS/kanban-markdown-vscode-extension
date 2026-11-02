import * as assert from 'assert'
import { execFileSync } from 'child_process'
import { promises as fs } from 'fs'
import * as os from 'os'
import * as path from 'path'
import * as vscode from 'vscode'
import { buildAITerminalLaunch, buildFeaturePrompt, getAITerminalOptions } from '../../../src/extension/aiTerminal'
import type { AIAgent, AIPermissionMode } from '../../../src/shared/types'

suite('Integration: AI terminal argument safety', () => {
  let directory: string
  let terminal: vscode.Terminal | undefined

  setup(async () => {
    directory = await fs.mkdtemp(path.join(os.tmpdir(), 'kanban terminal '))
  })
  teardown(async () => {
    terminal?.dispose()
    terminal = undefined
    await fs.rm(directory, { recursive: true, force: true })
  })

  const packages: Partial<Record<AIAgent, string>> = {
    claude: '@anthropic-ai/claude-code',
    codex: '@openai/codex',
    copilot: '@github/copilot',
    opencode: 'opencode-ai'
  }

  const cases: { agent: AIAgent; mode: AIPermissionMode }[] = [
    ...Object.keys(packages).map(agent => ({ agent: agent as AIAgent, mode: 'default' as const })),
    { agent: 'cursor', mode: 'default' },
    { agent: 'cursor', mode: 'plan' }
  ]
  for (const { agent, mode } of cases) {
    test(`${agent} (${mode}) receives card content literally in a real terminal`, async () => {
      const record = path.join(directory, 'arguments.json')
      const marker = path.join(directory, 'injected.txt')
      const fixture = `#!/usr/bin/env node
require('fs').writeFileSync(process.env.KANBAN_TEST_RECORD, JSON.stringify({ args: process.argv.slice(2), cwd: process.cwd(), tty: !!process.stdin.isTTY }));
`
      const binary = agent === 'cursor' ? 'agent' : agent
      if (process.platform === 'win32' && agent === 'cursor') {
        const versionDirectory = path.join(directory, 'versions', '2026.10.22-27dcf5f')
        await fs.mkdir(versionDirectory, { recursive: true })
        const nodePath = execFileSync('where.exe', ['node.exe'], { encoding: 'utf8' }).trim().split(/\r?\n/)[0]
        await fs.copyFile(nodePath, path.join(versionDirectory, 'node.exe'))
        await fs.writeFile(path.join(versionDirectory, 'index.js'), fixture)
        await fs.writeFile(path.join(directory, 'agent.cmd'), '@echo injected > "%KANBAN_TEST_MARKER%"\r\n')
      } else if (process.platform === 'win32') {
        const packageDirectory = path.join(directory, 'node_modules', packages[agent]!)
        await fs.mkdir(packageDirectory, { recursive: true })
        await fs.writeFile(path.join(packageDirectory, 'package.json'), JSON.stringify({ bin: { [agent]: 'cli.js' } }))
        await fs.writeFile(path.join(packageDirectory, 'cli.js'), fixture)
        // The launcher must bypass this shim entirely, even for npm installations.
        await fs.writeFile(path.join(directory, `${agent}.cmd`), '@echo injected > "%KANBAN_TEST_MARKER%"\r\n')
      } else {
        await fs.writeFile(path.join(directory, binary), fixture, { mode: 0o755 })
      }

      const prompt = buildFeaturePrompt({
        title: 'Quotes " and \' ; & | < > $(whoami) `whoami` %PATH% !PATH! — café',
        priority: 'high',
        labels: ['security', '\'; echo injected > "$KANBAN_TEST_MARKER"; #'],
        content: 'Literal content with\nnewlines and Windows C:\\ paths',
        filePath: path.join(directory, 'feature with spaces.md')
      })
      const envPath = Object.entries(process.env).find(([key]) => key.toLowerCase() === 'path')?.[1] || ''
      const searchPath = `${directory}${path.delimiter}${envPath}`
      const launch = await getAITerminalOptions(agent, mode, prompt, process.platform, { PATH: searchPath })
      let subscription: vscode.Disposable | undefined
      let timeout: ReturnType<typeof setTimeout> | undefined
      try {
        const closed = new Promise<vscode.Terminal>((resolve, reject) => {
          subscription = vscode.window.onDidCloseTerminal(closedTerminal => {
            if (closedTerminal === terminal) resolve(closedTerminal)
          })
          timeout = setTimeout(() => reject(new Error(`${agent} terminal did not exit`)), 12_000)
        })
        terminal = vscode.window.createTerminal({
          ...launch,
          cwd: directory,
          env: { PATH: searchPath, KANBAN_TEST_RECORD: record, KANBAN_TEST_MARKER: marker }
        })
        terminal.show()
        const exited = await closed
        assert.strictEqual(exited.exitStatus?.code, 0, 'agent process should exit successfully')
        const captured = JSON.parse(await fs.readFile(record, 'utf8'))
        assert.deepStrictEqual(captured.args, buildAITerminalLaunch(agent, mode, prompt).shellArgs)
        assert.strictEqual(captured.cwd, directory)
        assert.strictEqual(captured.tty, true, 'agent should remain interactive')
        assert.strictEqual(await fs.stat(marker).then(() => true, () => false), false, 'no injected command or shim should execute')
      } finally {
        subscription?.dispose()
        clearTimeout(timeout)
      }
    })
  }
})
