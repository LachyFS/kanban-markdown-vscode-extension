/**
 * Integration tests for kanban-markdown VS Code extension.
 *
 * This suite runs inside a real VS Code host (via @vscode/test-electron),
 * so it has access to the actual vscode module and the real file system.
 * Tests create isolated temp directories and clean up after themselves.
 */

import * as assert from 'assert'
import * as path from 'path'
import * as os from 'os'
import * as vscode from 'vscode'

import {
  fileExists,
  ensureStatusSubfolders,
  moveFeatureFile,
  getFeatureFilePath,
  getStatusFromPath
} from '../../../src/extension/featureFileUtils'

import {
  parseFeatureFile,
  serializeFeature
} from '../../../src/shared/featureFrontmatter'

import type { Feature } from '../../../src/shared/types'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTmpDir(): string {
  return path.join(os.tmpdir(), `kanban-int-${Date.now()}-${Math.random().toString(36).slice(2)}`)
}

async function createTmpDir(): Promise<string> {
  const dir = makeTmpDir()
  await vscode.workspace.fs.createDirectory(vscode.Uri.file(dir))
  return dir
}

async function deleteTmpDir(dir: string): Promise<void> {
  try {
    await vscode.workspace.fs.delete(vscode.Uri.file(dir), { recursive: true })
  } catch {
    // ignore — temp dir may already be gone
  }
}

async function writeFile(filePath: string, content: string): Promise<void> {
  await vscode.workspace.fs.writeFile(
    vscode.Uri.file(filePath),
    Buffer.from(content, 'utf8')
  )
}

async function readFile(filePath: string): Promise<string> {
  const bytes = await vscode.workspace.fs.readFile(vscode.Uri.file(filePath))
  return Buffer.from(bytes).toString('utf8')
}

function makeFeature(overrides: Partial<Feature> = {}): Feature {
  return {
    id: 'test-id-001',
    status: 'todo',
    priority: 'high',
    assignee: 'alice',
    dueDate: '2026-06-01',
    created: '2026-01-15T10:00:00.000Z',
    modified: '2026-01-15T10:00:00.000Z',
    completedAt: null,
    labels: ['backend', 'api'],
    order: 'a0',
    content: '# Test Feature\n\nA test description.',
    filePath: '',
    ...overrides
  }
}

// ---------------------------------------------------------------------------
// Suite: fileExists
// ---------------------------------------------------------------------------

suite('Integration: fileExists', () => {
  let tmpDir: string

  setup(async () => { tmpDir = await createTmpDir() })
  teardown(async () => { await deleteTmpDir(tmpDir) })

  test('returns false for a path that does not exist', async () => {
    const result = await fileExists(path.join(tmpDir, 'ghost.md'))
    assert.strictEqual(result, false)
  })

  test('returns true for a file that was just written', async () => {
    const filePath = path.join(tmpDir, 'present.md')
    await writeFile(filePath, 'hello')
    const result = await fileExists(filePath)
    assert.strictEqual(result, true)
  })

  test('returns true for a directory', async () => {
    const dirPath = path.join(tmpDir, 'subdir')
    await vscode.workspace.fs.createDirectory(vscode.Uri.file(dirPath))
    const result = await fileExists(dirPath)
    assert.strictEqual(result, true)
  })
})

// ---------------------------------------------------------------------------
// Suite: ensureStatusSubfolders
// ---------------------------------------------------------------------------

suite('Integration: ensureStatusSubfolders', () => {
  let tmpDir: string

  setup(async () => { tmpDir = await createTmpDir() })
  teardown(async () => { await deleteTmpDir(tmpDir) })

  test('creates the done/ subdirectory', async () => {
    await ensureStatusSubfolders(tmpDir)
    assert.ok(await fileExists(path.join(tmpDir, 'done')))
  })

  test('is idempotent — calling twice does not throw', async () => {
    await ensureStatusSubfolders(tmpDir)
    await ensureStatusSubfolders(tmpDir)  // second call should not throw
    assert.ok(await fileExists(path.join(tmpDir, 'done')))
  })
})

