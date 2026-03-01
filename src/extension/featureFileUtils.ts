import * as path from 'path'
import * as vscode from 'vscode'

export interface FsAdapter {
  stat(uri: vscode.Uri): Thenable<vscode.FileStat>
  rename(source: vscode.Uri, target: vscode.Uri): Thenable<void>
  createDirectory(uri: vscode.Uri): Thenable<void>
}

export function getFeatureFilePath(featuresDir: string, status: string, filename: string): string {
  if (status === 'done') {
    return path.join(featuresDir, 'done', `${filename}.md`)
  }
  return path.join(featuresDir, `${filename}.md`)
}

export async function ensureStatusSubfolders(featuresDir: string, fs: FsAdapter = vscode.workspace.fs): Promise<void> {
  await fs.createDirectory(vscode.Uri.file(path.join(featuresDir, 'done')))
}

export async function moveFeatureFile(
  currentPath: string,
  featuresDir: string,
  newStatus: string,
  fs: FsAdapter = vscode.workspace.fs
): Promise<string> {
  const filename = path.basename(currentPath)
  const targetDir = newStatus === 'done'
    ? path.join(featuresDir, 'done')
    : featuresDir
  let targetPath = path.join(targetDir, filename)

  if (currentPath === targetPath) return currentPath

  const ext = path.extname(filename)
  const base = path.basename(filename, ext)
  let counter = 1
  while (await fileExists(targetPath, fs)) {
    targetPath = path.join(targetDir, `${base}-${counter}${ext}`)
    counter++
  }

  await fs.createDirectory(vscode.Uri.file(targetDir))
  await fs.rename(vscode.Uri.file(currentPath), vscode.Uri.file(targetPath))

  return targetPath
}

export function getStatusFromPath(filePath: string, featuresDir: string): string | null {
  const relative = path.relative(featuresDir, filePath)
  const parts = relative.split(path.sep)
  if (parts.length === 2 && parts[0] === 'done') {
    return 'done'
  }
  return null
}

export async function fileExists(filePath: string, fs: FsAdapter = vscode.workspace.fs): Promise<boolean> {
  try {
    await fs.stat(vscode.Uri.file(filePath))
    return true
  } catch {
    return false
  }
}
