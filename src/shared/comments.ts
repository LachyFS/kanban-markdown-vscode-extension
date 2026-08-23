// Task comments stored as a markdown table under a `## Comments` heading
// at the end of a feature file.

export interface TaskComment {
  dateTime: string
  content: string
  author: string
}

export const COMMENTS_HEADING = '## Comments'

const HEADER_ROW = '| Date Time | Content | Author |'
const SEPARATOR_ROW = '|-----------|---------|--------|'

const HEADING_RE = /^##[ \t]+Comments[ \t]*\r?$/m

function sanitizeCell(value: string): string {
  return value.replace(/\|/g, '\\|').replace(/\r?\n/g, ' ').trim()
}

function unsanitizeCell(value: string): string {
  return value.replace(/\\\|/g, '|').trim()
}

export function buildCommentsSection(comments: TaskComment[]): string {
  const rows = comments.map(
    (c) => `| ${sanitizeCell(c.dateTime)} | ${sanitizeCell(c.content)} | ${sanitizeCell(c.author)} |`
  )
  return [COMMENTS_HEADING, '', HEADER_ROW, SEPARATOR_ROW, ...rows].join('\n')
}

export function hasCommentsSection(content: string): boolean {
  return HEADING_RE.test(content)
}

export function ensureCommentsSection(content: string): string {
  if (hasCommentsSection(content)) return content
  const body = content.trimEnd()
  return `${body}\n\n${buildCommentsSection([])}\n`
}

function isSeparatorRow(cells: string[]): boolean {
  return cells.length > 0 && cells.every((c) => /^:?-{3,}:?$/.test(c.trim()))
}

function splitRow(line: string): string[] {
  let t = line.trim()
  if (t.startsWith('|')) t = t.slice(1)
  if (t.endsWith('|')) t = t.slice(0, -1)
  // Split on unescaped pipes
  return t.split(/(?<!\\)\|/).map((c) => unsanitizeCell(c))
}

export interface SplitCommentsResult {
  body: string
  comments: TaskComment[]
  hasSection: boolean
}

// Splits feature content into the editable body and the parsed comments.
// Any non-table content after the heading is preserved by appending it to the body.
export function splitComments(content: string): SplitCommentsResult {
  const match = content.match(HEADING_RE)
  if (!match || match.index === undefined) {
    return { body: content, comments: [], hasSection: false }
  }

  const before = content.slice(0, match.index)
  const after = content.slice(match.index + match[0].length)

  const comments: TaskComment[] = []
  const rest: string[] = []
  let inTable = false
  let tableDone = false

  for (const line of after.split('\n')) {
    const trimmed = line.trim()
    if (!tableDone && trimmed.startsWith('|')) {
      const cells = splitRow(line)
      if (isSeparatorRow(cells)) {
        inTable = true
        continue
      }
      if (!inTable && cells[0] === 'Date Time') continue // header row
      if (inTable && cells.length >= 3) {
        comments.push({ dateTime: cells[0], content: cells[1], author: cells.slice(2).join(' | ') })
        continue
      }
    }
    if (!tableDone && trimmed === '') continue // blank lines around the table
    if (inTable) tableDone = true
    rest.push(line)
  }

  const trailing = rest.join('\n').trim()
  let body = before.trimEnd()
  if (trailing) body = body ? `${body}\n\n${trailing}` : trailing

  return { body, comments, hasSection: true }
}

// Recombines an edited body with comments into full feature content.
export function withComments(body: string, comments: TaskComment[]): string {
  const trimmed = body.trimEnd()
  return `${trimmed}\n\n${buildCommentsSection(comments)}\n`
}
