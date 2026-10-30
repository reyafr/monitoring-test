const API_BASE = 'https://sheets.googleapis.com/v4/spreadsheets'

const normalizeKey = (value = '') => value.toLowerCase().replace(/[^a-z0-9]/g, '')

const EMPTY_VALUES = new Set(['', '-', '--', '–', '—', 'n/a', 'na', 'null', 'undefined', 'tbd'])

const normalizeCell = (value) => {
  const trimmed = value?.trim() ?? ''
  return EMPTY_VALUES.has(trimmed.toLowerCase()) ? '' : trimmed
}

const getValue = (record, aliases) => {
  for (const alias of aliases) {
    const key = normalizeKey(alias)
    if (record[key] !== undefined && record[key] !== '') return normalizeCell(record[key])
  }
  return ''
}

const parseDate = (value) => {
  if (!value) return null
  const parts = value.split(/[/-]/)
  if (parts.length !== 3) return null
  const [day, month, year] = parts.map(Number)
  const date = new Date(year, month - 1, day)
  const isValid = date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
  return isValid ? date : null
}

const hasTestCaseHeader = (headers) => headers.includes('testcaseid')

const normalizeRows = (values, sheetName) => {
  if (!values?.length) return []
  const headers = values[0].map(normalizeKey)
  if (!hasTestCaseHeader(headers)) return []

  return values.slice(1).map((row, index) => {
    const record = Object.fromEntries(headers.map((header, column) => [header, row[column] ?? '']))
    const testCaseId = getValue(record, ['Test Case ID'])
    const testingCase = getValue(record, ['Testing Case', 'Test Case'])
    const issue = getValue(record, ['Issue', 'QA Issue'])
    const qaStatus = getValue(record, ['Status QA', 'QA Status', 'Status'])
    const devStatus = getValue(record, ['Dev Status', 'Status Dev'])
    const retestStatus = getValue(record, ['Retest Status', 'Status Retest'])
    const testDate = getValue(record, ['Test Date', 'Test Date Latest'])

    return {
      id: `${sheetName}-${testCaseId || 'row'}-${index + 2}`,
      rowNumber: index + 2,
      sheetName,
      scenarioId: getValue(record, ['Scenario ID', 'Column 1']),
      brdReference: getValue(record, ['BRD Reference']),
      testCaseId,
      testingCase,
      testType: getValue(record, ['Testing Case']),
      testStep: getValue(record, ['Test Step']),
      testData: getValue(record, ['Test Data']),
      expectedResult: getValue(record, ['Expected Result']),
      actualResult: getValue(record, ['Actual Result']),
      picQa: getValue(record, ['PIC QA', 'QA PIC']),
      qaStatus,
      issue,
      picDev: getValue(record, ['PIC DEV', 'PIC Dev', 'DEV PIC']),
      devStatus,
      retestStatus,
      evidence: getValue(record, ['Evidence']),
      testDate,
      parsedDate: parseDate(testDate),
      hasIssue: Boolean(issue),
    }
  }).filter((row) => row.testCaseId || row.testingCase || row.issue)
}

export async function fetchIssueData() {
  const apiKey = import.meta.env.VITE_GOOGLE_SHEETS_API_KEY
  const spreadsheetId = import.meta.env.VITE_GOOGLE_SHEET_ID
  const onlyGid = import.meta.env.VITE_GOOGLE_SHEET_GID

  if (!apiKey || !spreadsheetId) {
    throw new Error('Konfigurasi Google Sheets belum lengkap di .env.local')
  }

  const metadataResponse = await fetch(
    `${API_BASE}/${spreadsheetId}?fields=sheets.properties&key=${apiKey}`,
  )

  if (!metadataResponse.ok) {
    throw new Error('Gagal mengakses spreadsheet. Periksa API key dan akses dokumen.')
  }

  const metadata = await metadataResponse.json()
  const sheets = (metadata.sheets ?? [])
    .map(({ properties }) => ({ sheetId: properties.sheetId, title: properties.title }))
    .filter(({ sheetId }) => !onlyGid || String(sheetId) === String(onlyGid))

  if (!sheets.length) throw new Error('Sheet yang diminta tidak ditemukan pada spreadsheet.')

  const params = new URLSearchParams({ majorDimension: 'ROWS', key: apiKey })
  sheets.forEach(({ title }) => params.append('ranges', `'${title.replaceAll("'", "''")}'`))

  const valuesResponse = await fetch(`${API_BASE}/${spreadsheetId}/values:batchGet?${params}`)

  if (!valuesResponse.ok) throw new Error('Gagal membaca data dari Google Sheets.')

  const { valueRanges = [] } = await valuesResponse.json()

  const sheetsData = sheets.map((sheet, index) => ({
    ...sheet,
    rows: normalizeRows(valueRanges[index]?.values, sheet.title),
  }))

  return {
    rows: sheetsData.flatMap((sheet) => sheet.rows),
    sheets: sheetsData
      .filter((sheet) => sheet.rows.length > 0)
      .map((sheet) => ({ sheetId: sheet.sheetId, title: sheet.title })),
  }
}
