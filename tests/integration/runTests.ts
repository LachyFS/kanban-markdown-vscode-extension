import { runTests } from '@vscode/test-electron'
import * as path from 'path'

async function main(): Promise<void> {
  // The extension root (where package.json lives)
  const extensionDevelopmentPath = path.resolve(__dirname, '../../..')

  // The compiled test suite entry module (this file's sibling suite/index.js)
  const extensionTestsPath = path.resolve(__dirname, './suite/index')

  // A minimal workspace folder to open inside the test VS Code instance
  const workspacePath = path.resolve(__dirname, '../../../tests/integration/fixtures/workspace')

  await runTests({
    extensionDevelopmentPath,
    extensionTestsPath,
    launchArgs: [
      workspacePath,
      '--disable-extensions',        // don't load other installed extensions
      '--disable-workspace-trust'    // skip trust dialogs
    ]
  })
}

main().catch(err => {
  console.error('Integration test runner failed:', err)
  process.exit(1)
})
