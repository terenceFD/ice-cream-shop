import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { apiRequest } from '../../api/api'
import { useAdminAuth } from '../../pages/admin/useAdminAuth'
import { useLanguage } from '../../language/useLanguage'
import './AdminNotifications.css'

interface ContactMessage {
  id: number
  name: string
  email: string
  phone?: string
  subject: string
  message: string
  createdAt: string
  isRead: boolean
  storeName?: string | null
  repliedAt?: string | null
}

type ContactMessageResponse = Omit<ContactMessage, 'createdAt' | 'isRead' | 'repliedAt'> & {
  createdAt?: string | null
  createdat?: string | null
  created_at?: string | null
  isRead?: boolean
  isread?: boolean
  is_read?: boolean
  repliedAt?: string | null
  repliedat?: string | null
  replied_at?: string | null
}

type InboxFilter = 'all' | 'unread' | 'awaiting' | 'replied'

const icons = {
  inbox: 'M4 13h4l1.5 3h5L16 13h4M4 13l2.5-8h11L20 13M4 13v6h16v-6',
  refresh: 'M4 12a8 8 0 0 1 13.7-5.7L20 8.5M20 4v4.5h-4.5M20 12a8 8 0 0 1-13.7 5.7L4 15.5M4 20v-4.5h4.5',
  search: 'm20 20-4.2-4.2M10.5 17a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13Z',
  mail: 'M4 6h16v12H4V6Zm0 0 8 7 8-7',
  mailOpen: 'M4 10 12 4l8 6v10H4V10Zm0 0 8 6 8-6',
  phone: 'M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a1 1 0 0 1-1 1A16 16 0 0 1 4 5a1 1 0 0 1 1-1Z',
  reply: 'M10 9 5 13l5 4M5 13h9a5 5 0 0 1 5 5v1',
  send: 'M21 3 10 14M21 3l-7 18-4-7-7-4 18-7Z',
  trash: 'M4 7h16M10 11v6m4-6v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3',
  check: 'm5 12.5 4.5 4.5L19 7.5',
  alert: 'M12 8v5m0 3.5v.01M10.3 3.9 2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z',
  close: 'M6 6l12 12M18 6 6 18',
  back: 'm15 6-6 6 6 6',
  pin: 'M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21Zm0-9a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z',
  copy: 'M9 9h10v10H9V9Zm-4 6V5h10',
}

function Icon({ path, className = 'size-4' }: { path: string; className?: string }) {
  return (
    <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 24 24">
      <path d={path} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
    </svg>
  )
}

function parseDate(value: string | null | undefined) {
  if (typeof value !== 'string' || !value.trim()) return null
  const normalizedValue = value.includes('T') ? value : value.replace(' ', 'T')
  const hasTimezone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(normalizedValue)
  const date = new Date(hasTimezone ? normalizedValue : `${normalizedValue}Z`)
  return Number.isNaN(date.getTime()) ? null : date
}

function formatDate(value: string | null | undefined, t: (key: string) => string, language: string) {
  const date = parseDate(value)
  if (!date) return t('Date unavailable')
  return date.toLocaleString(language === 'fr' ? 'fr-CM' : 'en-CM', { dateStyle: 'medium', timeStyle: 'short' })
}

function shortDate(value: string | null | undefined, language: string) {
  const date = parseDate(value)
  if (!date) return ''
  const locale = language === 'fr' ? 'fr-CM' : 'en-CM'
  const now = new Date()
  if (date.toDateString() === now.toDateString()) return date.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })
  if (now.getTime() - date.getTime() < 6 * 86400000) return date.toLocaleDateString(locale, { weekday: 'short' })
  return date.toLocaleDateString(locale, { day: 'numeric', month: 'short' })
}

function initials(name: string) {
  return String(name || '?').trim().split(/\s+/).slice(0, 2).map((part) => part.charAt(0).toUpperCase()).join('')
}

