import { useEffect, useMemo, useState } from 'react'
import { apiRequest } from '../../api/api'
import { useAdminAuth } from './useAdminAuth'
import { useLanguage } from '../../language/useLanguage'
import { niceAxis } from './chartScale'

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

const CHART_DAYS = 30

const icons = {
  receipt: 'M6 3h12v18l-3-2-3 2-3-2-3 2V3Zm3 5h6m-6 4h6m-6 4h3',
  check: 'm5 12.5 4.5 4.5L19 7.5',
  download: 'M12 4v12m0 0-5-5m5 5 5-5M5 20h14',
  print: 'M7 9V4h10v5M7 17H5a1 1 0 0 1-1-1v-6a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1h-2M7 14h10v6H7v-6Z',
  alert: 'M12 8v5m0 3.5v.01M10.3 3.9 2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z',
  chevron: 'm6 9 6 6 6-6',
}

function Icon({ path, className = 'size-4' }: { path: string; className?: string }) {
  return (
    <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 24 24">
      <path d={path} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6" />
    </svg>
  )
}

function formatXaf(value: number, language: string) {
  return `${new Intl.NumberFormat(language === 'fr' ? 'fr-CM' : 'en-CM').format(Number(value || 0))} FCFA`
}

function compactXaf(value: number, language: string) {
  return new Intl.NumberFormat(language === 'fr' ? 'fr-CM' : 'en-CM', { notation: 'compact', maximumFractionDigits: 1 }).format(Number(value || 0))
}

function csvCell(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  const text = String(value ?? '')
  const safeText = /^[\s]*[=+\-@]/.test(text) ? `'${text}` : text
  return `"${safeText.replaceAll('"', '""')}"`
}

