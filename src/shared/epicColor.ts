import { fnv1aHash32, hsl } from './colorUtils'

export interface EpicThemeColors {
  /** Soft pastel for borders / outlines */
  border: string
  /** Readable foreground for labels and icons */
  foreground: string
}

/**
 * Deterministic soft pastel border + matching text color from the epic name.
 * `isDark` should follow the board theme (e.g. VS Code dark vs light).
 */
export function epicThemeFromName(epicName: string, isDark: boolean): EpicThemeColors {
  const key = epicName.trim()
  const h = fnv1aHash32(key)
  const hue = h % 360
  const sat = 34 + ((h >>> 8) % 22) // 34–55

  if (isDark) {
    const borderL = 36 + ((h >>> 16) % 10) // 36–45
    const fgSat = Math.min(55, sat + 14)
    const fgL = 72 + ((h >>> 20) % 12) // 72–83
    return {
      border: hsl(hue, sat, borderL),
      foreground: hsl(hue, fgSat, fgL)
    }
  }

  const borderL = 80 + ((h >>> 16) % 12) // 80–91 — soft pastel edge
  const fgSat = Math.min(55, sat + 12)
  const fgL = 34 + ((h >>> 20) % 10) // 34–43 — readable on light cards
  return {
    border: hsl(hue, sat, borderL),
    foreground: hsl(hue, fgSat, fgL)
  }
}
