import * as path from 'path'
import * as vscode from 'vscode'

export function getFeatureFilePath(featuresDir: string, status: string, filename: string): string {
  if (status === 'done') {
    return path.join(featuresDir, 'done', `${filename}.md`)
  }
  return path.join(featuresDir, `${filename}.md`)
}

export async function ensureStatusSubfolders(featuresDir: string): Promise<void> {
  await vscode.workspace.fs.createDirectory(vscode.Uri.file(path.join(featuresDir, 'done')))
}

export async function moveFeatureFile(
  currentPath: string,
  featuresDir: string,
  newStatus: string
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
  while (await fileExists(targetPath)) {
    targetPath = path.join(targetDir, `${base}-${counter}${ext}`)
    counter++
  }

  await vscode.workspace.fs.createDirectory(vscode.Uri.file(targetDir))
  await vscode.workspace.fs.rename(vscode.Uri.file(currentPath), vscode.Uri.file(targetPath))

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

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await vscode.workspace.fs.stat(vscode.Uri.file(filePath))
    return true
  } catch {
    return false
  }
}
