// Header and stat card in the same style as the other admin pages (icon tile, breadcrumb,
// title, description, actions on the right), for pages that are not built around a table board.
import { adminIcons } from './adminIcons'


export function AdminIcon({ path, className = 'size-4' }) {
  return (
    <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 24 24">
      <path d={path} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
    </svg>
  )
}

export function AdminPageHeader({ icon, section, title, description, actions, t }) {
  return (
    <header className="flex flex-col gap-5 border-b border-[#f4f6f8] pb-6 xl:flex-row xl:items-end xl:justify-between">
      <div className="min-w-0">
        <nav aria-label={t('Breadcrumb')} className="text-xs font-medium text-[#65748a]">
          {section} <span aria-hidden="true" className="mx-1">/</span>
          <span className="text-brand-navy">{title}</span>
        </nav>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[#111]">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-sm text-[#65748a]">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2 xl:justify-end">{actions}</div>}
    </header>
  )
}

export function AdminStatCard({ value, label }) {
  return (
    <div className="bg-white px-4 py-4 sm:px-5">
      <p className="text-xs font-medium text-[#65748a]">{label}</p>
      <p className="mt-2 break-words text-2xl font-semibold leading-tight tabular-nums tracking-tight text-[#111]">{value}</p>
    </div>
  )
}

export function AdminNotice({ tone = 'success', children }) {
  if (!children) return null
  const styles = tone === 'error'
    ? 'bg-red-50 text-red-700 ring-red-100'
    : 'bg-[#eaf6ee] text-[#1f5d3c] ring-[#cfe8d8]'
  return (
    <p className={`flex items-start gap-2 rounded-md px-4 py-3 text-sm font-semibold ring-1 ${styles}`} role={tone === 'error' ? 'alert' : 'status'}>
      <AdminIcon className="mt-0.5 size-4 shrink-0" path={tone === 'error' ? adminIcons.alert : adminIcons.check} />
      {children}
    </p>
  )
}

// On/off switch styled like the menu inventory "On sale" toggle.
export function AdminToggle({ checked, onChange, label, disabled = false }) {
  return (
    <label className={`inline-flex cursor-pointer items-center gap-2.5 text-sm font-bold text-brand-blue ${disabled ? 'cursor-not-allowed opacity-50' : ''}`}>
      <button
        aria-checked={checked}
        className={`relative h-6 w-11 shrink-0 rounded-full transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-yellow-deep ${checked ? 'bg-[#2e9d5b]' : 'bg-[#d6dde6]'}`}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        role="switch"
        type="button"
      >
        <span className={`absolute top-0.5 size-5 rounded-full bg-white shadow transition ${checked ? 'left-[1.375rem]' : 'left-0.5'}`} />
      </button>
      {label}
    </label>
  )
}
