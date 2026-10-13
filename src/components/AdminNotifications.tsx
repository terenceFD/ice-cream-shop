import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { apiRequest } from '../api/api'
import { useAdminAuth } from '../pages/feature/admin/useAdminAuth'
import { useLanguage } from '../language/useLanguage'

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

function formatDate(value: string | null | undefined, t: (key: string) => string) {
  if (typeof value !== 'string' || !value.trim()) return t('Date unavailable')
  const normalizedValue = value.includes('T') ? value : value.replace(' ', 'T')
  const hasTimezone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(normalizedValue)
  const date = new Date(hasTimezone ? normalizedValue : `${normalizedValue}Z`)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString()
}

export function AdminNotifications() {
  const { sessionToken } = useAdminAuth()
  const { t } = useLanguage()
  const [messages, setMessages] = useState<ContactMessage[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [replyingTo, setReplyingTo] = useState<number | null>(null)
  const [replyDraft, setReplyDraft] = useState('')
  const [sendingId, setSendingId] = useState<number | null>(null)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [isClearingAll, setIsClearingAll] = useState(false)
  const [replyErrors, setReplyErrors] = useState<Record<number, string>>({})
  const [replySent, setReplySent] = useState<Record<number, boolean>>({})

  const refresh = useCallback(async () => {
    setError('')
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
      setError(loadError.message)
    } finally {
      setIsLoading(false)
    }
  }, [sessionToken, t])

  useEffect(() => {
    refresh()
  }, [refresh])

  async function markRead(id: number) {
    setError('')
    try {
      await apiRequest(`/admin/notifications/${id}/read`, { method: 'PATCH', token: sessionToken })
      setMessages((currentMessages) => currentMessages.map((message) =>
        message.id === id ? { ...message, isRead: true } : message
      ))
      setUnreadCount((count) => Math.max(0, count - 1))
    } catch (updateError) {
      setError(updateError.message)
    }
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
      setReplyingTo(null)
      setReplySent((current) => ({ ...current, [message.id]: true }))
    } catch (sendError) {
      setReplyErrors((current) => ({ ...current, [message.id]: sendError.message }))
    } finally {
      setSendingId(null)
    }
  }

  async function deleteMessage(message: ContactMessage) {
    if (!window.confirm(t('Delete notification from {name}? This cannot be undone.', { name: message.name }))) {
      return
    }

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
      if (replyingTo === message.id) {
        setReplyingTo(null)
        setReplyDraft('')
      }
    } catch (deleteError) {
      setError(t(deleteError.message))
    } finally {
      setDeletingId(null)
    }
  }

  async function clearAllMessages() {
    if (!window.confirm(t('Clear all {count} contact notifications? This cannot be undone.', { count: messages.length }))) {
      return
    }

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
      setReplyingTo(null)
      setReplyDraft('')
    } catch (clearError) {
      setError(t(clearError.message))
    } finally {
      setIsClearingAll(false)
    }
  }

  return (
    <section className="mb-8 scroll-mt-6 rounded-[28px] border border-[#e5ebf4] bg-white p-5 shadow-[0_18px_40px_rgba(15,35,65,0.05)] sm:p-7" id="notifications">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-[#edf5ff] px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#1f5fa9]">
            <span aria-hidden="true">✦</span>
            {t('Inbox')}
          </div>
          <h2 className="font-display text-2xl font-bold text-[#102c50]">
            {t('Contact notifications')}
            {unreadCount > 0 ? ` (${unreadCount} ${t('New').toLowerCase()})` : ''}
          </h2>
          <p className="mt-1 text-sm text-[#65748a]">{t('Messages submitted through the website contact form.')}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {messages.length > 3 && (
            <button
              className="rounded-full border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-bold text-red-700 transition hover:bg-red-100 disabled:cursor-wait disabled:opacity-60"
              disabled={isLoading || isClearingAll || deletingId !== null}
              onClick={clearAllMessages}
              type="button"
            >
              {isClearingAll ? t('Clearing notifications…') : t('Clear all')}
            </button>
          )}
          <button className="rounded-full border border-[#d7e0eb] bg-[#f7f9fb] px-4 py-2.5 text-sm font-bold text-[#123253] transition hover:border-[#c6d5e8] hover:bg-white disabled:opacity-60" disabled={isLoading || isClearingAll} onClick={refresh} type="button">
            {t('Refresh')}
          </button>
        </div>
      </div>

      {error && <p className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">{error}</p>}
      {isLoading ? (
        <div className="mt-6 space-y-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="h-32 animate-pulse rounded-2xl bg-[#edf2f9]" />
          ))}
        </div>
      ) : messages.length === 0 ? (
        <div className="mt-5 rounded-[24px] border border-dashed border-[#dfe6f1] bg-[#f9fbff] px-4 py-8 text-center text-sm text-[#65748a]">
          {t('No contact messages yet.')}
        </div>
      ) : (
        <div className="mt-5 space-y-4">
          {messages.map((message) => (
            <article className={`rounded-[24px] border p-4 shadow-sm sm:p-5 ${message.isRead ? 'border-[#e5ebf4] bg-white' : 'border-[#eadb8a] bg-[#fffdf5]'}`} key={message.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-display text-xl font-bold text-[#102c50]">{message.subject}</h3>
                    {!message.isRead && <span className="rounded-full bg-[#ffdc32] px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.12em] text-[#1a2f4b]">{t('New')}</span>}
                  </div>
                  <p className="mt-1 text-xs font-medium uppercase tracking-[0.08em] text-[#65748a]">{formatDate(message.createdAt, t)}</p>
                  {message.storeName && <p className="mt-1 text-xs font-semibold text-[#365775]">{t('Assigned store: {store}', { store: t(message.storeName) })}</p>}
                </div>
                {!message.isRead && (
                  <button className="shrink-0 rounded-full border border-[#d8deea] bg-white px-3 py-1.5 text-xs font-bold text-[#123253] transition hover:border-[#b9c9df] hover:bg-[#f7f9fb]" onClick={() => markRead(message.id)} type="button">
                    {t('Mark as read')}
                  </button>
                )}
              </div>

              <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-[#52657d]">{message.message}</p>

              <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 border-t border-[#edf1f6] pt-3 text-xs text-[#65748a]">
                <span className="font-bold text-[#102c50]">{message.name}</span>
                <a className="text-[#205091] underline-offset-2 hover:underline" href={`mailto:${message.email}`}>{message.email}</a>
                {message.phone && <a className="text-[#205091] underline-offset-2 hover:underline" href={`tel:${message.phone}`}>{message.phone}</a>}
              </div>

              <div className="mt-5">
                {replyingTo === message.id ? (
                  <form className="space-y-3" onSubmit={(event) => sendReply(event, message)}>
                    <label className="block text-sm font-semibold text-[#42546d]" htmlFor={`reply-${message.id}`}>
                      {t('Reply to {name}', { name: message.name })}
                    </label>
                    <textarea
                      autoFocus
                      className="min-h-28 w-full resize-y rounded-2xl border border-[#d9dfe9] bg-white px-4 py-3 text-sm text-[#102c50] outline-none transition focus:border-[#0d4d8b] focus:ring-2 focus:ring-[#dceafc]"
                      id={`reply-${message.id}`}
                      maxLength={5000}
                      onChange={(event) => setReplyDraft(event.target.value)}
                      required
                      value={replyDraft}
                    />
                    {replyErrors[message.id] && <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">{replyErrors[message.id]}</p>}
                    <div className="flex flex-wrap gap-2">
                      <button className="rounded-full bg-[#0f2341] px-4 py-2 text-sm font-bold text-white transition hover:bg-[#173763] disabled:cursor-wait disabled:opacity-60" disabled={sendingId === message.id || !replyDraft.trim()} type="submit">
                        {sendingId === message.id ? t('Sending…') : t('Send email reply')}
                      </button>
                      <button className="rounded-full border border-[#d9dfe9] bg-white px-4 py-2 text-sm font-bold text-[#123253] transition hover:bg-[#f6f9fc] disabled:opacity-60" disabled={sendingId === message.id} onClick={() => { setReplyingTo(null); setReplyDraft('') }} type="button">
                        {t('Cancel')}
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="flex flex-wrap items-center gap-3">
                    <button className="rounded-full bg-[#f2f7ff] px-4 py-2 text-sm font-bold text-[#143b69] transition hover:bg-[#e4efff]" onClick={() => { setReplyingTo(message.id); setReplyDraft(''); setReplySent((current) => ({ ...current, [message.id]: false })) }} type="button">
                      {t('Reply')}
                    </button>
                    {replySent[message.id] && <p className="text-sm font-semibold text-[#163e35]" role="status">{t('Reply email sent to {email}.', { email: message.email })}</p>}
                    {message.repliedAt && <p className="text-sm font-semibold text-[#163e35]">{t('Reply sent')}</p>}
                    <button
                      className="rounded-full border border-red-200 bg-red-50 px-4 py-2 text-sm font-bold text-red-700 transition hover:bg-red-100 disabled:cursor-wait disabled:opacity-60"
                      disabled={deletingId === message.id || isClearingAll}
                      onClick={() => deleteMessage(message)}
                      type="button"
                    >
                      {deletingId === message.id ? t('Deleting…') : t('Delete')}
                    </button>
                  </div>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}
