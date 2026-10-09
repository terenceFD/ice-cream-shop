import { useEffect, useState } from 'react'
import { apiRequest } from '../../../api/api'
import { useAdminAuth } from './AdminAuthContext'
import { useLanguage } from '../../../language/LanguageContext'

function formatXaf(value, language) {
  return `${new Intl.NumberFormat(language === 'fr' ? 'fr-CM' : 'en-CM').format(Number(value || 0))} FCFA`
}

function csvCell(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  const text = String(value ?? '')
  const safeText = /^[\s]*[=+\-@]/.test(text) ? `'${text}` : text
  return `"${safeText.replaceAll('"', '""')}"`
}

export function AdminReportsPage() {
  const { sessionToken } = useAdminAuth()
  const { t, language } = useLanguage()
  const [report, setReport] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    apiRequest('/admin/reports', { token: sessionToken })
      .then((result) => { if (!cancelled) setReport(result) })
      .catch((loadError) => { if (!cancelled) setError(loadError.message) })
    return () => { cancelled = true }
  }, [sessionToken])

  if (error) return <p className="rounded-xl bg-red-50 p-4 text-sm text-red-700" role="alert">{error}</p>
  if (!report) return <p className="text-sm text-[#65748a]">{t('Loading reports…')}</p>

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

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-3xl font-bold">{t('Sales and inventory reports')}</h1>
        <button className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[#092a53] px-5 py-2.5 text-sm font-bold text-white transition hover:bg-[#163e6b] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#bd9c00]" onClick={exportReport} type="button">
          <svg aria-hidden="true" className="size-4" fill="none" viewBox="0 0 20 20">
            <path d="M10 2.5v9m0 0 3.5-3.5M10 11.5 6.5 8M3.5 12.5v3h13v-3" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" />
          </svg>
          {t('Export')}
        </button>
      </div>
      <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          [t('Total orders'), report.summary.orderCount],
          [t('Paid sales'), formatXaf(report.summary.sales, language)],
          [t('Average paid order'), formatXaf(report.summary.averageOrder, language)],
          [t('Orders placed'), report.summary.placedCount],
        ].map(([label, value]) => (
          <article className="rounded-2xl border border-[#d9d6cc] bg-white p-5" key={label}>
            <p className="text-xs font-bold uppercase tracking-wide text-[#65748a]">{label}</p>
            <p className="mt-2 font-display text-2xl font-bold">{value}</p>
          </article>
        ))}
      </div>
      <div className="mt-8 grid gap-8 xl:grid-cols-2">
        <section>
          <h2 className="font-display text-2xl font-bold">{t('Best-selling products')}</h2>
          <div className="mt-3 space-y-2">
            {report.popularItems.map((item) => (
              <div className="flex justify-between gap-3 rounded-xl bg-white p-3 text-sm" key={item.name}>
                <span className="font-semibold">{item.name}</span>
                <span className="text-right text-[#65748a]">{item.quantity} · {formatXaf(item.sales, language)}</span>
              </div>
            ))}
            {!report.popularItems.length && <p className="text-sm text-[#65748a]">{t('No paid orders yet.')}</p>}
          </div>
        </section>
        <section>
          <h2 className="font-display text-2xl font-bold">{t('Low stock')}</h2>
          <div className="mt-3 space-y-2">
            {report.lowStock.map((item) => (
              <div className="flex justify-between gap-3 rounded-xl bg-white p-3 text-sm" key={item.itemId}>
                <span className="break-all font-semibold">{item.itemId}</span>
                <span className="shrink-0 text-red-700">{Math.max(0, item.stock - item.reservedStock)} {t('available')}</span>
              </div>
            ))}
            {!report.lowStock.length && <p className="text-sm text-[#65748a]">{t('No items are low in stock.')}</p>}
          </div>
        </section>
      </div>
      <section className="mt-8">
        <h2 className="font-display text-2xl font-bold">{t('Daily sales — last 30 days')}</h2>
        <div className="mt-3 overflow-x-auto rounded-2xl border border-[#d9d6cc] bg-white">
          <table className="w-full min-w-[420px] text-left text-sm">
            <thead className="bg-[#f4f2f2] text-xs uppercase text-[#65748a]"><tr><th className="p-3">{t('Date')}</th><th className="p-3">{t('Orders')}</th><th className="p-3">{t('Sales')}</th></tr></thead>
            <tbody>{report.recentSales.map((row) => <tr className="border-t border-[#d9d6cc]" key={row.date}><td className="p-3">{row.date}</td><td className="p-3">{row.orders}</td><td className="p-3 font-semibold">{formatXaf(row.sales, language)}</td></tr>)}</tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
