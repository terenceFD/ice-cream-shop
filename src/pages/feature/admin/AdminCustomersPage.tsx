import { useEffect, useMemo, useState } from 'react'
import { apiRequest } from '../../../api/api'
import { useAdminAuth } from './useAdminAuth'
import { useLanguage } from '../../../language/useLanguage'

interface CustomerAccount {
  id: number
  name: string
  email: string
  phone?: string
  deliveryCity?: string
  isBanned: boolean
  createdAt: string
}

function whatsappNumber(phone: string): string {
  let digits = phone.replace(/\D/g, '')
  if (digits.startsWith('00')) digits = digits.slice(2)
  if (!digits.startsWith('237')) {
    if (digits.startsWith('0')) digits = digits.slice(1)
    digits = `237${digits}`
  }
  return digits.length >= 8 && digits.length <= 15 ? digits : ''
}

export function AdminCustomersPage() {
  const { currentAdmin } = useAdminAuth()
  const isOwner = currentAdmin?.role === 'owner'
  const { sessionToken } = useAdminAuth()
  const { t, language } = useLanguage()
  const [customers, setCustomers] = useState<CustomerAccount[]>([])
  const [promotionMessage, setPromotionMessage] = useState('')
  const [promotionCampaign, setPromotionCampaign] = useState<{
    recipients: CustomerAccount[]
    message: string
    currentIndex: number
  } | null>(null)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState<number | null>(null)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  useEffect(() => {
    let cancelled = false
    apiRequest<{ customers: CustomerAccount[] }>('/admin/customers', { token: sessionToken })
      .then((result) => {
        if (!cancelled) {
          setCustomers(result.customers)
          setError('')
        }
      })
      .catch((loadError: unknown) => {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : 'Unable to load customer accounts.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [sessionToken])

  const filteredCustomers = useMemo(() => {
    const query = search.trim().toLocaleLowerCase()
    if (!query) return customers
    return customers.filter((customer) =>
      [customer.name, customer.email, customer.phone, customer.deliveryCity]
        .some((value) => value?.toLocaleLowerCase().includes(query)),
    )
  }, [customers, search])

  const activeCount = customers.filter((customer) => !customer.isBanned).length
  const bannedCount = customers.length - activeCount

  async function toggleBan(customer: CustomerAccount) {
    const isBanned = !customer.isBanned
    setError('')
    setMessage('')
    setSavingId(customer.id)
    try {
      await apiRequest(`/admin/customers/${customer.id}/ban`, {
        method: 'PATCH',
        token: sessionToken,
        body: { isBanned },
      })
      setCustomers((current) => current.map((entry) =>
        entry.id === customer.id ? { ...entry, isBanned } : entry,
      ))
      setMessage(t(isBanned ? 'Customer banned.' : 'Customer unbanned.'))
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : 'Unable to update customer access.')
    } finally {
      setSavingId(null)
    }
  }

  function whatsappLink(customer: CustomerAccount, text = promotionMessage.trim()): string | undefined {
    const number = customer.phone ? whatsappNumber(customer.phone) : ''
    if (!number || !text) return undefined
    return `https://wa.me/${number}?text=${encodeURIComponent(text)}`
  }

  function sendPromotionToAll() {
    const text = promotionMessage.trim()
    if (!text) {
      setError(t('Enter a promotion message first.'))
      return
    }

    const recipients = customers.filter((customer) =>
      !customer.isBanned && Boolean(customer.phone && whatsappNumber(customer.phone)),
    )
    if (!recipients.length) {
      setError(t('No active customers have a valid WhatsApp number.'))
      return
    }

    const firstLink = whatsappLink(recipients[0], text)
    if (!firstLink) return
    window.open(firstLink, '_blank', 'noopener,noreferrer')
    setPromotionCampaign({ recipients, message: text, currentIndex: 0 })
    setError('')
    setMessage(t('WhatsApp opened for the first customer. Send the message, then continue through the list.'))
  }

  function openNextPromotionChat() {
    if (!promotionCampaign) return
    const nextIndex = promotionCampaign.currentIndex + 1
    if (nextIndex >= promotionCampaign.recipients.length) {
      setPromotionCampaign(null)
      setMessage(t('Promotion message list completed.'))
      return
    }

    const link = whatsappLink(
      promotionCampaign.recipients[nextIndex],
      promotionCampaign.message,
    )
    if (!link) {
      setError(t('This customer phone number is invalid.'))
      return
    }
    window.open(link, '_blank', 'noopener,noreferrer')
    setPromotionCampaign({ ...promotionCampaign, currentIndex: nextIndex })
    setError('')
  }

  function joinedDate(value: string) {
    const date = new Date(`${value.replace(' ', 'T')}Z`)
    if (Number.isNaN(date.getTime())) return value
    return new Intl.DateTimeFormat(language === 'fr' ? 'fr-CM' : 'en-CM', { dateStyle: 'medium' }).format(date)
  }

  return (
    <div className="min-w-0 space-y-6">
      <section className="relative isolate overflow-hidden rounded-[26px] bg-gradient-to-br from-[#092a53] via-[#123b63] to-[#285777] px-5 py-7 text-white shadow-[0_16px_38px_rgba(9,42,83,0.16)] sm:px-8 sm:py-8">
        <div aria-hidden="true" className="absolute -right-12 -top-20 -z-10 size-64 rounded-full border-[36px] border-white/[0.05]" />
        <div aria-hidden="true" className="absolute -bottom-28 right-36 -z-10 size-52 rounded-full bg-[#ffdc32]/10 blur-3xl" />
        <div className="relative flex flex-wrap items-start justify-between gap-5">
          <div className="max-w-2xl">
            <p className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.08] px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.15em] text-[#ffdf52]">
              <svg aria-hidden="true" className="size-3.5" fill="none" viewBox="0 0 20 20">
                <path d="M13.5 16.5v-1.2a3.3 3.3 0 0 0-3.3-3.3H5.8a3.3 3.3 0 0 0-3.3 3.3v1.2m15 0v-1.2a3.3 3.3 0 0 0-2.5-3.2M11.3 3.7a3.3 3.3 0 0 1 0 6.4M8 7a2.8 2.8 0 1 1-5.6 0A2.8 2.8 0 0 1 8 7Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
              </svg>
              {t('Customer management')}
            </p>
            <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">{t('Customer accounts')}</h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-blue-100/80">{t('View registered customers, manage account access, and prepare promotion messages for WhatsApp.')}</p>
          </div>
          <div className="relative grid min-w-28 place-items-center rounded-2xl border border-white/10 bg-white/[0.08] px-5 py-4 text-center backdrop-blur-sm">
            <p className="text-[10px] font-bold uppercase tracking-[0.13em] text-blue-100/70">{t('Registered customers')}</p>
            <p className="mt-1 font-display text-3xl font-bold">{customers.length}</p>
          </div>
        </div>
        <div className="relative mt-7 grid grid-cols-2 gap-3 sm:max-w-md">
          {[
            { label: t('Active accounts'), value: activeCount, icon: 'm5 12 4 4L19 6', accent: 'text-[#9ee6b1]' },
            { label: t('Restricted accounts'), value: bannedCount, icon: 'M6 6l12 12M18 6 6 18', accent: 'text-[#ffb4a8]' },
          ].map((metric) => (
            <article className="rounded-2xl border border-white/10 bg-white/[0.07] px-4 py-3.5" key={metric.label}>
              <div className="flex items-center justify-between gap-2">
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-blue-100/65">{metric.label}</p>
                <svg aria-hidden="true" className={`size-4 ${metric.accent}`} fill="none" viewBox="0 0 24 24">
                  <path d={metric.icon} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
                </svg>
              </div>
              <p className="mt-1 font-display text-2xl font-bold">{metric.value}</p>
            </article>
          ))}
        </div>
      </section>

      {error && <p className="rounded-xl border border-red-200 bg-red-50 p-3.5 text-sm text-red-700" role="alert">{error}</p>}
      {message && <p className="rounded-xl border border-green-200 bg-green-50 p-3.5 text-sm text-green-800" role="status">{message}</p>}

      <section className="overflow-hidden rounded-[22px] border border-[#e2e8f0] bg-white shadow-[0_8px_24px_rgba(16,44,80,0.04)]">
        <div className="flex flex-wrap items-start gap-3 border-b border-[#edf1f5] px-5 py-5 sm:px-6">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#eaf1f8] text-[#315982]">
            <svg aria-hidden="true" className="size-5" fill="none" viewBox="0 0 24 24">
              <path d="M3 5h18v14H3zM3 7l9 6 9-6" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6" />
            </svg>
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-lg font-bold text-[#102c50]">{t('Promotion message')}</h2>
            <p className="mt-1 text-xs leading-5 text-[#718196]">{t('Write the promotion message to prepare in WhatsApp.')}</p>
          </div>
          <span className="rounded-full bg-[#f3f6fa] px-2.5 py-1 text-[10px] font-bold text-[#718196]">{promotionMessage.length}/1000</span>
        </div>
        <div className="grid gap-4 p-5 sm:p-6 lg:grid-cols-[minmax(0,1fr)_220px] lg:items-end">
          <label className="block text-xs font-bold text-[#344d69]" htmlFor="promotion-message">
            {t('Message for customers')}
            <textarea
              className="mt-1.5 min-h-24 w-full resize-y rounded-xl border border-[#dce5ef] bg-[#fbfcfe] px-3.5 py-3 text-sm font-normal text-[#102c50] outline-none transition placeholder:text-[#93a1b1] focus:border-[#8ca8c3] focus:bg-white focus:ring-4 focus:ring-[#dbe8f4]/70"
              id="promotion-message"
              maxLength={1000}
              onChange={(event) => setPromotionMessage(event.target.value)}
              placeholder={t('Write the promotion message to prepare in WhatsApp.')}
              value={promotionMessage}
            />
          </label>
          <div className="space-y-3">
            {isOwner && <button
              className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#16733f] px-4 py-3 text-sm font-extrabold text-white transition hover:bg-[#125f34] disabled:cursor-not-allowed disabled:opacity-50"
              disabled={loading || !promotionMessage.trim() || promotionCampaign !== null}
              onClick={sendPromotionToAll}
              type="button"
            >
              {t('Send to all')}
            </button>}
            <p className="text-[11px] leading-5 text-[#718196]">
              {t('Opens WhatsApp chats one at a time for active customers with valid phone numbers. You review and send each message.')}
            </p>
            <div className="rounded-xl border border-[#dce5ef] bg-[#f8fafc] p-3.5">
            <p className="flex items-center gap-2 text-xs font-bold text-[#344d69]">
              <svg aria-hidden="true" className="size-4 shrink-0 text-[#315982]" fill="none" viewBox="0 0 20 20">
                <path d="M10 17a7 7 0 1 0 0-14 7 7 0 0 0 0 14Zm0-10v3.5m0 2h.01" stroke="currentColor" strokeLinecap="round" strokeWidth="1.5" />
              </svg>
              {t('Admin sends the message')}
            </p>
            <p className="mt-1.5 text-[11px] leading-5 text-[#718196]">{t('WhatsApp opens with this message filled in. The admin reviews it and sends it from WhatsApp.')}</p>
            </div>
          </div>
        </div>
        {promotionCampaign && (
          <div className="flex flex-col gap-3 border-t border-[#edf1f5] bg-[#f8fafc] px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <div>
              <p className="text-sm font-bold text-[#173654]" role="status">
                {t('Customer {current} of {total}', {
                  current: promotionCampaign.currentIndex + 1,
                  total: promotionCampaign.recipients.length,
                })}
                {' — '}
                {promotionCampaign.recipients[promotionCampaign.currentIndex].name}
              </p>
              <a
                className="mt-1 inline-block text-xs font-semibold text-[#315982] underline underline-offset-2"
                href={whatsappLink(
                  promotionCampaign.recipients[promotionCampaign.currentIndex],
                  promotionCampaign.message,
                )}
                rel="noreferrer"
                target="_blank"
              >
                {t('Open current WhatsApp chat again')}
              </a>
            </div>
            <button
              className="inline-flex min-h-10 items-center justify-center rounded-lg border border-[#b8dfc2] bg-white px-4 py-2 text-xs font-bold text-[#20723a] transition hover:bg-[#e7f7eb]"
              onClick={openNextPromotionChat}
              type="button"
            >
              {promotionCampaign.currentIndex + 1 === promotionCampaign.recipients.length
                ? t('Finish campaign')
                : t('Open next WhatsApp chat')}
            </button>
          </div>
        )}
      </section>

      <section className="overflow-hidden rounded-[22px] border border-[#e2e8f0] bg-white shadow-[0_8px_24px_rgba(16,44,80,0.04)]">
        <div className="flex flex-col gap-4 border-b border-[#edf1f5] px-5 py-5 sm:flex-row sm:items-end sm:justify-between sm:px-6">
          <div>
            <p className="mb-1 text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#bd9c00]">{t('Customer directory')}</p>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-display text-xl font-bold text-[#102c50]">{t('Registered customers')}</h2>
              {!loading && <span className="rounded-full bg-[#f1f5f9] px-2.5 py-1 text-[10px] font-bold text-[#65748a]">{t('{shown} shown', { shown: filteredCustomers.length })}</span>}
            </div>
          </div>
          <label className="relative block w-full sm:max-w-xs">
            <span className="sr-only">{t('Search customers')}</span>
            <svg aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-[#8291a3]" fill="none" viewBox="0 0 20 20">
              <circle cx="8.8" cy="8.8" r="5.8" stroke="currentColor" strokeWidth="1.5" />
              <path d="m13.2 13.2 4 4" stroke="currentColor" strokeLinecap="round" strokeWidth="1.5" />
            </svg>
            <input
              className="min-h-11 w-full rounded-xl border border-[#dce5ef] bg-[#f8fafc] pl-10 pr-3 text-sm text-[#102c50] outline-none transition placeholder:text-[#91a0b1] focus:border-[#8ca8c3] focus:bg-white focus:ring-2 focus:ring-[#dbe8f4]"
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t('Name, email, or phone')}
              type="search"
              value={search}
            />
          </label>
        </div>

        {loading ? (
          <div className="space-y-3 p-5 sm:p-6" role="status">
            <span className="sr-only">{t('Loading customers…')}</span>
            {[0, 1, 2].map((row) => <div aria-hidden="true" className="h-24 animate-pulse rounded-xl bg-[#f3f6fa]" key={row} />)}
          </div>
        ) : filteredCustomers.length ? (
          <div className="divide-y divide-[#edf1f5]">
            {filteredCustomers.map((customer) => {
              const link = whatsappLink(customer)
              return (
                <article className="flex flex-col gap-4 p-4 transition-colors hover:bg-[#fbfcfe] sm:px-6 sm:py-5 lg:flex-row lg:items-center lg:justify-between" key={customer.id}>
                  <div className="flex min-w-0 items-start gap-3.5">
                    <span aria-hidden="true" className={`grid size-11 shrink-0 place-items-center rounded-xl font-display text-base font-bold ${customer.isBanned ? 'bg-red-50 text-red-700' : 'bg-[#edf3f9] text-[#315982]'}`}>
                      {customer.name.trim().charAt(0).toUpperCase() || '?'}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="truncate font-bold text-[#173654]">{customer.name}</h3>
                        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-extrabold ${customer.isBanned ? 'bg-red-50 text-red-800' : 'bg-green-50 text-green-800'}`}>
                          <span aria-hidden="true" className={`size-1.5 rounded-full ${customer.isBanned ? 'bg-red-500' : 'bg-green-500'}`} />
                          {t(customer.isBanned ? 'Banned' : 'Active')}
                        </span>
                      </div>
                      <div className="mt-1.5 flex min-w-0 flex-col gap-x-4 gap-y-1 text-xs text-[#65748a] sm:flex-row sm:flex-wrap">
                        <span className="flex min-w-0 items-center gap-1.5">
                          <svg aria-hidden="true" className="size-3.5 shrink-0 text-[#8a9aad]" fill="none" viewBox="0 0 20 20">
                            <path d="M3 5h14v10H3zM3 6l7 5 7-5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.4" />
                          </svg>
                          <span className="truncate">{customer.email}</span>
                        </span>
                        <span className="flex items-center gap-1.5">
                          <svg aria-hidden="true" className="size-3.5 shrink-0 text-[#8a9aad]" fill="none" viewBox="0 0 20 20">
                            <path d="M6 3.5h8a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-11a1 1 0 0 1 1-1Zm3 10h2" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.4" />
                          </svg>
                          {customer.phone || t('No phone number provided')}
                        </span>
                      </div>
                      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-[#8796a8]">
                        {customer.deliveryCity && <span>{t(customer.deliveryCity)}</span>}
                        <span>{t('Joined')}: {joinedDate(customer.createdAt)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 pl-[58px] lg:shrink-0 lg:pl-0">
                    {link ? (
                      <a
                        className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-[#b8dfc2] bg-[#f2fbf4] px-3.5 text-xs font-bold text-[#20723a] transition hover:bg-[#e7f7eb]"
                        href={link}
                        rel="noreferrer"
                        target="_blank"
                      >
                        <svg aria-hidden="true" className="size-4" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M12.04 2a9.9 9.9 0 0 0-8.49 15l-1.3 4.75 4.86-1.27A9.96 9.96 0 1 0 12.04 2Zm0 18.1a8.1 8.1 0 0 1-4.13-1.13l-.3-.18-2.88.75.77-2.8-.2-.3A8.12 8.12 0 1 1 12.04 20.1Zm4.45-6.08c-.24-.12-1.43-.7-1.65-.78-.22-.08-.38-.12-.54.12-.16.24-.62.78-.76.94-.14.16-.28.18-.52.06-.24-.12-1.02-.38-1.94-1.2-.72-.64-1.2-1.43-1.34-1.67-.14-.24-.02-.37.1-.49.1-.1.24-.28.36-.42.12-.14.16-.24.24-.4.08-.16.04-.3-.02-.42-.06-.12-.54-1.3-.74-1.78-.2-.47-.4-.4-.54-.4h-.46c-.16 0-.42.06-.64.3-.22.24-.84.82-.84 2s.86 2.32.98 2.48c.12.16 1.7 2.6 4.12 3.64.58.25 1.03.4 1.38.5.58.18 1.1.15 1.51.09.46-.07 1.43-.59 1.63-1.16.2-.57.2-1.06.14-1.16-.06-.1-.22-.16-.46-.28Z" />
                        </svg>
                        {t('Message on WhatsApp')}
                      </a>
                    ) : (
                      <button className="inline-flex min-h-10 cursor-not-allowed items-center justify-center gap-2 rounded-lg border border-[#dce5ef] px-3.5 text-xs font-bold text-[#9aa6b4]" disabled title={t(!customer.phone ? 'This customer has no phone number.' : !whatsappNumber(customer.phone) ? 'This customer phone number is invalid.' : 'Enter a promotion message first.')} type="button">
                        {t('Message on WhatsApp')}
                      </button>
                    )}
                    {isOwner && <button
                      className={`min-h-10 rounded-lg px-3.5 text-xs font-bold transition disabled:cursor-wait disabled:opacity-50 ${customer.isBanned ? 'border border-[#dce5ef] text-[#50657d] hover:bg-[#f6f9fc]' : 'border border-red-200 text-red-700 hover:bg-red-50'}`}
                      disabled={savingId === customer.id}
                      onClick={() => toggleBan(customer)}
                      type="button"
                    >
                      {savingId === customer.id ? t('Saving…') : t(customer.isBanned ? 'Unban customer' : 'Ban customer')}
                    </button>}
                  </div>
                </article>
              )
            })}
          </div>
        ) : (
          <div className="px-5 py-12 text-center">
            <span aria-hidden="true" className="mx-auto grid size-12 place-items-center rounded-2xl bg-[#f3f6fa] text-[#52708e]">
              <svg className="size-5" fill="none" viewBox="0 0 20 20">
                <circle cx="8.8" cy="8.8" r="5.8" stroke="currentColor" strokeWidth="1.5" />
                <path d="m13.2 13.2 4 4" stroke="currentColor" strokeLinecap="round" strokeWidth="1.5" />
              </svg>
            </span>
            <h3 className="mt-4 font-display text-lg font-bold text-[#173654]">{t(search ? 'No customers match your search.' : 'No customer accounts yet.')}</h3>
            {search && <button className="mt-3 rounded-lg px-3 py-2 text-xs font-bold text-[#315982] transition hover:bg-[#f3f6fa]" onClick={() => setSearch('')} type="button">{t('Clear search')}</button>}
          </div>
        )}
        {!loading && customers.length > 0 && (
          <div className="border-t border-[#edf1f5] bg-[#fbfcfe] px-5 py-3 text-xs text-[#7c8a9b] sm:px-6" role="status">
            {t('Showing {shown} of {total} customers', { shown: filteredCustomers.length, total: customers.length })}
          </div>
        )}
      </section>
    </div>
  )
}
