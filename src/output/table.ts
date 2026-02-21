export interface Column {
  header: string
  width?: number
  align?: 'left' | 'right' | 'center'
}

export function printTable(columns: Column[], rows: string[][]): void {
  if (rows.length === 0) {
    console.log('No results.')
    return
  }

  const widths = columns.map((col, i) => {
    const maxRowWidth = Math.max(...rows.map(row => (row[i] || '').length))
    return col.width || Math.max(col.header.length, maxRowWidth)
  })

  const header = columns.map((col, i) => col.header.padEnd(widths[i]!)).join(' | ')
  const divider = widths.map(w => '-'.repeat(w)).join('-+-')

  console.log(header)
  console.log(divider)
  rows.forEach(row => {
    const line = columns.map((col, i) => {
      const cell = row[i] || ''
      if (col.align === 'right') return cell.padStart(widths[i]!)
      return cell.padEnd(widths[i]!)
    }).join(' | ')
    console.log(line)
  })
}

export function printKeyValue(pairs: Array<[string, string]>, indent = 0): void {
  const maxKey = Math.max(...pairs.map(([k]) => k.length))
  const prefix = ' '.repeat(indent)
  pairs.forEach(([key, value]) => {
    console.log(`${prefix}${key.padEnd(maxKey)}: ${value}`)
  })
}

export function printSection(title: string): void {
  console.log(`\n${title}`)
  console.log('-'.repeat(title.length))
}
