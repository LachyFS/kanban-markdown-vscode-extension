import * as vscode from 'vscode'
import * as path from 'path'
import * as fs from 'fs'

let bundle: Record<string, string> = {}
let extensionPath = ''

export function getEffectiveLocale(): string {
  const config = vscode.workspace.getConfiguration('kanban-markdown')
  const language = config.get<string>('language', 'auto')
  if (language !== 'auto') return language
  return vscode.env.language.split('-')[0]
}

export function loadBundle(extPath: string): Record<string, string> {
  extensionPath = extPath
  return reloadBundle()
}

export function reloadBundle(): Record<string, string> {
  const locale = getEffectiveLocale()
  const bundlePath = path.join(extensionPath, 'l10n', `bundle.l10n.${locale}.json`)
  const fallbackPath = path.join(extensionPath, 'l10n', 'bundle.l10n.en.json')

  try {
    bundle = JSON.parse(fs.readFileSync(bundlePath, 'utf-8'))
  } catch {
    try {
      bundle = JSON.parse(fs.readFileSync(fallbackPath, 'utf-8'))
    } catch {
      bundle = {}
    }
  }

  return bundle
}

export function t(key: string, args?: Record<string, string | number>): string {
  let result = bundle[key] ?? key
  if (args) {
    for (const [k, v] of Object.entries(args)) {
      result = result.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v))
    }
  }
  return result
}

export function getBundle(): Record<string, string> {
  return { ...bundle }
}

export function getBundleForLocale(locale: string): Record<string, string> {
  const bundlePath = path.join(extensionPath, 'l10n', `bundle.l10n.${locale}.json`)
  try {
    return JSON.parse(fs.readFileSync(bundlePath, 'utf-8'))
  } catch {
    return {}
  }
}

const STATUS_NAME_KEYS = ['status.backlog', 'status.todo', 'status.inProgress', 'status.review', 'status.done'] as const

/**
 * Returns a set of all known default column names across all locale bundles.
 * Used to detect whether the user's columns are "default" (just translated) vs custom.
 */
export function getAllDefaultColumnNames(): Set<string> {
  const names = new Set<string>()
  const l10nDir = path.join(extensionPath, 'l10n')
  try {
    const files = fs.readdirSync(l10nDir).filter(f => f.startsWith('bundle.l10n.') && f.endsWith('.json'))
    for (const file of files) {
      try {
        const b: Record<string, string> = JSON.parse(fs.readFileSync(path.join(l10nDir, file), 'utf-8'))
        for (const key of STATUS_NAME_KEYS) {
          if (b[key]) names.add(b[key])
        }
      } catch { /* skip bad files */ }
    }
  } catch { /* skip if dir missing */ }
  return names
}

/**
 * Returns the default column names for a specific locale.
 * Maps column id -> localized name.
 */
export function getDefaultColumnNamesForLocale(locale: string): Record<string, string> {
  const b = getBundleForLocale(locale)
  return {
    'backlog': b['status.backlog'] || 'Backlog',
    'todo': b['status.todo'] || 'To Do',
    'in-progress': b['status.inProgress'] || 'In Progress',
    'review': b['status.review'] || 'Review',
    'done': b['status.done'] || 'Done'
  }
}