// ---------------------------------------------------------------------------
// Suite: getFeatureFilePath / getStatusFromPath
// ---------------------------------------------------------------------------

suite('Integration: getFeatureFilePath and getStatusFromPath', () => {
  const featuresDir = '/workspace/.devtool/features'

  test('getFeatureFilePath routes done status to done/ subdir', () => {
    const result = getFeatureFilePath(featuresDir, 'done', 'my-feature')
    assert.strictEqual(result, path.join(featuresDir, 'done', 'my-feature.md'))
  })

  test('getFeatureFilePath places non-done statuses at the root', () => {
    for (const status of ['backlog', 'todo', 'in-progress', 'review'] as const) {
      const result = getFeatureFilePath(featuresDir, status, 'my-feature')
      assert.strictEqual(result, path.join(featuresDir, 'my-feature.md'))
    }
  })

  test('getStatusFromPath returns done for file inside done/', () => {
    const filePath = path.join(featuresDir, 'done', 'completed.md')
    assert.strictEqual(getStatusFromPath(filePath, featuresDir), 'done')
  })

  test('getStatusFromPath returns null for file at root', () => {
    const filePath = path.join(featuresDir, 'in-progress-feature.md')
    assert.strictEqual(getStatusFromPath(filePath, featuresDir), null)
  })
})

// ---------------------------------------------------------------------------
// Suite: moveFeatureFile
// ---------------------------------------------------------------------------

suite('Integration: moveFeatureFile', () => {
  let tmpDir: string

  setup(async () => {
    tmpDir = await createTmpDir()
    await ensureStatusSubfolders(tmpDir)
  })
  teardown(async () => { await deleteTmpDir(tmpDir) })

  test('returns the same path when source equals the computed target', async () => {
    const filePath = path.join(tmpDir, 'unchanged.md')
    await writeFile(filePath, 'content')
    const result = await moveFeatureFile(filePath, tmpDir, 'todo')
    assert.strictEqual(result, filePath)
    assert.ok(await fileExists(filePath), 'file should still exist')
  })

  test('moves file to done/ when status changes to done', async () => {
    const srcPath = path.join(tmpDir, 'going-to-done.md')
    await writeFile(srcPath, 'content')

    const result = await moveFeatureFile(srcPath, tmpDir, 'done')
    const expectedPath = path.join(tmpDir, 'done', 'going-to-done.md')

    assert.strictEqual(result, expectedPath)
    assert.ok(await fileExists(expectedPath), 'file should exist at done/ path')
    assert.strictEqual(await fileExists(srcPath), false, 'original file should be gone')
  })

  test('moves file from done/ back to root when status changes', async () => {
    const donePath = path.join(tmpDir, 'done', 'came-from-done.md')
    await writeFile(donePath, 'content')

    const result = await moveFeatureFile(donePath, tmpDir, 'in-progress')
    const expectedPath = path.join(tmpDir, 'came-from-done.md')

    assert.strictEqual(result, expectedPath)
    assert.ok(await fileExists(expectedPath))
    assert.strictEqual(await fileExists(donePath), false)
  })

  test('appends -1 suffix when target filename already exists', async () => {
    const srcPath = path.join(tmpDir, 'collision.md')
    const collidePath = path.join(tmpDir, 'done', 'collision.md')
    await writeFile(srcPath, 'src content')
    await writeFile(collidePath, 'pre-existing content')

    const result = await moveFeatureFile(srcPath, tmpDir, 'done')
    const expectedPath = path.join(tmpDir, 'done', 'collision-1.md')

    assert.strictEqual(result, expectedPath)
    assert.ok(await fileExists(expectedPath))
    assert.ok(await fileExists(collidePath), 'original target should still exist')
  })

  test('increments suffix until a free slot is found', async () => {
    const srcPath = path.join(tmpDir, 'multi.md')
    await writeFile(srcPath, 'src')
    await writeFile(path.join(tmpDir, 'done', 'multi.md'), 'v0')
    await writeFile(path.join(tmpDir, 'done', 'multi-1.md'), 'v1')

    const result = await moveFeatureFile(srcPath, tmpDir, 'done')
    assert.strictEqual(result, path.join(tmpDir, 'done', 'multi-2.md'))
    assert.ok(await fileExists(path.join(tmpDir, 'done', 'multi-2.md')))
  })
})

