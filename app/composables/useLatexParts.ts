export interface LatexPart {
  isLatex: boolean
  content: string
  block: boolean
}

export function parseLatexParts (text: string): LatexPart[] {
  const parts: LatexPart[] = []
  if (!text) return parts

  const re = /\$\$([^$]+)\$\$|\$([^$]+)\$/g
  let last = 0
  let match: RegExpExecArray | null

  while ((match = re.exec(text)) !== null) {
    if (match.index > last) {
      parts.push({ isLatex: false, content: text.slice(last, match.index), block: false })
    }

    if (match[1] !== undefined) {
      parts.push({ isLatex: true, content: match[1], block: true })
    } else {
      parts.push({ isLatex: true, content: match[2] || '', block: false })
    }

    last = match.index + match[0].length
  }

  if (last < text.length) {
    parts.push({ isLatex: false, content: text.slice(last), block: false })
  }

  return parts
}
