const API_BASE = 'https://sheets.googleapis.com/v4/spreadsheets'
const DEFAULT_GID = 1883378372

const normalizeKey = (value = '') =>
  value.toLowerCase().replace(/[^a-z0-9]/g, '')

const getValue = (record, aliases) => {
  const key = aliases.find((alias) => record[normalizeKey(alias)] !== undefined)
  return key ? record[normalizeKey(key)] : ''
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

const normalizeRows = (values) => {
  if (!values?.length) return []
  const headers = values[0].map(normalizeKey)

  return values.slice(1).map((row, index) => {
    const record = Object.fromEntries(headers.map((header, column) => [header, row[column] ?? '']))
    const testCaseId = getValue(record, ['Test Case ID', 'TestCaseID'])
    const testingCase = getValue(record, ['Testing Case', 'Test Case'])
    const issue = getValue(record, ['Issue', 'QA Issue'])
    const qaStatus = getValue(record, ['QA Status', 'Status QA'])
    const devStatus = getValue(record, ['Dev Status', 'Status Dev'])
    const retestStatus = getValue(record, ['Retest Status', 'Status Retest'])
    const testDate = getValue(record, ['Test Date', 'Latest'])

    return {
      id: `${testCaseId || 'row'}-${index + 2}`,
      rowNumber: index + 2,
      scenarioId: getValue(record, ['Test Skenario', 'Test Scenario', 'Column 1']),
      testCaseId,
      testingCase,
      testType: getValue(record, ['Testing Case Type', 'Case', 'Type']),
      testStep: getValue(record, ['Test Step']),
      testData: getValue(record, ['Test Data']),
      expectedResult: getValue(record, ['Expected Result']),
      actualResult: getValue(record, ['Actual Result']),
      picQa: getValue(record, ['PIC QA', 'QA PIC']),
      qaStatus,
      issue,
      picDev: getValue(record, ['PIC DEV', 'DEV PIC']),
      devStatus,
      retestStatus,
      evidence: getValue(record, ['Evidence']),
      testDate,
      parsedDate: parseDate(testDate),
      hasIssue: Boolean(issue.trim()),
    }
  }).filter((row) => row.testCaseId || row.testingCase || row.issue)
}

export async function fetchIssueData() {
  const apiKey = import.meta.env.VITE_GOOGLE_SHEETS_API_KEY
  const spreadsheetId = import.meta.env.VITE_GOOGLE_SHEET_ID
  const targetGid = Number(import.meta.env.VITE_GOOGLE_SHEET_GID || DEFAULT_GID)

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
  const sheet = metadata.sheets?.find(({ properties }) => properties.sheetId === targetGid)

  if (!sheet) throw new Error(`Sheet dengan gid ${targetGid} tidak ditemukan.`)

  const range = encodeURIComponent(`'${sheet.properties.title.replaceAll("'", "''")}'`)
  const valuesResponse = await fetch(
    `${API_BASE}/${spreadsheetId}/values/${range}?majorDimension=ROWS&key=${apiKey}`,
  )

  if (!valuesResponse.ok) throw new Error('Gagal membaca data dari Google Sheets.')

  const data = await valuesResponse.json()
  return {
    rows: normalizeRows(data.values),
    sheetTitle: sheet.properties.title,
  }
}
