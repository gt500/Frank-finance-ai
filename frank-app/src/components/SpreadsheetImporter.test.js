import { describe, test, expect } from 'vitest'
import { aoaToRows } from './SpreadsheetImporter.jsx'

describe('aoaToRows — finds the real header row past report title rows', () => {
  test('skips a single-cell title row and uses the real header row', () => {
    const aoa = [
      ['MONTH: Jan 09', '', '', '', ''],
      ['Name', 'Amount', 'Due Date', 'Days Overdue'],
      ['Jane Smith', 1500, '2026-01-15', 10],
      ['John Doe', 2200, '2026-01-20', 5],
    ]
    const { headers, rows } = aoaToRows(aoa)
    expect(headers).toEqual(['Name', 'Amount', 'Due Date', 'Days Overdue'])
    expect(rows).toHaveLength(2)
    expect(rows[0]).toEqual({ Name: 'Jane Smith', Amount: 1500, 'Due Date': '2026-01-15', 'Days Overdue': 10 })
  })

  test('uses row 1 as headers when it already looks like a header row', () => {
    const aoa = [
      ['Name', 'Amount'],
      ['Jane Smith', 1500],
    ]
    const { headers, rows } = aoaToRows(aoa)
    expect(headers).toEqual(['Name', 'Amount'])
    expect(rows).toHaveLength(1)
  })

  test('drops fully-blank rows between header and data', () => {
    const aoa = [
      ['Name', 'Amount'],
      ['', ''],
      ['Jane Smith', 1500],
    ]
    const { rows } = aoaToRows(aoa)
    expect(rows).toHaveLength(1)
  })

  test('falls back to row 0 when nothing in the first 10 rows looks like a header', () => {
    const aoa = [['Only One Column']]
    const { headers } = aoaToRows(aoa)
    expect(headers).toEqual(['Only One Column'])
  })

  test('names genuinely blank header cells instead of leaving them empty', () => {
    const aoa = [
      ['Name', '', 'Amount'],
      ['Jane Smith', 'extra', 1500],
    ]
    const { headers } = aoaToRows(aoa)
    expect(headers).toEqual(['Name', 'Column 2', 'Amount'])
  })
})
