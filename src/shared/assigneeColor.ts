import { fnv1aHash32, hsl } from './colorUtils'

export interface AssigneeThemeColors {
  badgeBackground: string
  badgeForeground: string
  nameForeground: string
}

/**
 * Deterministic color theme for assignee badges + labels.
 * `isDark` should match the board/editor theme.
 */
export function assigneeThemeFromName(assigneeName: string, isDark: boolean): AssigneeThemeColors {
  const key = assigneeName.trim().toLowerCase()
  const h = fnv1aHash32(key)
  const hue = h % 360
  const sat = 42 + ((h >>> 8) % 18) // 42-59

  if (isDark) {
    const badgeL = 34 + ((h >>> 16) % 12) // 34-45
    const fgL = 88 + ((h >>> 20) % 8) // 88-95
    return {
      badgeBackground: hsl(hue, sat, badgeL),
      badgeForeground: hsl(hue, 92, fgL),
      nameForeground: hsl(hue, 74, Math.max(70, fgL - 8))
    }
  }

  const badgeL = 82 + ((h >>> 16) % 12) // 82-93
  const fgL = 20 + ((h >>> 20) % 12) // 20-31
  return {
    badgeBackground: hsl(hue, sat, badgeL),
    badgeForeground: hsl(hue, 72, fgL),
    nameForeground: hsl(hue, 58, Math.min(42, fgL + 10))
  }
}
