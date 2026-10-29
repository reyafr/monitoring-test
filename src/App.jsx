import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertCircle,
  ArrowDownUp,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleDot,
  Clock3,
  ExternalLink,
  FileWarning,
  Filter,
  LayoutDashboard,
  Menu,
  RefreshCw,
  Search,
  ShieldCheck,
  TestTube2,
  Users,
  X,
} from 'lucide-react'
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { fetchIssueData } from './services/googleSheets'

const PAGE_SIZE = 10
const chartColors = ['#f97316', '#22c55e', '#3b82f6', '#94a3b8']

const cleanStatus = (value, fallback = 'Belum ada') => {
  const normalized = value?.trim().toLowerCase()
  if (!normalized) return fallback
  return normalized.replace(/\b\w/g, (letter) => letter.toUpperCase())
}

const isStatus = (value, expected) => value?.trim().toLowerCase() === expected

const safeUrl = (value) => {
  try {
    const url = new URL(value)
    return ['http:', 'https:'].includes(url.protocol) ? url.href : ''
  } catch {
    return ''
  }
}

const statusClass = (status) => {
  const value = status.toLowerCase()
  if (value.includes('pass') || value.includes('fixed')) return 'bg-emerald-50 text-emerald-700 ring-emerald-600/20'
  if (value.includes('progress') || value.includes('open')) return 'bg-amber-50 text-amber-700 ring-amber-600/20'
  if (value.includes('fail') || value.includes('reject')) return 'bg-rose-50 text-rose-700 ring-rose-600/20'
  return 'bg-slate-100 text-slate-600 ring-slate-500/20'
}

