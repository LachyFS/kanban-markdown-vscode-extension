import { describe, it, expect, vi } from 'vitest'
import path from 'path'
import type { FsAdapter } from '../../src/extension/featureFileUtils'

// ---------------------------------------------------------------------------
// vscode stub — only Uri.file is needed by featureFileUtils
// ---------------------------------------------------------------------------

vi.mock('vscode', () => ({
  Uri: {
    file: (p: string) => ({ fsPath: p, toString: () => `file://${p}` })
  }
}))

import {
  getFeatureFilePath,
  getStatusFromPath,
  fileExists,
  ensureStatusSubfolders,
  moveFeatureFile
} from '../../src/extension/featureFileUtils'

// ---------------------------------------------------------------------------
// In-memory FsAdapter factory
// ---------------------------------------------------------------------------

const FEATURES_DIR = '/workspace/.devtool/features'

/**
 * Builds a FsAdapter stub whose behaviour is controlled by the `existing`
 * set: stat resolves for paths in the set and rejects for all others.
 * rename and createDirectory are spies that always resolve.
 */
function makeFs(existing: Set<string> = new Set()): FsAdapter & {
  rename: ReturnType<typeof vi.fn>
  createDirectory: ReturnType<typeof vi.fn>
} {
  return {
    stat: vi.fn((uri: { fsPath: string }) => {
      if (existing.has(uri.fsPath)) return Promise.resolve({} as never)
      return Promise.reject(new Error('ENOENT'))
    }),
    rename: vi.fn(() => Promise.resolve()),
    createDirectory: vi.fn(() => Promise.resolve())
  }
}

// ---------------------------------------------------------------------------
// getFeatureFilePath
// ---------------------------------------------------------------------------

describe('getFeatureFilePath', () => {
  it('returns path under done/ when status is "done"', () => {
    expect(getFeatureFilePath(FEATURES_DIR, 'done', 'my-feature-2026-02-23'))
      .toBe(path.join(FEATURES_DIR, 'done', 'my-feature-2026-02-23.md'))
  })

  it('returns path at root for any non-done status', () => {
    for (const status of ['backlog', 'todo', 'in-progress', 'review']) {
      expect(getFeatureFilePath(FEATURES_DIR, status, 'my-feature'))
        .toBe(path.join(FEATURES_DIR, 'my-feature.md'))
    }
  })
})

// ---------------------------------------------------------------------------
// getStatusFromPath
// ---------------------------------------------------------------------------

describe('getStatusFromPath', () => {
  it('returns "done" for a file inside the done/ subdirectory', () => {
    const filePath = path.join(FEATURES_DIR, 'done', 'my-feature.md')
    expect(getStatusFromPath(filePath, FEATURES_DIR)).toBe('done')
  })

  it('returns null for a file at the features root', () => {
    const filePath = path.join(FEATURES_DIR, 'my-feature.md')
    expect(getStatusFromPath(filePath, FEATURES_DIR)).toBeNull()
  })

  it('returns null for a file nested deeper than done/', () => {
    const filePath = path.join(FEATURES_DIR, 'done', 'archive', 'old.md')
    expect(getStatusFromPath(filePath, FEATURES_DIR)).toBeNull()
  })

  it('returns null for a file in a non-done subdirectory', () => {
    const filePath = path.join(FEATURES_DIR, 'review', 'my-feature.md')
    expect(getStatusFromPath(filePath, FEATURES_DIR)).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// fileExists
// ---------------------------------------------------------------------------

describe('fileExists', () => {
  it('returns true when stat resolves', async () => {
    const existing = path.join(FEATURES_DIR, 'present.md')
    const fs = makeFs(new Set([existing]))
    expect(await fileExists(existing, fs)).toBe(true)
  })

  it('returns false when stat rejects', async () => {
    const fs = makeFs(new Set())
    expect(await fileExists(path.join(FEATURES_DIR, 'absent.md'), fs)).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// ensureStatusSubfolders
// ---------------------------------------------------------------------------

describe('ensureStatusSubfolders', () => {
  it('calls createDirectory with the done/ path', async () => {
    const fs = makeFs()
    await ensureStatusSubfolders(FEATURES_DIR, fs)
    expect(fs.createDirectory).toHaveBeenCalledOnce()
    const uri = (fs.createDirectory as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(uri.fsPath).toBe(path.join(FEATURES_DIR, 'done'))
  })
})

// ---------------------------------------------------------------------------
// moveFeatureFile
// ---------------------------------------------------------------------------

describe('moveFeatureFile', () => {
  const currentPath = path.join(FEATURES_DIR, 'my-feature.md')

  it('returns currentPath unchanged when target equals current (no-op)', async () => {
    // Moving a done file to done — currentPath is already in done/
    const donePath = path.join(FEATURES_DIR, 'done', 'my-feature.md')
    const fs = makeFs()
    const result = await moveFeatureFile(donePath, FEATURES_DIR, 'done', fs)
    expect(result).toBe(donePath)
    expect(fs.rename).not.toHaveBeenCalled()
  })

  it('moves to root dir for non-done status', async () => {
    const fs = makeFs()
    // currentPath is already at root, so move a file from done/ back to root instead
    const fromDone = path.join(FEATURES_DIR, 'done', 'my-feature.md')
    const result2 = await moveFeatureFile(fromDone, FEATURES_DIR, 'in-progress', fs)
    expect(result2).toBe(path.join(FEATURES_DIR, 'my-feature.md'))
    expect(fs.rename).toHaveBeenCalledOnce()
  })

  it('moves to done/ subdir when newStatus is "done"', async () => {
    const fs = makeFs()
    const result = await moveFeatureFile(currentPath, FEATURES_DIR, 'done', fs)
    expect(result).toBe(path.join(FEATURES_DIR, 'done', 'my-feature.md'))
    expect(fs.rename).toHaveBeenCalledOnce()
  })

  it('calls createDirectory on the target directory before renaming', async () => {
    const fs = makeFs()
    await moveFeatureFile(currentPath, FEATURES_DIR, 'done', fs)
    expect(fs.createDirectory).toHaveBeenCalledOnce()
    const uri = (fs.createDirectory as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(uri.fsPath).toBe(path.join(FEATURES_DIR, 'done'))
  })

  it('applies a -1 suffix when the target path is already taken', async () => {
    const target = path.join(FEATURES_DIR, 'done', 'my-feature.md')
    const fs = makeFs(new Set([target]))
    const result = await moveFeatureFile(currentPath, FEATURES_DIR, 'done', fs)
    expect(result).toBe(path.join(FEATURES_DIR, 'done', 'my-feature-1.md'))
  })

  it('increments counter until a free path is found', async () => {
    const target0 = path.join(FEATURES_DIR, 'done', 'my-feature.md')
    const target1 = path.join(FEATURES_DIR, 'done', 'my-feature-1.md')
    const target2 = path.join(FEATURES_DIR, 'done', 'my-feature-2.md')
    const fs = makeFs(new Set([target0, target1, target2]))
    const result = await moveFeatureFile(currentPath, FEATURES_DIR, 'done', fs)
    expect(result).toBe(path.join(FEATURES_DIR, 'done', 'my-feature-3.md'))
  })

  it('passes the correct source and target URIs to rename', async () => {
    const fs = makeFs()
    await moveFeatureFile(currentPath, FEATURES_DIR, 'done', fs)
    const [from, to] = (fs.rename as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(from.fsPath).toBe(currentPath)
    expect(to.fsPath).toBe(path.join(FEATURES_DIR, 'done', 'my-feature.md'))
  })
})
