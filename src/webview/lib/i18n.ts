import * as l10n from '@vscode/l10n'

export function initLocale(bundle: Record<string, string>) {
  l10n.config({ contents: bundle })
}

export function t(key: string, args?: Record<string, string | number>): string {
  if (args) {
    return l10n.t(key, args as Record<string, l10n.L10nReplacement>)
  }
  return l10n.t(key)
}

export function tPlural(count: number, one: string, other: string, args?: Record<string, string | number>): string {
  return t(count === 1 ? one : other, { count, ...args })
}
