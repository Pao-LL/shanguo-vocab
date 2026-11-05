import type { ReactNode } from "react"

export function highlightPhrase(text: string, word: string): ReactNode[] {
  if (!text || !word) return [text]
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  const re = new RegExp(`(${escaped}(?:ing|ed|ies|es|s)?)`, "gi")
  const nodes: ReactNode[] = []
  let last = 0
  let match: RegExpExecArray | null
  let i = 0
  while ((match = re.exec(text)) !== null) {
    if (match.index > last) nodes.push(text.slice(last, match.index))
    nodes.push(
      <mark key={`${match.index}-${i++}`} className="word-hit bg-transparent">
        {match[0]}
      </mark>
    )
    last = match.index + match[0].length
  }
  if (last < text.length) nodes.push(text.slice(last))
  return nodes.length ? nodes : [text]
}