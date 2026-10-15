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
    <header className="flex flex-col gap-5 border-b border-[#edf1f5] pb-6 xl:flex-row xl:items-end xl:justify-between">
      <div className="flex min-w-0 items-center gap-4">
        <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-[#092a53] text-[#ffdc32]">
          <AdminIcon className="size-7" path={icon} />
        </span>
        <div className="min-w-0">
          <nav aria-label={t('Breadcrumb')} className="text-[11px] font-bold text-[#8190a1]">
            {section} <span aria-hidden="true" className="mx-1">/</span>
            <span className="text-[#8a7000]">{title}</span>
          </nav>
          <h1 className="mt-1 font-display text-2xl font-extrabold tracking-tight text-[#092a53] sm:text-[1.9rem]">{title}</h1>
          {description && <p className="mt-0.5 max-w-2xl text-sm text-[#65748a]">{description}</p>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2 xl:justify-end">{actions}</div>}
    </header>
  )
}

export function AdminStatCard({ icon, accent, value, label }) {
  return (
    <div className="rounded-2xl border border-[#e5ebf3] bg-white p-4 sm:p-5">
      <span className={`grid size-9 place-items-center rounded-xl ${accent}`}><AdminIcon path={icon} /></span>
      <p className="mt-4 font-display text-[1.75rem] font-extrabold leading-none tracking-tight text-[#102c50]">{value}</p>
      <p className="mt-1.5 text-xs font-semibold text-[#65748a]">{label}</p>
    </div>
  )
}

export function AdminNotice({ tone = 'success', children }) {
  if (!children) return null
  const styles = tone === 'error'
    ? 'bg-red-50 text-red-700 ring-red-100'
    : 'bg-[#eaf6ee] text-[#1f5d3c] ring-[#cfe8d8]'
  return (
    <p className={`flex items-start gap-2 rounded-xl px-4 py-3 text-sm font-semibold ring-1 ${styles}`} role={tone === 'error' ? 'alert' : 'status'}>
      <AdminIcon className="mt-0.5 size-4 shrink-0" path={tone === 'error' ? adminIcons.alert : adminIcons.check} />
      {children}
    </p>
  )
}

// On/off switch styled like the menu inventory "On sale" toggle.
export function AdminToggle({ checked, onChange, label, disabled = false }) {
  return (
    <label className={`inline-flex cursor-pointer items-center gap-2.5 text-sm font-bold text-[#355777] ${disabled ? 'cursor-not-allowed opacity-50' : ''}`}>
      <button
        aria-checked={checked}
        className={`relative h-6 w-11 shrink-0 rounded-full transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#bd9c00] ${checked ? 'bg-[#2e9d5b]' : 'bg-[#d6dde6]'}`}
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
