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
  chart: 'M4 19V5m0 14h16M8 15v-3m4 3V8m4 7v-5',
  receipt: 'M6 3h12v18l-3-2-3 2-3-2-3 2V3Zm3 5h6m-6 4h6m-6 4h3',
  money: 'M3 7h18v10H3V7Zm9 7.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM6 10v4m12-4v4',
  basket: 'M5 9h14l-1.5 10h-11L5 9Zm3 0 4-5 4 5',
  check: 'm5 12.5 4.5 4.5L19 7.5',
  download: 'M12 4v12m0 0-5-5m5 5 5-5M5 20h14',
  print: 'M7 9V4h10v5M7 17H5a1 1 0 0 1-1-1v-6a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1h-2M7 14h10v6H7v-6Z',
  trophy: 'M8 4h8v5a4 4 0 0 1-8 0V4Zm0 2H5a3 3 0 0 0 3 4m8-4h3a3 3 0 0 1-3 4m-4 3v4m-3 3h6',
  alert: 'M12 8v5m0 3.5v.01M10.3 3.9 2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z',
  chevron: 'm6 9 6 6 6-6',
  box: 'M4 8l8-4 8 4v8l-8 4-8-4V8Zm0 0 8 4m0 0 8-4m-8 4v8',
}

function Icon({ path, className = 'size-4' }: { path: string; className?: string }) {
  return (
    <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 24 24">
      <path d={path} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
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

  if (error) {
    return (
      <p className="flex items-start gap-2 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 ring-1 ring-red-100" role="alert">
        <Icon className="mt-0.5 size-4 shrink-0" path={icons.alert} />
        {error}
      </p>
    )
  }
  if (!report) {
    return (
      <div aria-label={t('Loading…')} className="space-y-6" role="status">
        <div className="h-20 animate-pulse rounded-2xl bg-[#f4f6f8]" />
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => <div className="h-32 animate-pulse rounded-2xl bg-[#f4f6f8]" key={index} />)}
        </div>
        <div className="h-80 animate-pulse rounded-[20px] bg-[#f4f6f8]" />
      </div>
    )
  }

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
    { label: t('Paid sales'), value: formatXaf(report.summary.sales, language), hint: weekChange === null ? t('All time') : t('{change}% vs. previous week', { change: weekChange > 0 ? `+${weekChange}` : weekChange }), trend: weekChange, icon: icons.money, accent: 'bg-[#e5f4ea] text-[#2c7a4f]' },
    { label: t('Total orders'), value: report.summary.orderCount.toLocaleString(locale), hint: t('{count} in the last 30 days', { count: periodOrders }), trend: null, icon: icons.receipt, accent: 'bg-[#e9f1fa] text-[#315982]' },
    { label: t('Average paid order'), value: formatXaf(report.summary.averageOrder, language), hint: t('Per paid order'), trend: null, icon: icons.basket, accent: 'bg-[#fff4c2] text-[#bd9c00]' },
    { label: t('Orders placed'), value: report.summary.placedCount.toLocaleString(locale), hint: t('{rate}% of orders paid', { rate: completion }), trend: null, icon: icons.check, accent: 'bg-[#efe9fb] text-[#5b3fa0]' },
  ]

  return (
    <div className="min-w-0 space-y-6">
      <header className="flex flex-col gap-5 border-b border-[#f4f6f8] pb-6 xl:flex-row xl:items-end xl:justify-between">
        <div className="flex min-w-0 items-center gap-4">
          <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-[#092a53] text-[#ffdc32]">
            <Icon className="size-7" path={icons.chart} />
          </span>
          <div className="min-w-0">
            <nav aria-label={t('Breadcrumb')} className="text-xs font-bold text-[#65748a]">
              {t('Store analytics')} <span aria-hidden="true" className="mx-1">/</span>
              <span className="text-[#bd9c00]">{t('Reports')}</span>
            </nav>
            <h1 className="mt-1 font-display text-2xl font-extrabold tracking-tight text-[#092a53] sm:text-[1.9rem]">{t('Sales and inventory reports')}</h1>
            <p className="mt-0.5 text-sm text-[#65748a]">{t('Track performance, demand, and stock health across your store in one place.')}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2.5 print:hidden">
          <button
            className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-[#dce5ef] bg-white px-4 text-sm font-bold text-[#123b68] transition hover:border-[#bacbdc] hover:bg-[#f4f6f8] hover:text-[#092a53]"
            onClick={() => window.print()}
            type="button"
          >
            <Icon path={icons.print} />
            {t('Print')}
          </button>
          <button
            className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-[#092a53] px-4 text-sm font-bold text-white shadow-[0_6px_16px_rgba(9,42,83,0.18)] transition hover:-translate-y-0.5 hover:bg-[#163e6b] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#bd9c00]"
            onClick={exportReport}
            type="button"
          >
            <Icon path={icons.download} />
            {t('Export CSV')}
          </button>
        </div>
      </header>

      <section aria-label={t('Summary')} className="admin-stats grid grid-cols-2 gap-3 xl:grid-cols-4">
        {kpis.map((kpi) => (
          <article className="rounded-2xl border border-[#dce3eb] bg-white p-4 sm:p-5" key={kpi.label}>
            <span className={`grid size-9 place-items-center rounded-xl ${kpi.accent}`}><Icon path={kpi.icon} /></span>
            <p className="mt-4 truncate font-display text-[1.6rem] font-extrabold leading-none tracking-tight text-[#092a53]">{kpi.value}</p>
            <p className="mt-1.5 text-xs font-semibold text-[#65748a]">{kpi.label}</p>
            <p className={`mt-0.5 truncate text-xs font-semibold ${kpi.trend === null ? 'text-[#a3b0bf]' : kpi.trend >= 0 ? 'text-[#2c7a4f]' : 'text-[#b2433a]'}`}>
              {kpi.trend !== null && <span aria-hidden="true">{kpi.trend >= 0 ? '▲ ' : '▼ '}</span>}
              {kpi.hint}
            </p>
          </article>
        ))}
      </section>

      <section aria-labelledby="trend-title" className="rounded-[20px] border border-[#dce3eb] bg-white p-4 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="font-display text-xl font-extrabold text-[#092a53]" id="trend-title">{t('Daily sales — last 30 days')}</h2>
            <p className="mt-1 text-xs text-[#65748a]">
              {t('{sales} from {orders} orders', { sales: formatXaf(periodSales, language), orders: periodOrders })}
              {bestDay?.sales > 0 && ` · ${t('Best day: {date}', { date: bestDay.date.toLocaleDateString(locale, { day: 'numeric', month: 'short', timeZone: 'UTC' }) })}`}
            </p>
          </div>
          <div aria-label={t('Chart metric')} className="flex rounded-xl bg-[#f4f6f8] p-1 print:hidden" role="group">
            {([
              { key: 'sales', label: t('Sales') },
              { key: 'orders', label: t('Orders') },
            ] as const).map((option) => (
              <button
                aria-pressed={chartMetric === option.key}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${chartMetric === option.key ? 'bg-white text-[#092a53] shadow-sm' : 'text-[#65748a] hover:text-[#092a53]'}`}
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
          <div className="pointer-events-none absolute inset-y-0 left-0 flex w-12 flex-col justify-between pb-6 text-right text-xs font-semibold text-[#a3b0bf]">
            {[...gridLines].reverse().map((ratio) => (
              <span key={ratio}>{chartMetric === 'sales' ? compactXaf(axis.max * ratio, language) : Math.round(axis.max * ratio)}</span>
            ))}
            <span>0</span>
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
                <line key={ratio} stroke="#f4f6f8" strokeWidth="1" vectorEffect="non-scaling-stroke" x1="0" x2={chartWidth} y1={chartHeight - ratio * chartHeight} y2={chartHeight - ratio * chartHeight} />
              ))}
              {hoverIndex !== null && (
                <rect fill="#092a53" fillOpacity="0.05" height={chartHeight} width={slotWidth} x={hoverIndex * slotWidth} y="0" />
              )}
              {values.map((value, index) => value > 0 && (
                <path
                  d={barPath(index, value)}
                  fill="#092a53"
                  fillOpacity={hoverIndex === null || hoverIndex === index ? 1 : 0.55}
                  key={series[index].date.toISOString()}
                />
              ))}
              <line stroke="#c9d3de" strokeWidth="1" vectorEffect="non-scaling-stroke" x1="0" x2={chartWidth} y1={chartHeight} y2={chartHeight} />
            </svg>
            {hoverIndex !== null && hovered && (
              <>
                <div
                  className="pointer-events-none absolute -top-2 z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-xl bg-[#092a53] px-3 py-2 text-xs text-white shadow-lg"
                  style={{ left: `${Math.min(88, Math.max(12, ((hoverIndex + 0.5) / series.length) * 100))}%` }}
                >
                  <p className="font-bold">{hovered.date.toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' })}</p>
                  <p className="mt-0.5 text-white/75">{formatXaf(hovered.sales, language)} · {t('{count} orders', { count: hovered.orders })}</p>
                </div>
              </>
            )}
            <div className="mt-2 flex justify-between text-xs font-semibold text-[#a3b0bf]">
              {[0, 7, 14, 21, 29].map((index) => (
                <span key={index}>{series[index].date.toLocaleDateString(locale, { day: 'numeric', month: 'short', timeZone: 'UTC' })}</span>
              ))}
            </div>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
        <section aria-labelledby="best-sellers-title" className="rounded-[20px] border border-[#dce3eb] bg-white p-4 sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="grid size-9 place-items-center rounded-xl bg-[#fff4c2] text-[#bd9c00]"><Icon path={icons.trophy} /></span>
              <h2 className="font-display text-xl font-extrabold text-[#092a53]" id="best-sellers-title">{t('Best-selling products')}</h2>
            </div>
            {popularTotal > 0 && <p className="text-xs font-bold text-[#65748a]">{formatXaf(popularTotal, language)}</p>}
          </div>
          {report.popularItems.length ? (
            <ol className="mt-5 space-y-3.5">
              {report.popularItems.map((item, index) => {
                const share = popularTotal ? Math.round((item.sales / popularTotal) * 100) : 0
                return (
                  <li key={item.name}>
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className="flex min-w-0 items-center gap-3">
                        <span className={`grid size-7 shrink-0 place-items-center rounded-lg text-xs font-extrabold ${index === 0 ? 'bg-[#ffdc32] text-[#092a53]' : index < 3 ? 'bg-[#092a53] text-white' : 'bg-[#f4f6f8] text-[#65748a]'}`}>{index + 1}</span>
                        <span className="truncate font-bold text-[#092a53]">{item.name}</span>
                        <span className="shrink-0 text-xs text-[#65748a]">{item.quantity} {t('sold')}</span>
                      </span>
                      <span className="shrink-0 font-bold tabular-nums text-[#092a53]">{formatXaf(item.sales, language)}</span>
                    </div>
                    <div className="ml-10 mt-1.5 flex items-center gap-2">
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-[#f4f6f8]">
                        <div className={`h-full rounded-full ${index === 0 ? 'bg-[#ffdc32]' : 'bg-[#092a53]'}`} style={{ width: `${(item.sales / topSales) * 100}%` }} />
                      </div>
                      <span className="w-9 text-right text-xs font-bold text-[#65748a]">{share}%</span>
                    </div>
                  </li>
                )
              })}
            </ol>
          ) : (
            <p className="mt-5 rounded-xl bg-[#f4f6f8] p-5 text-center text-sm text-[#65748a]">{t('No paid orders yet.')}</p>
          )}
        </section>

        {report.lowStock && (
          <section aria-labelledby="low-stock-title" className="rounded-[20px] border border-[#dce3eb] bg-white p-4 sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="grid size-9 place-items-center rounded-xl bg-[#fdecea] text-[#b2433a]"><Icon path={icons.alert} /></span>
                <h2 className="font-display text-xl font-extrabold text-[#092a53]" id="low-stock-title">{t('Low stock')}</h2>
              </div>
              {report.lowStock.length > 0 && (
                <span className="rounded-full bg-[#fdecea] px-2.5 py-1 text-xs font-extrabold text-[#a53f37]">{report.lowStock.length}</span>
              )}
            </div>
            {report.lowStock.length ? (
              <ul className="mt-5 space-y-3">
                {report.lowStock.map((item) => {
                  const availableUnits = Math.max(0, item.availableQuantity)
                  const level = Math.min(100, Math.max(0, (availableUnits / Math.max(1, item.stock || item.availableQuantity || 1)) * 100))
                  const isOut = availableUnits === 0 || !item.isAvailable
                  return (
                    <li className="rounded-xl bg-[#f4f6f8] p-3 ring-1 ring-[#f4f6f8]" key={item.itemId}>
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-sm font-bold text-[#092a53]">{item.name || item.itemId}</p>
                        <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-extrabold ${isOut ? 'bg-[#fdeeee] text-[#a53f37]' : 'bg-[#fff6e5] text-[#9a6200]'}`}>
                          {isOut ? t('Sold out') : `${availableUnits} ${t('available')}`}
                        </span>
                      </div>
                      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#f4f6f8]">
                        <div className={`h-full rounded-full ${isOut ? 'bg-[#d2544b]' : 'bg-[#bd9c00]'}`} style={{ width: `${Math.max(isOut ? 0 : 4, level)}%` }} />
                      </div>
                      <div className="mt-1.5 flex justify-between text-xs text-[#65748a]">
                        <span>{t('Stock')} {item.stock}</span>
                        <span>{t('Reserved')} {item.reservedStock}</span>
                      </div>
                    </li>
                  )
                })}
              </ul>
            ) : (
              <div className="mt-5 flex items-center gap-3 rounded-xl bg-[#eaf6ee] p-4 text-sm font-semibold text-[#246a46]">
                <Icon path={icons.check} />
                {t('No items are low in stock.')}
              </div>
            )}
          </section>
        )}
      </div>

      <details className="group rounded-[20px] border border-[#dce3eb] bg-white open:pb-2">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4 sm:px-6 [&::-webkit-details-marker]:hidden">
          <span className="flex items-center gap-3">
            <span className="grid size-9 place-items-center rounded-xl bg-[#e9f1fa] text-[#315982]"><Icon path={icons.box} /></span>
            <span>
              <span className="block font-display text-lg font-extrabold text-[#092a53]">{t('Daily breakdown')}</span>
              <span className="block text-xs text-[#65748a]">{t('{count} days with sales', { count: report.recentSales.length })}</span>
            </span>
          </span>
          <Icon className="size-5 text-[#65748a] transition group-open:rotate-180" path={icons.chevron} />
        </summary>
        <div className="relative overflow-x-auto px-2 sm:px-4">
          <table className="w-full min-w-[420px] text-left text-sm">
            <thead>
              <tr className="border-b border-[#f4f6f8] text-xs uppercase tracking-[0.08em] text-[#65748a]">
                <th className="px-3 py-2.5 font-extrabold" scope="col">{t('Date')}</th>
                <th className="px-3 py-2.5 text-right font-extrabold" scope="col">{t('Orders')}</th>
                <th className="px-3 py-2.5 text-right font-extrabold" scope="col">{t('Sales')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f4f6f8]">
              {[...report.recentSales].reverse().map((row) => (
                <tr className="hover:bg-[#f4f6f8]" key={row.date}>
                  <td className="px-3 py-2.5 font-semibold text-[#092a53]">
                    {new Date(`${String(row.date).slice(0, 10)}T00:00:00Z`).toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-[#65748a]">{row.orders}</td>
                  <td className="px-3 py-2.5 text-right font-bold tabular-nums text-[#092a53]">{formatXaf(row.sales, language)}</td>
                </tr>
              ))}
              {!report.recentSales.length && (
                <tr><td className="px-3 py-6 text-center text-[#65748a]" colSpan={3}>{t('No paid orders yet.')}</td></tr>
              )}
            </tbody>
            {report.recentSales.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-[#dce3eb]">
                  <th className="px-3 py-3 font-extrabold text-[#092a53]" scope="row">{t('Total')}</th>
                  <td className="px-3 py-3 text-right font-extrabold tabular-nums text-[#092a53]">{periodOrders}</td>
                  <td className="px-3 py-3 text-right font-extrabold tabular-nums text-[#092a53]">{formatXaf(periodSales, language)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </details>
    </div>
  )
}
