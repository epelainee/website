import type { CSSProperties, ReactNode } from 'react'

type BlurbBlock =
  | { type: 'paragraph'; text: string }
  | { type: 'list'; items: string[] }

/** Lines that start with `- ` or `* ` (optional indent) become list items. */
const BULLET_RE = /^\s*[-*]\s+(.*)$/

export function parseBlurb(text: string): BlurbBlock[] {
  const lines = text.replace(/\r\n/g, '\n').split('\n')
  const blocks: BlurbBlock[] = []
  let paragraph: string[] = []
  let list: string[] = []

  const flushParagraph = () => {
    if (paragraph.length === 0) return
    const joined = paragraph.join('\n').trim()
    paragraph = []
    if (joined) blocks.push({ type: 'paragraph', text: joined })
  }

  const flushList = () => {
    if (list.length === 0) return
    blocks.push({ type: 'list', items: list })
    list = []
  }

  for (const line of lines) {
    const bullet = BULLET_RE.exec(line)
    if (bullet) {
      flushParagraph()
      list.push(bullet[1]!.trimEnd())
      continue
    }
    if (line.trim() === '') {
      flushParagraph()
      flushList()
      continue
    }
    flushList()
    paragraph.push(line)
  }

  flushParagraph()
  flushList()
  return blocks
}

type BlurbTextProps = {
  text: string
  className?: string
  style?: CSSProperties
  /** Extra styles for `<ul>` (print vs panel). */
  listStyle?: CSSProperties
}

/** Renders experience description with `- ` / `* ` lines as bullets. */
export function BlurbText({
  text,
  className,
  style,
  listStyle,
}: BlurbTextProps) {
  const trimmed = text.trim()
  if (!trimmed) return null

  const blocks = parseBlurb(trimmed)
  const nodes: ReactNode[] = []

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i]!
    const spacing: CSSProperties =
      i === 0 ? { margin: 0 } : { margin: 0, marginTop: '0.45em' }

    if (block.type === 'paragraph') {
      nodes.push(
        <p
          key={`p-${i}`}
          className={className}
          style={{
            ...spacing,
            whiteSpace: 'pre-line',
            ...style,
          }}
        >
          {block.text}
        </p>,
      )
    } else {
      nodes.push(
        <ul
          key={`ul-${i}`}
          className={className}
          style={{
            ...spacing,
            paddingLeft: '1.15em',
            listStyleType: 'disc',
            whiteSpace: 'normal',
            ...style,
            ...listStyle,
          }}
        >
          {block.items.map((item, j) => (
            <li key={j} style={{ marginTop: j === 0 ? 0 : '0.2em' }}>
              {item}
            </li>
          ))}
        </ul>,
      )
    }
  }

  return <>{nodes}</>
}