function Badge({ children }) {
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${statusClass(children)}`}>{children}</span>
}

function StatCard({ icon: Icon, label, value, detail, tone }) {
  const tones = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-emerald-50 text-emerald-600',
    orange: 'bg-orange-50 text-orange-600',
    violet: 'bg-violet-50 text-violet-600',
  }
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-slate-500">{label}</p>
          <p className="mt-2 text-3xl font-bold tracking-tight text-slate-900">{value}</p>
          <p className="mt-1 text-xs text-slate-400">{detail}</p>
        </div>
        <span className={`rounded-xl p-2.5 ${tones[tone]}`}><Icon size={21} /></span>
      </div>
    </article>
  )
}

function DetailDrawer({ issue, onClose }) {
  if (!issue) return null
  const details = [
    ['Test case', issue.testingCase],
    ['Actual result', issue.actualResult],
    ['Expected result', issue.expectedResult],
    ['Test step', issue.testStep],
    ['Test data', issue.testData],
  ]
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/30 backdrop-blur-sm" onMouseDown={onClose}>
      <aside className="h-full w-full max-w-xl overflow-y-auto bg-white p-5 shadow-2xl sm:p-7" onMouseDown={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between gap-4">
          <div><p className="text-sm font-semibold text-blue-600">{issue.testCaseId || issue.scenarioId}</p><h2 className="mt-1 text-xl font-bold text-slate-900">Detail issue</h2></div>
          <button className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" onClick={onClose} aria-label="Tutup detail"><X size={20} /></button>
        </div>
        <div className="mt-6 rounded-xl border border-orange-200 bg-orange-50 p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-orange-600">Issue</p>
          <p className="mt-2 whitespace-pre-line text-sm leading-6 text-slate-700">{issue.issue || 'Tidak ada issue yang dicatat.'}</p>
        </div>
        <div className="mt-6 grid grid-cols-2 gap-4 rounded-xl bg-slate-50 p-4 text-sm">
          <div><p className="text-slate-400">PIC QA</p><p className="mt-1 font-semibold">{issue.picQa || '-'}</p></div>
          <div><p className="text-slate-400">PIC DEV</p><p className="mt-1 font-semibold">{issue.picDev || '-'}</p></div>
          <div><p className="text-slate-400">Dev status</p><div className="mt-1"><Badge>{cleanStatus(issue.devStatus)}</Badge></div></div>
          <div><p className="text-slate-400">Retest status</p><div className="mt-1"><Badge>{cleanStatus(issue.retestStatus)}</Badge></div></div>
        </div>
        <div className="mt-6 space-y-5">{details.map(([label, value]) => value && <div key={label}><h3 className="text-xs font-bold uppercase tracking-wide text-slate-400">{label}</h3><p className="mt-1.5 whitespace-pre-line text-sm leading-6 text-slate-700">{value}</p></div>)}</div>
        {safeUrl(issue.evidence) && <a className="mt-7 inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white" href={safeUrl(issue.evidence)} target="_blank" rel="noreferrer">Buka evidence <ExternalLink size={16} /></a>}
      </aside>
    </div>
  )
}

function App() {
  const [rows, setRows] = useState([])
  const [sheetTitle, setSheetTitle] = useState('Issue Monitoring')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [devStatus, setDevStatus] = useState('Semua status')
  const [picDev, setPicDev] = useState('Semua PIC')
  const [page, setPage] = useState(1)
  const [sortAscending, setSortAscending] = useState(true)
  const [selectedIssue, setSelectedIssue] = useState(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const data = await fetchIssueData()
      setRows(data.rows)
      setSheetTitle(data.sheetTitle)
      setPage(1)
    } catch (caughtError) {
      setError(caughtError.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadData() }, [loadData])

  const issues = useMemo(() => rows.filter((row) => row.hasIssue), [rows])
  const statuses = useMemo(() => [...new Set(issues.map((row) => cleanStatus(row.devStatus)))].sort(), [issues])
  const developers = useMemo(() => [...new Set(issues.map((row) => row.picDev).filter(Boolean))].sort(), [issues])
  const filteredRows = useMemo(() => {
    const keyword = query.toLowerCase()
    return issues.filter((row) => {
      const searchable = [row.testCaseId, row.testingCase, row.issue, row.picQa, row.picDev, row.devStatus].join(' ').toLowerCase()
      return searchable.includes(keyword) && (devStatus === 'Semua status' || cleanStatus(row.devStatus) === devStatus) && (picDev === 'Semua PIC' || row.picDev === picDev)
    }).sort((a, b) => (a.testCaseId || '').localeCompare(b.testCaseId || '', undefined, { numeric: true }) * (sortAscending ? 1 : -1))
  }, [issues, query, devStatus, picDev, sortAscending])

  const updateFilter = (setter) => (event) => {
    setter(event.target.value)
    setPage(1)
  }

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE))
  const paginatedRows = filteredRows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const passed = rows.filter((row) => isStatus(row.qaStatus, 'pass')).length
  const resolved = issues.filter((row) => isStatus(row.devStatus, 'fixed')).length
  const retested = issues.filter((row) => isStatus(row.retestStatus, 'passed')).length
  const chartData = useMemo(() => {
    const counts = issues.reduce((result, row) => {
      const status = cleanStatus(row.devStatus)
      result[status] = (result[status] || 0) + 1
      return result
    }, {})
    return Object.entries(counts).map(([name, value]) => ({ name, value }))
  }, [issues])

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <aside className={`fixed inset-y-0 left-0 z-40 w-64 border-r border-slate-200 bg-white p-5 transition-transform lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex items-center gap-3 px-2"><span className="grid size-10 place-items-center rounded-xl bg-blue-600 text-white"><ShieldCheck size={22} /></span><div><p className="font-bold">QA Monitor</p><p className="text-xs text-slate-400">Quality dashboard</p></div></div>
        <nav className="mt-10 space-y-1"><a className="flex items-center gap-3 rounded-xl bg-blue-50 px-3 py-3 text-sm font-semibold text-blue-700" href="#overview"><LayoutDashboard size={19} />Overview</a><a className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-slate-500 hover:bg-slate-50" href="#issues"><FileWarning size={19} />Daftar issue</a><a className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-slate-500 hover:bg-slate-50" href="#team"><Users size={19} />Tim & PIC</a></nav>
        <div className="absolute bottom-5 left-5 right-5 rounded-xl bg-slate-50 p-3"><p className="truncate text-xs font-semibold text-slate-600">{sheetTitle}</p><p className="mt-1 flex items-center gap-1 text-[11px] text-emerald-600"><CircleDot size={10} fill="currentColor" />Google Sheets terhubung</p></div>
      </aside>
      {sidebarOpen && <button className="fixed inset-0 z-30 bg-slate-950/30 lg:hidden" onClick={() => setSidebarOpen(false)} aria-label="Tutup menu" />}

      <main className="lg:pl-64">
        <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/90 px-4 py-3 backdrop-blur sm:px-6 lg:px-8">
          <div className="flex items-center justify-between"><div className="flex items-center gap-3"><button className="rounded-lg p-2 hover:bg-slate-100 lg:hidden" onClick={() => setSidebarOpen(true)} aria-label="Buka menu"><Menu size={21} /></button><div><h1 className="text-base font-bold sm:text-lg">Dashboard Monitoring Issue</h1><p className="hidden text-xs text-slate-400 sm:block">Pantau progres testing dan penyelesaian issue</p></div></div><button onClick={loadData} disabled={loading} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600 shadow-sm hover:bg-slate-50 disabled:opacity-50"><RefreshCw size={16} className={loading ? 'animate-spin' : ''} /><span className="hidden sm:inline">Refresh data</span></button></div>
        </header>

        <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6 lg:p-8" id="overview">
          {error && <div className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700"><AlertCircle className="shrink-0" size={19} /><div><p className="font-bold">Data tidak dapat dimuat</p><p className="mt-1">{error}</p></div></div>}
          <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            <StatCard icon={TestTube2} label="Total test case" value={loading ? '—' : rows.length} detail={`${passed} test case pass`} tone="blue" />
            <StatCard icon={FileWarning} label="Issue ditemukan" value={loading ? '—' : issues.length} detail={`${rows.length ? Math.round((issues.length / rows.length) * 100) : 0}% dari test case`} tone="orange" />
            <StatCard icon={CheckCircle2} label="Issue fixed" value={loading ? '—' : resolved} detail={`${issues.length ? Math.round((resolved / issues.length) * 100) : 0}% resolution rate`} tone="green" />
            <StatCard icon={Clock3} label="Lolos retest" value={loading ? '—' : retested} detail={`${Math.max(issues.length - retested, 0)} menunggu retest`} tone="violet" />
          </section>

          <section className="grid gap-4 lg:grid-cols-5">
            <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-3">
              <div><h2 className="font-bold">Progress penyelesaian</h2><p className="mt-1 text-xs text-slate-400">Perbandingan issue fixed dan pending</p></div>
              <div className="mt-7 space-y-6">
                {[['Issue fixed', resolved, issues.length, 'bg-emerald-500'], ['Lolos retest', retested, issues.length, 'bg-blue-500'], ['Test case pass', passed, rows.length, 'bg-violet-500']].map(([label, value, total, color]) => <div key={label}><div className="mb-2 flex justify-between text-sm"><span className="font-medium text-slate-600">{label}</span><span className="font-bold">{total ? Math.round((value / total) * 100) : 0}%</span></div><div className="h-2.5 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full ${color}`} style={{ width: `${total ? (value / total) * 100 : 0}%` }} /></div></div>)}
              </div>
            </article>
            <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-2">
              <h2 className="font-bold">Distribusi status DEV</h2><p className="mt-1 text-xs text-slate-400">Status issue saat ini</p>
              <div className="mt-2 flex h-48 items-center"><ResponsiveContainer width="55%" height="100%"><PieChart><Pie data={chartData} dataKey="value" nameKey="name" innerRadius={48} outerRadius={70} paddingAngle={3}>{chartData.map((entry, index) => <Cell key={entry.name} fill={chartColors[index % chartColors.length]} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer><div className="min-w-0 flex-1 space-y-2">{chartData.slice(0, 4).map((item, index) => <div className="flex items-center gap-2 text-xs" key={item.name}><span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: chartColors[index % chartColors.length] }} /><span className="truncate text-slate-500">{item.name}</span><b className="ml-auto">{item.value}</b></div>)}</div></div>
            </article>
          </section>

          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm" id="issues">
            <div className="border-b border-slate-100 p-4 sm:p-5"><div className="flex flex-col justify-between gap-4 md:flex-row md:items-center"><div><h2 className="font-bold">Daftar issue</h2><p className="mt-1 text-xs text-slate-400">{filteredRows.length} issue sesuai filter</p></div><div className="relative w-full md:max-w-xs"><Search className="absolute left-3 top-2.5 text-slate-400" size={17} /><input value={query} onChange={updateFilter(setQuery)} className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" placeholder="Cari ID, issue, atau PIC..." /></div></div>
              <div className="mt-4 flex flex-wrap gap-2"><span className="inline-flex items-center gap-1.5 py-2 text-xs font-semibold text-slate-400"><Filter size={14} />Filter</span><select value={devStatus} onChange={updateFilter(setDevStatus)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium outline-none"><option>Semua status</option>{statuses.map((status) => <option key={status}>{status}</option>)}</select><select value={picDev} onChange={updateFilter(setPicDev)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium outline-none"><option>Semua PIC</option>{developers.map((developer) => <option key={developer}>{developer}</option>)}</select><button onClick={() => setSortAscending((value) => !value)} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium"><ArrowDownUp size={14} />ID {sortAscending ? 'A–Z' : 'Z–A'}</button></div>
            </div>

            {loading ? <div className="grid h-64 place-items-center"><div className="text-center"><RefreshCw className="mx-auto animate-spin text-blue-600" /><p className="mt-3 text-sm text-slate-400">Mengambil data Google Sheets...</p></div></div> : paginatedRows.length === 0 ? <div className="grid h-64 place-items-center px-4 text-center"><div><FileWarning className="mx-auto text-slate-300" size={36} /><p className="mt-3 font-semibold text-slate-600">Issue tidak ditemukan</p><p className="mt-1 text-sm text-slate-400">Coba ubah pencarian atau filter.</p></div></div> : <>
              <div className="divide-y divide-slate-100 md:hidden">{paginatedRows.map((issue) => <button key={issue.id} onClick={() => setSelectedIssue(issue)} className="w-full p-4 text-left hover:bg-slate-50"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold text-blue-600">{issue.testCaseId || issue.scenarioId}</p><p className="mt-1 line-clamp-2 text-sm font-semibold text-slate-800">{issue.issue}</p></div><ChevronRight className="shrink-0 text-slate-300" size={18} /></div><div className="mt-3 flex items-center justify-between"><span className="text-xs text-slate-400">{issue.picDev || 'Belum ada PIC'}</span><Badge>{cleanStatus(issue.devStatus)}</Badge></div></button>)}</div>
              <div className="hidden overflow-x-auto md:block"><table className="w-full text-left"><thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-400"><tr><th className="px-5 py-3 font-bold">Test Case</th><th className="px-5 py-3 font-bold">Issue</th><th className="px-5 py-3 font-bold">PIC DEV</th><th className="px-5 py-3 font-bold">Dev Status</th><th className="px-5 py-3 font-bold">Retest</th><th className="px-5 py-3"></th></tr></thead><tbody className="divide-y divide-slate-100">{paginatedRows.map((issue) => <tr key={issue.id} className="hover:bg-slate-50"><td className="whitespace-nowrap px-5 py-4 text-sm font-bold text-blue-600">{issue.testCaseId || issue.scenarioId}</td><td className="max-w-md px-5 py-4"><p className="line-clamp-2 text-sm font-medium text-slate-700">{issue.issue}</p><p className="mt-1 truncate text-xs text-slate-400">{issue.testingCase}</p></td><td className="whitespace-nowrap px-5 py-4 text-sm text-slate-600">{issue.picDev || '-'}</td><td className="whitespace-nowrap px-5 py-4"><Badge>{cleanStatus(issue.devStatus)}</Badge></td><td className="whitespace-nowrap px-5 py-4"><Badge>{cleanStatus(issue.retestStatus)}</Badge></td><td className="px-5 py-4"><button onClick={() => setSelectedIssue(issue)} className="rounded-lg p-2 text-slate-400 hover:bg-blue-50 hover:text-blue-600" aria-label={`Lihat ${issue.testCaseId}`}><ChevronRight size={18} /></button></td></tr>)}</tbody></table></div>
            </>}
            <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-xs text-slate-500 sm:px-5"><span>Halaman {page} dari {totalPages}</span><div className="flex gap-1"><button disabled={page === 1} onClick={() => setPage((value) => value - 1)} className="rounded-lg border border-slate-200 p-2 disabled:opacity-30" aria-label="Halaman sebelumnya"><ChevronLeft size={16} /></button><button disabled={page === totalPages} onClick={() => setPage((value) => value + 1)} className="rounded-lg border border-slate-200 p-2 disabled:opacity-30" aria-label="Halaman berikutnya"><ChevronRight size={16} /></button></div></div>
          </section>
        </div>
      </main>
      <DetailDrawer issue={selectedIssue} onClose={() => setSelectedIssue(null)} />
    </div>
  )
}

export default App