function isoDay(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`
}

export function AdminReportsPage() {
  const { sessionToken } = useAdminAuth()
  const { t, language } = useLanguage()
  const locale = language === 'fr' ? 'fr-CM' : 'en-CM'
  const [report, setReport] = useState<AdminReport | null>(null)
  const [error, setError] = useState('')
  const [chartMetric, setChartMetric] = useState<'sales' | 'orders'>('sales')
  const [hoverIndex, setHoverIndex] = useState<number | null>(null)

  useEffect(() => {
    let cancelled = false
    apiRequest<AdminReport>('/admin/reports', { token: sessionToken })
      .then((result) => { if (!cancelled) setReport(result) })
      .catch((loadError: unknown) => { if (!cancelled) setError(loadError instanceof Error ? loadError.message : 'Unable to load reports.') })
    return () => { cancelled = true }
  }, [sessionToken])

  const series = useMemo(() => {
    const byDate = new Map((report?.recentSales || []).map((row) => [String(row.date).slice(0, 10), row]))
    const today = new Date()
    return Array.from({ length: CHART_DAYS }, (_, index) => {
      const date = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - (CHART_DAYS - 1 - index)))
      const key = isoDay(date)
      const row = byDate.get(key)
      return { key, date, sales: Number(row?.sales || 0), orders: Number(row?.orders || 0) }
    })
  }, [report])

  function exportReport() {
    if (!report) return
    const rows = [
      [t('Sales and inventory reports')],
      [t('Generated at'), new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date())],
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
    const csv = `﻿${rows.map((row) => row.map(csvCell).join(',')).join('\r\n')}`
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

  if (error) {
    return (
      <p className="flex items-start gap-2 rounded-lg bg-[#ffedea] px-4 py-3 text-sm font-medium text-[#831c1e]" role="alert">
        <Icon className="mt-0.5 size-4 shrink-0" path={icons.alert} />
        {error}
      </p>
    )
  }
  if (!report) {
    return (
      <div aria-label={t('Loading…')} className="space-y-4" role="status">
        <div className="h-24 animate-pulse rounded-lg bg-[#f3f4f6]" />
        <div className="grid grid-cols-2 overflow-hidden rounded-lg border border-[#e8e8e8] xl:grid-cols-4 xl:divide-x xl:divide-[#e8e8e8]">
          {Array.from({ length: 4 }).map((_, index) => <div className="h-28 animate-pulse bg-[#f3f4f6]" key={index} />)}
        </div>
        <div className="h-80 animate-pulse rounded-lg bg-[#f3f4f6]" />
      </div>
    )
  }

  const periodSales = series.reduce((sum, day) => sum + day.sales, 0)
  const periodOrders = series.reduce((sum, day) => sum + day.orders, 0)
  const lastWeek = series.slice(-7).reduce((sum, day) => sum + day.sales, 0)
  const previousWeek = series.slice(-14, -7).reduce((sum, day) => sum + day.sales, 0)
  const weekChange = previousWeek > 0 ? Math.round(((lastWeek - previousWeek) / previousWeek) * 100) : null
  const bestDay = series.reduce((best, day) => (day.sales > best.sales ? day : best), series[0])
  const completion = report.summary.orderCount ? Math.round((report.summary.placedCount / report.summary.orderCount) * 100) : 0

  // One bar per day on a round axis (a line drew a few sales days as sharp spikes).
  const values = series.map((day) => (chartMetric === 'sales' ? day.sales : day.orders))
  const axis = niceAxis(Math.max(0, ...values), { integer: chartMetric === 'orders' })
  const chartWidth = 720
  const chartHeight = 220
  const slotWidth = chartWidth / series.length
  const barWidth = Math.max(2, slotWidth - 4)
  const barHeight = (value: number) => (value / axis.max) * chartHeight
  // Bar with 4px rounded top corners resting on the baseline.
  const barPath = (index: number, value: number) => {
    const height = barHeight(value)
    const x = index * slotWidth + (slotWidth - barWidth) / 2
    const radius = Math.min(4, barWidth / 2, height)
    const top = chartHeight - height
    return `M${x},${chartHeight} V${top + radius} Q${x},${top} ${x + radius},${top} H${x + barWidth - radius} Q${x + barWidth},${top} ${x + barWidth},${top + radius} V${chartHeight} Z`
  }
  const hovered = hoverIndex !== null ? series[hoverIndex] : null
  const gridLines = [0.25, 0.5, 0.75, 1]

  const topSales = Math.max(1, ...report.popularItems.map((item) => item.sales))
  const popularTotal = report.popularItems.reduce((sum, item) => sum + item.sales, 0)

  const kpis = [
    { label: 'Paid sales', value: formatXaf(report.summary.sales, language), hint: weekChange === null ? t('All time') : t('{change}% vs. previous week', { change: weekChange > 0 ? `+${weekChange}` : weekChange }), trend: weekChange },
    { label: 'Total orders', value: report.summary.orderCount.toLocaleString(locale), hint: t('{count} in the last 30 days', { count: periodOrders }), trend: null },
    { label: 'Average paid order', value: formatXaf(report.summary.averageOrder, language), hint: t('Per paid order'), trend: null },
    { label: 'Orders placed', value: report.summary.placedCount.toLocaleString(locale), hint: t('{rate}% of orders paid', { rate: completion }), trend: null },
  ]

  return (
    <div className="min-w-0 space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <nav aria-label={t('Breadcrumb')} className="text-xs text-[#6b6b6b]">
            {t('Store analytics')} <span aria-hidden="true" className="mx-1">/</span>
            {t('Reports')}
          </nav>
          <h1 className="mt-1 text-2xl font-bold tracking-[-0.01em] text-[#111827]">{t('Sales and inventory reports')}</h1>
          <p className="mt-1 text-sm text-[#6b6b6b]">
            {t('Track performance, demand, and stock health across your store in one place.')}
          </p>
        </div>
        <div className="flex flex-none items-center gap-2 print:hidden">
          <button
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#d1d5db] bg-white px-3 text-sm font-medium text-[#111827] transition hover:border-[#9aa2ad]"
            onClick={() => window.print()}
            type="button"
          >
            <Icon path={icons.print} />
            {t('Print')}
          </button>
          <button
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#1d1f20] px-3 text-sm font-medium text-white transition hover:bg-[#3a3d3f] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[#1d1f20]"
            onClick={exportReport}
            type="button"
          >
            <Icon path={icons.download} />
            {t('Export CSV')}
          </button>
        </div>
      </header>

      <section aria-label={t('Summary')} className="admin-stats grid grid-cols-2 overflow-hidden rounded-lg border border-[#e8e8e8] bg-white xl:grid-cols-4 xl:divide-x xl:divide-[#e8e8e8]">
        {kpis.map((kpi, index) => (
          <article
            className={`px-4 py-4 sm:px-5 ${index % 2 === 0 ? 'border-r border-[#e8e8e8] xl:border-r-0' : ''} ${index < 2 ? 'border-b border-[#e8e8e8] xl:border-b-0' : ''}`}
            key={kpi.label}
          >
            <p className="text-xs text-[#6b6b6b]">{kpi.label}</p>
            <p className="num mt-1.5 truncate text-2xl font-semibold leading-none tracking-[-0.01em] text-[#111827]">{kpi.value}</p>
            <p className={`num mt-1.5 truncate text-xs ${kpi.trend === null ? 'text-[#6b6b6b]' : kpi.trend >= 0 ? 'text-[#247b50]' : 'text-[#c4242a]'}`}>
              {kpi.hint}
            </p>
          </article>
        ))}
      </section>

      <section aria-labelledby="trend-title" className="rounded-lg border border-[#e8e8e8] bg-white p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-[#111827]" id="trend-title">{t('Daily sales — last 30 days')}</h2>
            <p className="num mt-0.5 text-xs text-[#6b6b6b]">
              {t('{sales} from {orders} orders', { sales: formatXaf(periodSales, language), orders: periodOrders })}
              {bestDay?.sales > 0 && ` · ${t('Best day: {date}', { date: bestDay.date.toLocaleDateString(locale, { day: 'numeric', month: 'short', timeZone: 'UTC' }) })}`}
            </p>
          </div>
          <div aria-label={t('Chart metric')} className="flex flex-none rounded-lg border border-[#d1d5db] p-0.5 print:hidden" role="group">
            {([
              { key: 'sales', label: t('Sales') },
              { key: 'orders', label: t('Orders') },
            ] as const).map((option) => (
              <button
                aria-pressed={chartMetric === option.key}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${chartMetric === option.key ? 'bg-[#eef1f5] text-[#111827]' : 'text-[#6b6b6b] hover:text-[#111827]'}`}
                key={option.key}
                onClick={() => setChartMetric(option.key)}
                type="button"
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div className="relative mt-6">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex w-12 flex-col justify-between pb-6 text-right text-xs text-[#6b6b6b]">
            {[...gridLines].reverse().map((ratio) => (
              <span className="num" key={ratio}>{chartMetric === 'sales' ? compactXaf(axis.max * ratio, language) : Math.round(axis.max * ratio)}</span>
            ))}
            <span className="num">0</span>
          </div>
          <div className="relative ml-14">
            <svg
              aria-label={t('Daily sales — last 30 days')}
              className="h-56 w-full overflow-visible"
              onMouseLeave={() => setHoverIndex(null)}
              onMouseMove={(event) => {
                const rect = event.currentTarget.getBoundingClientRect()
                const ratio = (event.clientX - rect.left) / rect.width
                setHoverIndex(Math.max(0, Math.min(series.length - 1, Math.floor(ratio * series.length))))
              }}
              preserveAspectRatio="none"
              role="img"
              viewBox={`0 0 ${chartWidth} ${chartHeight}`}
            >
              {gridLines.map((ratio) => (
                <line key={ratio} stroke="#e8e8e8" strokeWidth="1" vectorEffect="non-scaling-stroke" x1="0" x2={chartWidth} y1={chartHeight - ratio * chartHeight} y2={chartHeight - ratio * chartHeight} />
              ))}
              {hoverIndex !== null && (
                <rect fill="#1d1f20" fillOpacity="0.05" height={chartHeight} width={slotWidth} x={hoverIndex * slotWidth} y="0" />
              )}
              {values.map((value, index) => value > 0 && (
                <path
                  d={barPath(index, value)}
                  fill="#1d1f20"
                  fillOpacity={hoverIndex === null || hoverIndex === index ? 1 : 0.5}
                  key={series[index].date.toISOString()}
                />
              ))}
              <line stroke="#d1d5db" strokeWidth="1" vectorEffect="non-scaling-stroke" x1="0" x2={chartWidth} y1={chartHeight} y2={chartHeight} />
            </svg>
            {hoverIndex !== null && hovered && (
              <div
                className="pointer-events-none absolute -top-2 z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-lg bg-[#1d1f20] px-3 py-2 text-xs text-white"
                style={{ left: `${Math.min(88, Math.max(12, ((hoverIndex + 0.5) / series.length) * 100))}%` }}
              >
                <p className="font-semibold">{hovered.date.toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' })}</p>
                <p className="num mt-0.5 text-white/70">{formatXaf(hovered.sales, language)} · {t('{count} orders', { count: hovered.orders })}</p>
              </div>
            )}
            <div className="num mt-2 flex justify-between text-xs text-[#6b6b6b]">
              {[0, 7, 14, 21, 29].map((index) => (
                <span key={index}>{series[index].date.toLocaleDateString(locale, { day: 'numeric', month: 'short', timeZone: 'UTC' })}</span>
              ))}
            </div>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)] xl:gap-4">
        <section aria-labelledby="best-sellers-title" className="rounded-lg border border-[#e8e8e8] bg-white p-4 sm:p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-base font-semibold text-[#111827]" id="best-sellers-title">{t('Best-selling products')}</h2>
            {popularTotal > 0 && <p className="num text-sm text-[#6b6b6b]">{formatXaf(popularTotal, language)}</p>}
          </div>
          {report.popularItems.length ? (
            <ol className="mt-4 space-y-3">
              {report.popularItems.map((item, index) => {
                const share = popularTotal ? Math.round((item.sales / popularTotal) * 100) : 0
                return (
                  <li className="grid grid-cols-[1.25rem_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1" key={item.name}>
                    <span className="num text-xs text-[#6b6b6b]">{index + 1}.</span>
                    <span className="truncate font-medium text-[#111827]">{item.name}</span>
                    <span className="num whitespace-nowrap text-sm font-semibold tabular-nums text-[#111827]">{formatXaf(item.sales, language)}</span>
                    <span aria-hidden="true" />
                    <span aria-hidden="true" className="h-1.5 min-w-2 rounded-full bg-[#eef1f5]">
                      <span className="num block h-full rounded-full bg-[#1d1f20]" style={{ width: `${(item.sales / topSales) * 100}%` }} />
                    </span>
                    <span className="num whitespace-nowrap text-xs text-[#6b6b6b]">{item.quantity} {t('sold')} · {share}%</span>
                  </li>
                )
              })}
            </ol>
          ) : (
            <p className="mt-4 rounded-lg border border-dashed border-[#e8e8e8] px-5 py-6 text-center text-sm text-[#6b6b6b]">{t('No paid orders yet.')}</p>
          )}
        </section>

        {report.lowStock && (
          <section aria-labelledby="low-stock-title" className="rounded-lg border border-[#e8e8e8] bg-white p-4 sm:p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-base font-semibold text-[#111827]" id="low-stock-title">{t('Low stock')}</h2>
              {report.lowStock.length > 0 && (
                <p className="num text-sm text-[#c4242a]">{report.lowStock.length}</p>
              )}
            </div>
            {report.lowStock.length ? (
              <ul className="mt-4 space-y-3">
                {report.lowStock.map((item) => {
                  const availableUnits = Math.max(0, item.availableQuantity)
                  const level = Math.min(100, Math.max(0, (availableUnits / Math.max(1, item.stock || item.availableQuantity || 1)) * 100))
                  const isOut = availableUnits === 0 || !item.isAvailable
                  return (
                    <li key={item.itemId}>
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-sm font-medium text-[#111827]">{item.name || item.itemId}</p>
                        <span className={`num inline-flex flex-none whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${isOut ? 'bg-[#ffedea] text-[#831c1e]' : 'bg-[#fffbeb] text-[#92400e]'}`}>
                          {isOut ? t('Sold out') : `${availableUnits} ${t('available')}`}
                        </span>
                      </div>
                      <div aria-hidden="true" className="mt-1.5 h-1 overflow-hidden rounded-full bg-[#f3f4f6]">
                        <div className={`h-full rounded-full ${isOut ? 'bg-[#c4242a]' : 'bg-[#e0b400]'}`} style={{ width: `${Math.max(isOut ? 0 : 4, level)}%` }} />
                      </div>
                      <p className="num mt-1 text-xs text-[#6b6b6b]">
                        {t('Stock')} {item.stock} · {t('Reserved')} {item.reservedStock}
                      </p>
                    </li>
                  )
                })}
              </ul>
            ) : (
              <p className="mt-4 rounded-lg border border-dashed border-[#e8e8e8] px-5 py-6 text-center text-sm text-[#6b6b6b]">
                {t('No items are low in stock.')}
              </p>
            )}
          </section>
        )}
      </div>

      <details className="group rounded-lg border border-[#e8e8e8] bg-white open:pb-2">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-4 sm:px-5 [&::-webkit-details-marker]:hidden">
          <span>
            <span className="block text-base font-semibold text-[#111827]">{t('Daily breakdown')}</span>
            <span className="num mt-0.5 block text-xs text-[#6b6b6b]">{t('{count} days with sales', { count: report.recentSales.length })}</span>
          </span>
          <Icon className="size-5 text-[#6b6b6b] transition group-open:rotate-180" path={icons.chevron} />
        </summary>
        <div className="relative overflow-x-auto border-t border-[#e8e8e8] px-2 sm:px-4">
          <table className="w-full min-w-[420px] text-left text-sm">
            <thead>
              <tr className="text-xs font-medium text-[#6b6b6b]">
                <th className="px-3 py-2.5 font-medium" scope="col">{t('Date')}</th>
                <th className="num px-3 py-2.5 text-right font-medium" scope="col">{t('Orders')}</th>
                <th className="num px-3 py-2.5 text-right font-medium" scope="col">{t('Sales')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f2f3f5]">
              {[...report.recentSales].reverse().map((row) => (
                <tr className="hover:bg-[#f6f7f9]" key={row.date}>
                  <td className="px-3 py-2.5 font-medium text-[#111827]">
                    {new Date(`${String(row.date).slice(0, 10)}T00:00:00Z`).toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })}
                  </td>
                  <td className="num px-3 py-2.5 text-right tabular-nums text-[#6b6b6b]">{row.orders}</td>
                  <td className="num px-3 py-2.5 text-right font-semibold tabular-nums text-[#111827]">{formatXaf(row.sales, language)}</td>
                </tr>
              ))}
              {!report.recentSales.length && (
                <tr><td className="px-3 py-6 text-center text-[#6b6b6b]" colSpan={3}>{t('No paid orders yet.')}</td></tr>
              )}
            </tbody>
            {report.recentSales.length > 0 && (
              <tfoot>
                <tr className="border-t border-[#e8e8e8]">
                  <th className="px-3 py-3 font-semibold text-[#111827]" scope="row">{t('Total')}</th>
                  <td className="num px-3 py-3 text-right font-semibold tabular-nums text-[#111827]">{periodOrders}</td>
                  <td className="num px-3 py-3 text-right font-semibold tabular-nums text-[#111827]">{formatXaf(periodSales, language)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </details>
    </div>
  )
}
