/** Workspace settings are untrusted at runtime, even when their schema is numeric. */
export function normalizeZoomLevel(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.min(3, Math.max(0.5, value))
    : 1
}
