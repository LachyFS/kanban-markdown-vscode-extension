import * as path from 'path'
import Mocha from 'mocha'
import { glob } from 'glob'

/**
 * Entry point called by @vscode/test-electron after VS Code launches.
 * Must export a `run()` function that returns a Promise resolving when
 * the suite finishes.
 */
export function run(): Promise<void> {
  const mocha = new Mocha({
    ui: 'tdd',
    color: true,
    timeout: 15_000
  })

  const testsRoot = __dirname

  return new Promise((resolve, reject) => {
    glob('**/*.test.js', { cwd: testsRoot })
      .then(files => {
        files.forEach(f => mocha.addFile(path.resolve(testsRoot, f)))

        mocha.run(failures => {
          if (failures > 0) {
            reject(new Error(`${failures} integration test(s) failed.`))
          } else {
            resolve()
          }
        })
      })
      .catch(reject)
  })
}
