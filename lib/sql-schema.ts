export interface ParsedColumn {
  name: string
  type: string
  nullable: boolean
}

export interface ParsedTable {
  name: string
  columns: ParsedColumn[]
}

export function parseSchema(ddl: string[]): ParsedTable[] {
  return ddl.flatMap((statement) => {
    const match = statement.match(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?["`[]?([\w]+)["`\]]?\s*\(([\s\S]+)\)\s*;?$/i)
    if (!match) return []
    const [, name, body] = match
    const parts: string[] = []
    let current = ''
    let depth = 0
    for (const character of body) {
      if (character === '(') depth += 1
      if (character === ')') depth -= 1
      if (character === ',' && depth === 0) {
        parts.push(current.trim())
        current = ''
      } else {
        current += character
      }
    }
    if (current.trim()) parts.push(current.trim())

    const columns = parts.flatMap((part) => {
      if (/^(PRIMARY|FOREIGN|UNIQUE|CHECK|CONSTRAINT)\b/i.test(part)) return []
      const columnMatch = part.match(/^["`[]?([\w]+)["`\]]?\s+([A-Z]+(?:\s*\([^)]*\))?)/i)
      if (!columnMatch) return []
      return [{
        name: columnMatch[1],
        type: columnMatch[2].toUpperCase(),
        nullable: !/\bNOT\s+NULL\b/i.test(part),
      }]
    })
    return [{ name, columns }]
  })
}

export function completionSchema(ddl: string[]) {
  return Object.fromEntries(parseSchema(ddl).map((table) => [table.name, table.columns.map((column) => column.name)]))
}
