import * as path from 'path'

/** Resolve only relative Markdown links contained in a configured local root. */
export function resolveMarkdownLink(href: string, sourceFile: string, roots: string[]): string | undefined {
  let relative: string
  try {
    relative = decodeURIComponent(href.split(/[?#]/, 1)[0])
  } catch {
    return undefined
  }
  // eslint-disable-next-line no-control-regex -- Reject control characters in untrusted links.
  if (!relative || /^[a-z][a-z\d+.-]*:|^[\\/]|[\x00-\x1f]/i.test(relative)) return undefined
  const target = path.resolve(path.dirname(sourceFile), relative)
  if (path.extname(target).toLowerCase() !== '.md') return undefined
  return roots.some(root => {
    const within = path.relative(root, target)
    return within !== '..' && !within.startsWith(`..${path.sep}`) && !path.isAbsolute(within)
  }) ? target : undefined
}
