import { useEffect, useState } from 'react'
import { apiRequest } from '../../../api/api'
import { useAdminAuth } from './useAdminAuth'
import { useLanguage } from '../../../language/useLanguage'

interface AdminReport {
  summary: {
    orderCount: number
    sales: number
    averageOrder: number
    placedCount: number
  }
  popularItems: { name: string; quantity: number; sales: number }[]
  lowStock?: {
    itemId: string
    name?: string
    stock: number
    reservedStock: number
    availableQuantity: number
    isAvailable: boolean
  }[]
  recentSales: { date: string; orders: number; sales: number }[]
}

function formatXaf(value: number, language: string) {
  return `${new Intl.NumberFormat(language === 'fr' ? 'fr-CM' : 'en-CM').format(Number(value || 0))} FCFA`
}

function csvCell(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  const text = String(value ?? '')
  const safeText = /^[\s]*[=+\-@]/.test(text) ? `'${text}` : text
  return `"${safeText.replaceAll('"', '""')}"`
}

export function AdminReportsPage() {
  const { sessionToken } = useAdminAuth()
  const { t, language } = useLanguage()
  const [report, setReport] = useState<AdminReport | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    apiRequest<AdminReport>('/admin/reports', { token: sessionToken })
      .then((result) => { if (!cancelled) setReport(result) })
      .catch((loadError: unknown) => { if (!cancelled) setError(loadError instanceof Error ? loadError.message : 'Unable to load reports.') })
    return () => { cancelled = true }
  }, [sessionToken])

  if (error) return <p className="rounded-xl bg-red-50 p-4 text-sm text-red-700" role="alert">{error}</p>
  if (!report) return (
    <div className="space-y-4">
      <div className="h-28 animate-pulse rounded-[28px] bg-[#e8edf5]" />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-28 animate-pulse rounded-2xl bg-[#eef2f6]" />
        ))}
      </div>
      <div className="mt-8 grid gap-8 xl:grid-cols-2">
        <div className="h-64 animate-pulse rounded-[28px] bg-[#eef2f6]" />
        <div className="h-64 animate-pulse rounded-[28px] bg-[#eef2f6]" />
      </div>
    </div>
  )

  function exportReport() {
    const rows = [
      [t('Sales and inventory reports')],
      [t('Generated at'), new Intl.DateTimeFormat(language === 'fr' ? 'fr-CM' : 'en-CM', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date())],
      [],
      [t('Summary')],
      [t('Metric'), t('Value'), t('Unit')],
      [t('Total orders'), report.summary.orderCount, t('Orders')],
      [t('Paid sales'), report.summary.sales, 'FCFA'],
      [t('Average paid order'), report.summary.averageOrder, 'FCFA'],
      [t('Orders placed'), report.summary.placedCount, t('Orders')],
      [],
      [t('Best-selling products')],
      [t('Product'), t('Quantity sold'), t('Sales'), t('Currency')],
      ...report.popularItems.map((item) => [item.name, item.quantity, item.sales, 'FCFA']),
      ...(report.popularItems.length ? [] : [[t('No paid orders yet.')]]),
      [],
      ...(report.lowStock ? [
      [t('Low stock')],
      [t('Item'), t('Stock'), t('Reserved'), t('Available'), t('Status')],
      ...report.lowStock.map((item) => [
        item.name || item.itemId,
        item.stock,
        item.reservedStock,
        item.availableQuantity,
        item.isAvailable ? t('Available') : t('Unavailable'),
      ]),
      ...(report.lowStock.length ? [] : [[t('No items are low in stock.')]]),
      ] : []),
      [],
      [t('Daily sales — last 30 days')],
      [t('Date'), t('Orders'), t('Sales'), t('Currency')],
      ...report.recentSales.map((row) => [row.date, row.orders, row.sales, 'FCFA']),
    ]
    const csv = `\uFEFF${rows.map((row) => row.map(csvCell).join(',')).join('\r\n')}`
    const fileUrl = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const link = document.createElement('a')
    const now = new Date()
    const date = [now.getFullYear(), String(now.getMonth() + 1).padStart(2, '0'), String(now.getDate()).padStart(2, '0')].join('-')
    link.href = fileUrl
    link.download = `sales-report-${date}.csv`
    document.body.append(link)
    link.click()
    link.remove()
    window.setTimeout(() => URL.revokeObjectURL(fileUrl), 1000)
  }

  const summaryCards = [
    { label: t('Total orders'), value: report.summary.orderCount.toLocaleString(), accent: 'bg-[#eff7ff] text-[#0b5ec8]' },
    { label: t('Paid sales'), value: formatXaf(report.summary.sales, language), accent: 'bg-[#edf9f0] text-[#1b7f4b]' },
    { label: t('Average paid order'), value: formatXaf(report.summary.averageOrder, language), accent: 'bg-[#fff4da] text-[#9a6b00]' },
    { label: t('Orders placed'), value: report.summary.placedCount.toLocaleString(), accent: 'bg-[#f3eefb] text-[#5f3dc4]' },
  ]

  return (
    <div className="space-y-6" data-scroll-reveal="skip">
      <header className="relative isolate overflow-hidden rounded-[28px] bg-gradient-to-br from-[#0f2341] via-[#153b68] to-[#1b557d] p-5 text-white shadow-[0_18px_40px_rgba(15,35,65,0.18)] sm:p-7">
        <div aria-hidden="true" className="absolute -right-12 -top-16 size-48 rounded-full border-[30px] border-white/10" />
        <div aria-hidden="true" className="absolute bottom-0 left-0 h-32 w-32 rounded-full bg-[#ffdc32]/10 blur-3xl" />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-xl">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.15em] text-[#ffdc32]">
              <span aria-hidden="true">✦</span>
              {t('Store analytics')}
            </span>
            <h1 className="mt-4 font-display text-3xl font-extrabold tracking-tight sm:text-4xl">{t('Sales and inventory reports')}</h1>
            <p className="mt-2 max-w-lg text-sm leading-6 text-slate-200">
              {t('Track performance, demand, and stock health across your store in one place.')}
            </p>
          </div>
          <button className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-bold text-[#102a4c] shadow-sm transition hover:bg-[#f4f8ff] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ffdc32]" onClick={exportReport} type="button">
            <svg aria-hidden="true" className="size-4" fill="none" viewBox="0 0 20 20">
              <path d="M10 2.5v9m0 0 3.5-3.5M10 11.5 6.5 8M3.5 12.5v3h13v-3" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" />
            </svg>
            {t('Export')}
          </button>
        </div>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {summaryCards.map((card) => (
          <article className="rounded-[24px] border border-[#e5ebf4] bg-white p-5 shadow-[0_14px_28px_rgba(15,35,65,0.04)]" key={card.label}>
            <div className={`inline-flex rounded-full px-3 py-1.5 text-[11px] font-bold ${card.accent}`}>{card.label}</div>
            <p className="mt-4 font-display text-2xl font-black text-[#112c50]">{card.value}</p>
          </article>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="rounded-[28px] border border-[#e5ebf4] bg-white p-5 shadow-[0_14px_30px_rgba(10,30,60,0.04)] sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-display text-2xl font-bold text-[#102c4f]">{t('Best-selling products')}</h2>
            <span className="rounded-full bg-[#edf9f0] px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.12em] text-[#1b7f4b]">{t('Top')}</span>
          </div>
          <div className="mt-4 space-y-3">
            {report.popularItems.map((item, index) => (
              <div className="flex items-center justify-between gap-3 rounded-2xl border border-[#edf1f6] bg-[#f9fbff] p-3" key={item.name}>
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex size-9 items-center justify-center rounded-full bg-[#dfeaf9] text-sm font-extrabold text-[#103d70]">{index + 1}</div>
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-[#1a2e42]">{item.name}</p>
                    <p className="text-xs text-[#65748a]">{item.quantity} {t('sold')}</p>
                  </div>
                </div>
                <p className="whitespace-nowrap text-sm font-bold text-[#123253]">{formatXaf(item.sales, language)}</p>
              </div>
            ))}
            {!report.popularItems.length && <p className="rounded-2xl bg-[#f7f8fa] p-4 text-sm text-[#65748a]">{t('No paid orders yet.')}</p>}
          </div>
        </section>

        {report.lowStock && <section className="rounded-[28px] border border-[#e5ebf4] bg-white p-5 shadow-[0_14px_30px_rgba(10,30,60,0.04)] sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-display text-2xl font-bold text-[#102c4f]">{t('Low stock')}</h2>
            <span className="rounded-full bg-[#fff1f1] px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.12em] text-[#bf3b3b]">{t('Alert')}</span>
          </div>
          <div className="mt-4 space-y-3">
            {report.lowStock.map((item) => {
              const availableUnits = Math.max(0, item.availableQuantity)
              const level = Math.min(100, Math.max(0, (availableUnits / Math.max(1, item.stock || item.availableQuantity || 1)) * 100))
              return (
                <div className="rounded-2xl border border-[#edf1f6] bg-[#fffdfc] p-3" key={item.itemId}>
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate font-semibold text-[#1a2e42]">{item.name || item.itemId}</p>
                    <span className="shrink-0 text-xs font-bold text-[#bf3b3b]">{availableUnits} {t('available')}</span>
                  </div>
                  <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-[#f1f4f7]">
                    <div className="h-full rounded-full bg-gradient-to-r from-[#f5b15e] to-[#d45353]" style={{ width: `${level}%` }} />
                  </div>
                  <div className="mt-2 flex justify-between text-[11px] text-[#65748a]">
                    <span>{t('Stock')} {item.stock}</span>
                    <span>{t('Reserved')} {item.reservedStock}</span>
                  </div>
                </div>
              )
            })}
            {!report.lowStock.length && <p className="rounded-2xl bg-[#f7f8fa] p-4 text-sm text-[#65748a]">{t('No items are low in stock.')}</p>}
          </div>
        </section>}
      </div>

      <section className="rounded-[28px] border border-[#e5ebf4] bg-white p-5 shadow-[0_14px_30px_rgba(10,30,60,0.04)] sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display text-2xl font-bold text-[#102c4f]">{t('Daily sales — last 30 days')}</h2>
          <span className="rounded-full bg-[#edf5ff] px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.12em] text-[#2158a1]">{t('30D')}</span>
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[420px] text-left text-sm">
            <thead className="bg-[#f5f8fb] text-[11px] uppercase tracking-[0.12em] text-[#65748a]">
              <tr>
                <th className="p-3 font-bold">{t('Date')}</th>
                <th className="p-3 font-bold">{t('Orders')}</th>
                <th className="p-3 font-bold">{t('Sales')}</th>
              </tr>
            </thead>
            <tbody>
              {report.recentSales.map((row) => (
                <tr className="border-t border-[#edf1f6]" key={row.date}>
                  <td className="p-3 text-[#1a2e42]">{row.date}</td>
                  <td className="p-3 text-[#1a2e42]">{row.orders}</td>
                  <td className="p-3 font-bold text-[#123253]">{formatXaf(row.sales, language)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