// ---------------------------------------------------------------------------
// Suite: parseFeatureFile and serializeFeature round-trip
// ---------------------------------------------------------------------------

suite('Integration: frontmatter round-trip with vscode.workspace.fs', () => {
  let tmpDir: string

  setup(async () => { tmpDir = await createTmpDir() })
  teardown(async () => { await deleteTmpDir(tmpDir) })

  test('all fields survive serialize → write → read → parse', async () => {
    const feature = makeFeature()
    const filePath = path.join(tmpDir, 'round-trip.md')

    await writeFile(filePath, serializeFeature(feature))
    const content = await readFile(filePath)
    const parsed = parseFeatureFile(content, filePath)

    assert.ok(parsed !== null, 'parseFeatureFile should return a Feature')
    assert.strictEqual(parsed!.id, feature.id)
    assert.strictEqual(parsed!.status, feature.status)
    assert.strictEqual(parsed!.priority, feature.priority)
    assert.strictEqual(parsed!.assignee, feature.assignee)
    assert.strictEqual(parsed!.dueDate, feature.dueDate)
    assert.strictEqual(parsed!.order, feature.order)
    assert.deepStrictEqual(parsed!.labels, feature.labels)
    assert.strictEqual(parsed!.content, feature.content)
  })

  test('null optional fields survive round-trip', async () => {
    const feature = makeFeature({
      priority: 'medium',
      assignee: null,
      dueDate: null,
      completedAt: null,
      labels: []
    })
    const filePath = path.join(tmpDir, 'nulls.md')

    await writeFile(filePath, serializeFeature(feature))
    const content = await readFile(filePath)
    const parsed = parseFeatureFile(content, filePath)

    assert.ok(parsed !== null)
    assert.strictEqual(parsed!.assignee, null)
    assert.strictEqual(parsed!.dueDate, null)
    assert.strictEqual(parsed!.completedAt, null)
    assert.deepStrictEqual(parsed!.labels, [])
  })

  test('completedAt is preserved when set', async () => {
    const feature = makeFeature({
      status: 'done',
      completedAt: '2026-03-01T09:00:00.000Z'
    })
    const filePath = path.join(tmpDir, 'completed.md')

    await writeFile(filePath, serializeFeature(feature))
    const content = await readFile(filePath)
    const parsed = parseFeatureFile(content, filePath)

    assert.ok(parsed !== null)
    assert.strictEqual(parsed!.completedAt, feature.completedAt)
  })

  test('parse returns null for a file with no frontmatter block', async () => {
    const filePath = path.join(tmpDir, 'plain.md')
    await writeFile(filePath, '# Just a heading\n\nNo frontmatter here.')

    const content = await readFile(filePath)
    const result = parseFeatureFile(content, filePath)
    assert.strictEqual(result, null)
  })

  test('CRLF line endings are normalised before parsing', async () => {
    const feature = makeFeature({ id: 'crlf-test' })
    const serialized = serializeFeature(feature).replace(/\n/g, '\r\n')
    const filePath = path.join(tmpDir, 'crlf.md')

    await writeFile(filePath, serialized)
    const content = await readFile(filePath)
    const parsed = parseFeatureFile(content, filePath)

    assert.ok(parsed !== null, 'CRLF file should parse successfully')
    assert.strictEqual(parsed!.id, 'crlf-test')
  })
})

// ---------------------------------------------------------------------------
// Suite: extension activation
// ---------------------------------------------------------------------------

suite('Integration: extension activation', () => {
  test('the extension is available in the extension host', async () => {
    const ext = vscode.extensions.getExtension('LachyFS.kanban-markdown')
    // The extension may or may not auto-activate in this minimal workspace;
    // the important thing is it can be found and activated without throwing.
    assert.ok(ext !== undefined, 'Extension should be registered in the host')
    if (!ext!.isActive) {
      await ext!.activate()
    }
    assert.ok(ext!.isActive, 'Extension should activate without errors')
  })
})