const avatarTones = ['bg-[#e9f1fa] text-[#245281]', 'bg-[#fff4c2] text-[#bd9c00]', 'bg-[#e5f4ea] text-[#2c7a4f]', 'bg-[#fdecea] text-[#a53f37]', 'bg-[#efe9fb] text-[#5b3fa0]']

function avatarTone(name: string) {
  const sum = [...String(name)].reduce((total, character) => total + character.charCodeAt(0), 0)
  return avatarTones[sum % avatarTones.length]
}

export function AdminNotifications() {
  const { sessionToken } = useAdminAuth()
  const { t, language } = useLanguage()
  const [messages, setMessages] = useState<ContactMessage[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [isComposing, setIsComposing] = useState(false)
  const [replyDraft, setReplyDraft] = useState('')
  const [sendingId, setSendingId] = useState<number | null>(null)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [isClearingAll, setIsClearingAll] = useState(false)
  const [replyErrors, setReplyErrors] = useState<Record<number, string>>({})
  const [replySent, setReplySent] = useState<Record<number, boolean>>({})
  const [filter, setFilter] = useState<InboxFilter>('all')
  const [search, setSearch] = useState('')
  const [confirm, setConfirm] = useState<{ type: 'delete'; message: ContactMessage } | { type: 'clear' } | null>(null)
  const [copied, setCopied] = useState(false)

  const refresh = useCallback(async () => {
    setError('')
    setIsRefreshing(true)
    try {
      const result = await apiRequest<{ messages: ContactMessageResponse[]; unreadCount: number }>('/admin/notifications', { token: sessionToken })
      if (!result || !Array.isArray(result.messages)) {
        throw new Error(t('The notification service returned an invalid response.'))
      }
      setMessages(result.messages.map((message) => ({
        ...message,
        createdAt: message.createdAt ?? message.createdat ?? message.created_at ?? '',
        isRead: Boolean(message.isRead ?? message.isread ?? message.is_read),
        repliedAt: message.repliedAt ?? message.repliedat ?? message.replied_at ?? undefined,
      })))
      setUnreadCount(result.unreadCount)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : String(loadError))
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }, [sessionToken, t])

  useEffect(() => {
    refresh()
  }, [refresh])

  useEffect(() => {
    if (!confirm) return undefined
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setConfirm(null)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [confirm])

  const counts = useMemo(() => ({
    all: messages.length,
    unread: messages.filter((message) => !message.isRead).length,
    awaiting: messages.filter((message) => !message.repliedAt && !replySent[message.id]).length,
    replied: messages.filter((message) => message.repliedAt || replySent[message.id]).length,
  }), [messages, replySent])

  const visibleMessages = useMemo(() => {
    const query = search.trim().toLowerCase()
    return messages.filter((message) => {
      const isReplied = Boolean(message.repliedAt || replySent[message.id])
      const matchesFilter = filter === 'all'
        || (filter === 'unread' && !message.isRead)
        || (filter === 'awaiting' && !isReplied)
        || (filter === 'replied' && isReplied)
      const matchesSearch = !query || [message.name, message.email, message.subject, message.message, message.phone, message.storeName]
        .some((value) => String(value || '').toLowerCase().includes(query))
      return matchesFilter && matchesSearch
    })
  }, [filter, messages, replySent, search])

  const selectedMessage = messages.find((message) => message.id === selectedId) || null

  async function markRead(id: number) {
    setError('')
    try {
      await apiRequest(`/admin/notifications/${id}/read`, { method: 'PATCH', token: sessionToken })
      setMessages((currentMessages) => currentMessages.map((message) =>
        message.id === id ? { ...message, isRead: true } : message
      ))
      setUnreadCount((count) => Math.max(0, count - 1))
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : String(updateError))
    }
  }

  function openMessage(message: ContactMessage) {
    setSelectedId(message.id)
    setIsComposing(false)
    setReplyDraft('')
    setCopied(false)
    if (!message.isRead) markRead(message.id)
  }

  async function sendReply(event: FormEvent<HTMLFormElement>, message: ContactMessage) {
    event.preventDefault()
    setReplyErrors((current) => ({ ...current, [message.id]: '' }))
    setSendingId(message.id)
    try {
      const result = await apiRequest<{ repliedAt: string }>(`/admin/notifications/${message.id}/reply`, {
        method: 'POST',
        token: sessionToken,
        body: { reply: replyDraft },
      })
      setMessages((currentMessages) => currentMessages.map((currentMessage) =>
        currentMessage.id === message.id
          ? { ...currentMessage, isRead: true, repliedAt: result.repliedAt }
          : currentMessage
      ))
      setUnreadCount((count) => message.isRead ? count : Math.max(0, count - 1))
      setReplyDraft('')
      setIsComposing(false)
      setReplySent((current) => ({ ...current, [message.id]: true }))
    } catch (sendError) {
      setReplyErrors((current) => ({ ...current, [message.id]: sendError instanceof Error ? sendError.message : String(sendError) }))
    } finally {
      setSendingId(null)
    }
  }

  async function deleteMessage(message: ContactMessage) {
    setError('')
    setDeletingId(message.id)
    try {
      await apiRequest(`/admin/notifications/${message.id}`, {
        method: 'DELETE',
        token: sessionToken,
      })
      setMessages((currentMessages) => currentMessages.filter((currentMessage) => currentMessage.id !== message.id))
      if (!message.isRead) {
        setUnreadCount((count) => Math.max(0, count - 1))
      }
      setReplySent((current) => {
        const updated = { ...current }
        delete updated[message.id]
        return updated
      })
      if (selectedId === message.id) {
        setSelectedId(null)
        setIsComposing(false)
        setReplyDraft('')
      }
      setConfirm(null)
    } catch (deleteError) {
      setError(t(deleteError instanceof Error ? deleteError.message : String(deleteError)))
    } finally {
      setDeletingId(null)
    }
  }

  async function clearAllMessages() {
    setError('')
    setIsClearingAll(true)
    try {
      await apiRequest('/admin/notifications', {
        method: 'DELETE',
        token: sessionToken,
      })
      setMessages([])
      setUnreadCount(0)
      setReplySent({})
      setReplyErrors({})
      setSelectedId(null)
      setIsComposing(false)
      setReplyDraft('')
      setConfirm(null)
    } catch (clearError) {
      setError(t(clearError instanceof Error ? clearError.message : String(clearError)))
    } finally {
      setIsClearingAll(false)
    }
  }

  async function copyEmail(email: string) {
    try {
      await navigator.clipboard.writeText(email)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }

  const filters: { key: InboxFilter; label: string }[] = [
    { key: 'all', label: t('All') },
    { key: 'unread', label: t('Unread') },
    { key: 'awaiting', label: t('Needs reply') },
    { key: 'replied', label: t('Replied') },
  ]

  return (
    <div className="admin-notifications">
      <header className="notification-header">
        <div className="notification-heading">
          <div className="min-w-0">
            <nav aria-label={t('Breadcrumb')} className="notification-breadcrumb">
              {t('Sales')} <span aria-hidden="true" className="mx-1">/</span>
              <span>{t('Notifications')}</span>
            </nav>
            <h1 className="notification-title">{t('Notifications')}</h1>
            <p className="notification-description">{t('Stay on top of customer inquiries and follow up promptly.')}</p>
          </div>
        </div>
        <div className="notification-actions">
          {messages.length > 3 && (
            <button
              className="notification-clear"
              disabled={isLoading || isClearingAll || deletingId !== null}
              onClick={() => setConfirm({ type: 'clear' })}
              type="button"
            >
              <Icon path={icons.trash} />
              {t('Clear all')}
            </button>
          )}
          <button
            className="notification-refresh"
            disabled={isRefreshing || isClearingAll}
            onClick={refresh}
            type="button"
          >
            <Icon className={`size-4 ${isRefreshing ? 'animate-spin' : ''}`} path={icons.refresh} />
            {t('Refresh')}
          </button>
        </div>
      </header>

      {error && (
        <p className="notification-error" role="alert">
          <Icon className="mt-0.5 size-4 shrink-0" path={icons.alert} />
          {error}
        </p>
      )}

      <section aria-label={t('Contact notifications')} className="notification-workspace">
        {/* Message list */}
        <div className={`notification-list ${selectedMessage ? 'notification-list--hidden' : ''}`}>
          <div className="notification-list-tools">
            <label className="relative block">
              <span className="sr-only">{t('Search')}</span>
              <Icon className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-[#65748a]" path={icons.search} />
              <input
                className="notification-search"
                onChange={(event) => setSearch(event.target.value)}
                placeholder={t('Search messages')}
                type="search"
                value={search}
              />
            </label>
            <div aria-label={t('Filter messages')} className="notification-filters" role="group">
              {filters.map((option) => (
                <button
                  aria-pressed={filter === option.key}
                  className="notification-filter"
                  key={option.key}
                  onClick={() => setFilter(option.key)}
                  type="button"
                >
                  {option.label}
                  <span className={`rounded-full px-1.5 text-xs ${filter === option.key ? 'bg-[#092a53] text-white' : 'bg-white/70 text-[#65748a]'}`}>{counts[option.key]}</span>
                </button>
              ))}
            </div>
          </div>

          {isLoading ? (
            <div aria-label={t('Loading…')} className="notification-loading" role="status">
              {[0, 1, 2, 3, 4].map((row) => (
                <div className="flex gap-3 rounded-xl p-3" key={row}>
                  <span className="size-10 shrink-0 rounded-full bg-[#f4f6f8]" />
                  <div className="flex-1 space-y-2">
                    <span className="block h-3 w-1/2 rounded bg-[#f4f6f8]" />
                    <span className="block h-3 w-4/5 rounded bg-[#f4f6f8]" />
                  </div>
                </div>
              ))}
            </div>
          ) : visibleMessages.length === 0 ? (
            <div className="notification-list-empty">
              <div>
                <span className="notification-empty-mark"><Icon className="size-5" path={icons.inbox} /></span>
                <p className="notification-empty-title">
                  {messages.length ? t('No messages match this view.') : t('No contact messages yet.')}
                </p>
                <p className="notification-empty-copy">{t('Messages submitted through the website contact form.')}</p>
              </div>
            </div>
          ) : (
            <ul className="notification-list-items">
              {visibleMessages.map((message) => {
                const isSelected = message.id === selectedId
                const isReplied = Boolean(message.repliedAt || replySent[message.id])
                return (
                  <li key={message.id}>
                    <button
                      aria-current={isSelected ? 'true' : undefined}
                      className={`notification-row${isSelected ? ' is-selected' : ''}${!message.isRead ? ' is-unread' : ''}${deletingId === message.id ? ' is-deleting' : ''}`}
                      onClick={() => openMessage(message)}
                      type="button"
                    >
                      {!message.isRead && <span aria-hidden="true" className="notification-unread-mark" />}
                      <span aria-hidden="true" className={`notification-avatar ${avatarTone(message.name)}`}>
                        {initials(message.name)}
                      </span>
                      <span className="notification-row-content">
                        <span className="flex items-baseline justify-between gap-2">
                          <span className="notification-name">{message.name}</span>
                          <span className="notification-time">{shortDate(message.createdAt, language)}</span>
                        </span>
                        <span className="notification-row-preview">
                          <span className="notification-subject">{message.subject}</span>
                          <span className="notification-snippet">{message.message}</span>
                        </span>
                        {(isReplied || message.storeName) && (
                          <span className="notification-row-meta">
                            {isReplied && (
                              <span className="notification-replied">
                                <Icon className="size-3" path={icons.reply} />
                                {t('Replied')}
                              </span>
                            )}
                            {message.storeName && (
                              <span className="notification-store">{t(message.storeName)}</span>
                            )}
                          </span>
                        )}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        {/* Reading pane */}
        <div className={`notification-reading-pane${selectedMessage ? '' : ' notification-reading-pane--empty'}`}>
          {selectedMessage ? (
            <>
              <div className="notification-reading-toolbar">
                <button
                  className="notification-back"
                  onClick={() => setSelectedId(null)}
                  type="button"
                >
                  <Icon path={icons.back} />
                  {t('Back to inbox')}
                </button>
                <span className="notification-full-date">{formatDate(selectedMessage.createdAt, t, language)}</span>
                <div className="flex items-center gap-1">
                  {!selectedMessage.isRead && (
                    <button aria-label={t('Mark as read')} className="notification-icon-action" onClick={() => markRead(selectedMessage.id)} title={t('Mark as read')} type="button">
                      <Icon path={icons.mailOpen} />
                    </button>
                  )}
                  <button
                    aria-label={t('Delete')}
                    className="notification-icon-action notification-delete-action"
                    disabled={deletingId === selectedMessage.id || isClearingAll}
                    onClick={() => setConfirm({ type: 'delete', message: selectedMessage })}
                    title={t('Delete')}
                    type="button"
                  >
                    <Icon path={icons.trash} />
                  </button>
                  <button aria-label={t('Close')} className="notification-icon-action notification-close-action" onClick={() => setSelectedId(null)} title={t('Close')} type="button">
                    <Icon path={icons.close} />
                  </button>
                </div>
              </div>

              <article className="notification-article">
                <h2 className="notification-subject-title">{selectedMessage.subject}</h2>
                <div className="notification-contact">
                  <div className="flex min-w-0 items-center gap-3">
                    <span aria-hidden="true" className={`notification-avatar notification-contact-avatar ${avatarTone(selectedMessage.name)}`}>{initials(selectedMessage.name)}</span>
                    <div className="min-w-0">
                      <p className="notification-contact-name">{selectedMessage.name}</p>
                      <div className="notification-contact-methods">
                        <a className="notification-contact-link" href={`mailto:${selectedMessage.email}`}>
                          <Icon className="size-3.5" path={icons.mail} />
                          {selectedMessage.email}
                        </a>
                        <button className="notification-copy" onClick={() => copyEmail(selectedMessage.email)} type="button">
                          <Icon className="size-3.5" path={copied ? icons.check : icons.copy} />
                          {t(copied ? 'Copied' : 'Copy')}
                        </button>
                        {selectedMessage.phone && (
                          <a className="notification-contact-link" href={`tel:${selectedMessage.phone}`}>
                            <Icon className="size-3.5" path={icons.phone} />
                            {selectedMessage.phone}
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="notification-contact-meta">
                    {selectedMessage.storeName && (
                      <span className="notification-store">
                        <Icon className="size-3.5" path={icons.pin} />
                        {t(selectedMessage.storeName)}
                      </span>
                    )}
                    <span className="notification-mobile-date">{formatDate(selectedMessage.createdAt, t, language)}</span>
                  </div>
                </div>

                <p className="notification-message">{selectedMessage.message}</p>

                {(selectedMessage.repliedAt || replySent[selectedMessage.id]) && (
                  <p className="notification-reply-status" role="status">
                    <Icon path={icons.check} />
                    {replySent[selectedMessage.id]
                      ? t('Reply email sent to {email}.', { email: selectedMessage.email })
                      : `${t('Reply sent')} · ${formatDate(selectedMessage.repliedAt, t, language)}`}
                  </p>
                )}
              </article>

              <div className="notification-compose-footer">
                {isComposing ? (
                  <form className="notification-reply-form" onSubmit={(event) => sendReply(event, selectedMessage)}>
                    <label className="notification-reply-label" htmlFor={`reply-${selectedMessage.id}`}>
                      <span>{t('Reply to {name}', { name: selectedMessage.name })}</span>
                      <span className="font-semibold text-[#a3b0bf]">{replyDraft.length}/5000</span>
                    </label>
                    <textarea
                      autoFocus
                      className="notification-reply-input"
                      id={`reply-${selectedMessage.id}`}
                      maxLength={5000}
                      onChange={(event) => setReplyDraft(event.target.value)}
                      placeholder={t('Write your reply…')}
                      required
                      value={replyDraft}
                    />
                    {replyErrors[selectedMessage.id] && (
                      <p className="flex items-start gap-2 rounded-xl bg-red-50 px-3.5 py-2.5 text-sm font-semibold text-red-700" role="alert">
                        <Icon className="mt-0.5 size-4 shrink-0" path={icons.alert} />
                        {replyErrors[selectedMessage.id]}
                      </p>
                    )}
                    <div className="notification-reply-actions">
                      <button
                        className="notification-cancel"
                        disabled={sendingId === selectedMessage.id}
                        onClick={() => { setIsComposing(false); setReplyDraft('') }}
                        type="button"
                      >
                        {t('Cancel')}
                      </button>
                      <button
                        className="notification-send"
                        disabled={sendingId === selectedMessage.id || !replyDraft.trim()}
                        type="submit"
                      >
                        <Icon path={icons.send} />
                        {sendingId === selectedMessage.id ? t('Sending…') : t('Send email reply')}
                      </button>
                    </div>
                  </form>
                ) : (
                  <button
                    className="notification-reply-prompt"
                    onClick={() => {
                      setIsComposing(true)
                      setReplyDraft('')
                      setReplyErrors((current) => ({ ...current, [selectedMessage.id]: '' }))
                    }}
                    type="button"
                  >
                    <Icon className="size-[18px] text-[#123b68]" path={icons.reply} />
                    {t('Reply to {name}', { name: selectedMessage.name })}…
                  </button>
                )}
              </div>
            </>
          ) : (
            <div className="notification-reading-empty">
              <div>
                <span className="notification-empty-mark">
                  <Icon className="size-7" path={icons.mail} />
                </span>
                <p className="notification-empty-title">{t('Select a message')}</p>
                <p className="notification-empty-copy">
                  {counts.unread
                    ? t('You have {count} unread messages.', { count: counts.unread })
                    : t('You’re all caught up.')}
                </p>
              </div>
            </div>
          )}
        </div>
      </section>

      {confirm && (
        <div className="fixed inset-0 z-50 grid place-items-center px-5" role="presentation">
          <button aria-label={t('Cancel')} className="admin-drawer-backdrop absolute inset-0 bg-[#0b1e36]/45" onClick={() => setConfirm(null)} tabIndex={-1} type="button" />
          <section aria-labelledby="notification-confirm-title" aria-modal="true" className="admin-modal-panel relative w-full max-w-md rounded-[22px] border border-[#e7ebef] bg-white p-6" role="dialog">
            <span className="grid size-12 place-items-center rounded-2xl bg-red-50 text-red-600"><Icon className="size-6" path={icons.trash} /></span>
            <h2 className="mt-4 font-display text-xl font-extrabold text-[#092a53]" id="notification-confirm-title">
              {confirm.type === 'clear' ? t('Clear all') : t('Delete')}
            </h2>
            <p className="mt-2 text-sm leading-6 text-[#65748a]">
              {confirm.type === 'clear'
                ? t('Clear all {count} contact notifications? This cannot be undone.', { count: messages.length })
                : t('Delete notification from {name}? This cannot be undone.', { name: confirm.message.name })}
            </p>
            <div className="mt-6 flex justify-end gap-2.5">
              <button className="min-h-10 rounded-xl px-4 text-sm font-bold text-[#65748a] transition hover:bg-[#f4f6f8]" onClick={() => setConfirm(null)} type="button">{t('Cancel')}</button>
              <button
                className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-red-600 px-4 text-sm font-bold text-white transition hover:bg-red-700 disabled:cursor-wait disabled:opacity-60"
                disabled={isClearingAll || deletingId !== null}
                onClick={() => (confirm.type === 'clear' ? clearAllMessages() : deleteMessage(confirm.message))}
                type="button"
              >
                <Icon path={icons.trash} />
                {isClearingAll ? t('Clearing notifications…') : deletingId !== null ? t('Deleting…') : confirm.type === 'clear' ? t('Clear all') : t('Delete')}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  )
}
