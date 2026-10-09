import { useEffect, useMemo, useState } from 'react'
import { apiRequest } from '../../../api/api'
import { useAdminAuth } from './AdminAuthContext'
import { useLanguage } from '../../../language/LanguageContext'

function whatsappNumber(phone) {
  let digits = phone.replace(/\D/g, '')
  if (digits.startsWith('00')) digits = digits.slice(2)
  if (!digits.startsWith('237')) {
    if (digits.startsWith('0')) digits = digits.slice(1)
    digits = `237${digits}`
  }
  return digits.length >= 8 && digits.length <= 15 ? digits : ''
}

export function AdminCustomersPage() {
  const { sessionToken } = useAdminAuth()
  const { t, language } = useLanguage()
  const [customers, setCustomers] = useState([])
  const [promotionMessage, setPromotionMessage] = useState('')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState(null)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  useEffect(() => {
    let cancelled = false
    apiRequest('/admin/customers', { token: sessionToken })
      .then((result) => {
        if (!cancelled) {
          setCustomers(result.customers)
          setError('')
        }
      })
      .catch((loadError) => {
        if (!cancelled) setError(loadError.message)
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

  async function toggleBan(customer) {
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
      setError(updateError.message)
    } finally {
      setSavingId(null)
    }
  }

  function whatsappLink(customer) {
    const text = promotionMessage.trim()
    const number = customer.phone ? whatsappNumber(customer.phone) : ''
    if (!number || !text) return undefined
    return `https://wa.me/${number}?text=${encodeURIComponent(text)}`
  }

  return (
    <div className="min-w-0">
      <div className="mb-7">
        <p className="mb-2 inline-block rounded-full bg-[#ffeb9c] px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.12em]">{t('Customer management')}</p>
        <h1 className="font-display text-3xl font-bold sm:text-4xl">{t('Customer accounts')}</h1>
        <p className="mt-2 text-sm leading-6 text-[#65748a]">{t('View registered customers, manage account access, and prepare promotion messages for WhatsApp.')}</p>
      </div>

      <section className="mb-6 rounded-2xl border border-[#d9d6cc] bg-white p-4 sm:p-5">
        <label className="block text-sm font-bold" htmlFor="promotion-message">{t('Promotion message')}</label>
        <textarea
          className="mt-2 min-h-28 w-full rounded-xl border border-[#d9d6cc] px-4 py-3 text-sm font-normal"
          id="promotion-message"
          maxLength={1000}
          onChange={(event) => setPromotionMessage(event.target.value)}
          placeholder={t('Write the promotion message to prepare in WhatsApp.')}
          value={promotionMessage}
        />
        <p className="mt-2 text-xs text-[#65748a]">{t('WhatsApp opens with this message filled in. The admin reviews it and sends it from WhatsApp.')}</p>
      </section>

      <label className="mb-4 block text-sm font-semibold">
        {t('Search customers')}
        <input
          className="mt-1.5 w-full rounded-xl border border-[#d9d6cc] bg-white px-4 py-3 text-sm font-normal"
          onChange={(event) => setSearch(event.target.value)}
          placeholder={t('Name, email, or phone')}
          type="search"
          value={search}
        />
      </label>

      {error && <p className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-700" role="alert">{error}</p>}
      {message && <p className="mb-4 rounded-xl bg-green-50 p-3 text-sm text-green-800" role="status">{message}</p>}
      {loading ? <p className="text-sm text-[#65748a]">{t('Loading customers…')}</p> : filteredCustomers.length ? (
        <div className="space-y-3">
          {filteredCustomers.map((customer) => {
            const link = whatsappLink(customer)
            return (
              <article className="grid min-w-0 gap-4 rounded-2xl border border-[#d9d6cc] bg-white p-4 sm:p-5 lg:grid-cols-[minmax(0,1fr)_auto]" key={customer.id}>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-display text-xl font-bold">{customer.name}</h2>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${customer.isBanned ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>
                      {t(customer.isBanned ? 'Banned' : 'Active')}
                    </span>
                  </div>
                  <p className="mt-2 break-all text-sm">{customer.email}</p>
                  <p className="mt-1 text-sm text-[#65748a]">{customer.phone || t('No phone number provided')}{customer.deliveryCity ? ` · ${t(customer.deliveryCity)}` : ''}</p>
                  <p className="mt-1 text-xs text-[#65748a]">{t('Joined')}: {new Intl.DateTimeFormat(language === 'fr' ? 'fr-CM' : 'en-CM', { dateStyle: 'medium' }).format(new Date(`${customer.createdAt.replace(' ', 'T')}Z`))}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                  {link ? (
                    <a
                      className="inline-flex min-h-10 items-center justify-center rounded-full border border-green-700 px-4 py-2 text-sm font-bold text-green-800 hover:bg-green-50"
                      href={link}
                      rel="noreferrer"
                      target="_blank"
                    >
                      {t('Message on WhatsApp')}
                    </a>
                  ) : (
                    <button className="min-h-10 rounded-full border border-green-700 px-4 py-2 text-sm font-bold text-green-800 opacity-50" disabled title={t(!customer.phone ? 'This customer has no phone number.' : !whatsappNumber(customer.phone) ? 'This customer phone number is invalid.' : 'Enter a promotion message first.')}>
                      {t('Message on WhatsApp')}
                    </button>
                  )}
                  <button
                    className={`min-h-10 rounded-full px-4 py-2 text-sm font-bold disabled:opacity-50 ${customer.isBanned ? 'border border-[#65748a] text-[#65748a]' : 'bg-red-700 text-white hover:bg-red-800'}`}
                    disabled={savingId === customer.id}
                    onClick={() => toggleBan(customer)}
                    type="button"
                  >
                    {savingId === customer.id ? t('Saving…') : t(customer.isBanned ? 'Unban customer' : 'Ban customer')}
                  </button>
                </div>
              </article>
            )
          })}
        </div>
      ) : (
        <p className="rounded-xl bg-[#f4f2f2] p-4 text-sm text-[#65748a]">{t(search ? 'No customers match your search.' : 'No customer accounts yet.')}</p>
      )}
    </div>
  )
}
