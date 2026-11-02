import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import Image from '@tiptap/extension-image'
import { TaskItem, TaskList } from '@tiptap/extension-list'
import { Markdown } from 'tiptap-markdown'

export function getMarkdown(editor: { storage: unknown }): string {
  return (editor.storage as { markdown: { getMarkdown(): string } }).markdown.getMarkdown()
}

function imageSource(src: string, resourceBaseUri?: string): string | undefined {
  // Local images go through VS Code's resource-root checks. Never load arbitrary schemes.
  if (/^https:\/\//i.test(src)) return src
  // eslint-disable-next-line no-control-regex -- Reject control characters in untrusted image paths.
  if (!resourceBaseUri || /^[a-z][a-z\d+.-]*:|^[\\/]|[\x00-\x1f]/i.test(src)) return undefined
  try {
    return new URL(src, resourceBaseUri).href
  } catch {
    return undefined
  }
}

export function markdownExtensions(
  placeholder: string,
  getResourceBaseUri: () => string | undefined = () => undefined,
  openLinks = true
) {
  const MarkdownImage = Image.extend({
    addNodeView() {
      return ({ node }) => {
        const img = document.createElement('img')
        const src = imageSource(node.attrs.src, getResourceBaseUri())
        if (src) img.src = src
        img.alt = node.attrs.alt || ''
        if (node.attrs.title) img.title = node.attrs.title
        // Only the view uses the webview URI; the document retains the Markdown path.
        return { dom: img }
      }
    }
  })

  return [
    StarterKit.configure({ link: { openOnClick: openLinks } }),
    Placeholder.configure({ placeholder }),
    MarkdownImage.configure({ inline: true }),
    TaskList,
    TaskItem.configure({ nested: true }),
    Markdown.configure({ html: false, transformPastedText: true })
  ]
}
