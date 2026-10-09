import { useCallback, useEffect, useState } from 'react'
import { apiRequest } from '../api/api'
import { useAdminAuth } from '../pages/feature/admin/AdminAuthContext'
import { useLanguage } from '../language/LanguageContext'

function formatDate(value) {
  const date = new Date(`${value.replace(' ', 'T')}Z`)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString()
}

export function AdminNotifications() {
  const { sessionToken } = useAdminAuth()
  const { t } = useLanguage()
  const [messages, setMessages] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [replyingTo, setReplyingTo] = useState(null)
  const [replyDraft, setReplyDraft] = useState('')
  const [sendingId, setSendingId] = useState(null)
  const [deletingId, setDeletingId] = useState(null)
  const [replyErrors, setReplyErrors] = useState({})
  const [replySent, setReplySent] = useState({})

  const refresh = useCallback(async () => {
    setError('')
    try {
      const result = await apiRequest('/admin/notifications', { token: sessionToken })
      setMessages(result.messages)
      setUnreadCount(result.unreadCount)
    } catch (loadError) {
      setError(loadError.message)
    } finally {
      setIsLoading(false)
    }
  }, [sessionToken])

  useEffect(() => {
    refresh()
  }, [refresh])

  async function markRead(id) {
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

  async function sendReply(event, message) {
    event.preventDefault()
    setReplyErrors((current) => ({ ...current, [message.id]: '' }))
    setSendingId(message.id)
    try {
      const result = await apiRequest(`/admin/notifications/${message.id}/reply`, {
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

  async function deleteRepliedMessage(message) {
    if (!window.confirm(t('Delete replied notification from {name}? This cannot be undone.', { name: message.name }))) {
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
    } catch (deleteError) {
      setError(t(deleteError.message))
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <section className="mb-8 scroll-mt-6 rounded-[24px] border border-[#d9d6cc] bg-white p-5 shadow-[0_8px_30px_rgba(18,44,80,0.05)] sm:p-7" id="notifications">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="mb-2 inline-block rounded-full bg-[#ffeb9c] px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.12em]">{t('Inbox')}</p>
          <h2 className="font-display text-2xl font-bold">{t('Contact notifications')}{unreadCount > 0 ? ` (${unreadCount} ${t('New').toLowerCase()})` : ''}</h2>
          <p className="mt-1 text-sm text-[#65748a]">{t('Messages submitted through the website contact form.')}</p>
        </div>
        <button className="rounded-full border-2 border-[#65748a] px-4 py-2 text-sm font-bold transition hover:bg-[#f4f1e7] disabled:opacity-60" disabled={isLoading} onClick={refresh} type="button">
          {t('Refresh')}
        </button>
      </div>

      {error && <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">{error}</p>}
      {isLoading ? (
        <p className="mt-5 text-sm text-[#65748a]" role="status">{t('Loading contact messages…')}</p>
      ) : messages.length === 0 ? (
        <p className="mt-5 rounded-xl bg-[#f8f6f0] px-4 py-5 text-sm text-[#65748a]">{t('No contact messages yet.')}</p>
      ) : (
        <div className="mt-5 space-y-3">
          {messages.map((message) => (
            <article className={`rounded-2xl border p-4 sm:p-5 ${message.isRead ? 'border-[#d9d6cc] bg-white' : 'border-[#eadb8a] bg-[#fffdf1]'}`} key={message.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-display text-lg font-bold">{message.subject}</h3>
                    {!message.isRead && <span className="rounded-full bg-[#ffdc32] px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide">{t('New')}</span>}
                  </div>
                  <p className="mt-1 text-xs text-[#65748a]">{formatDate(message.createdAt)}</p>
                </div>
                {!message.isRead && (
                  <button className="shrink-0 rounded-full border border-[#d9d6cc] px-3 py-1.5 text-xs font-bold transition hover:bg-white" onClick={() => markRead(message.id)} type="button">
                    {t('Mark as read')}
                  </button>
                )}
              </div>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-[#65748a]">{message.message}</p>
              <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 border-t border-[#d9d6cc] pt-3 text-xs text-[#65748a]">
                <span className="font-semibold text-[#102c50]">{message.name}</span>
                <a className="underline underline-offset-2 hover:text-[#102c50]" href={`mailto:${message.email}`}>{message.email}</a>
                {message.phone && <a className="underline underline-offset-2 hover:text-[#102c50]" href={`tel:${message.phone}`}>{message.phone}</a>}
              </div>
              <div className="mt-4">
                {replyingTo === message.id ? (
                  <form className="space-y-3" onSubmit={(event) => sendReply(event, message)}>
                    <label className="block text-sm font-semibold text-[#65748a]" htmlFor={`reply-${message.id}`}>
                      {t('Reply to {name}', { name: message.name })}
                    </label>
                    <textarea
                      autoFocus
                      className="min-h-28 w-full resize-y rounded-xl border border-[#d9d6cc] bg-white px-4 py-3 text-sm font-normal text-[#102c50] outline-none transition focus:border-[#bd9c00] focus:ring-2 focus:ring-[#ffdc32]/40"
                      id={`reply-${message.id}`}
                      maxLength={5000}
                      onChange={(event) => setReplyDraft(event.target.value)}
                      required
                      value={replyDraft}
                    />
                    {replyErrors[message.id] && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">{replyErrors[message.id]}</p>}
                    <div className="flex flex-wrap gap-2">
                      <button className="rounded-full bg-[#ffdc32] px-4 py-2 text-sm font-bold transition hover:bg-[#ffe76c] disabled:cursor-wait disabled:opacity-60" disabled={sendingId === message.id || !replyDraft.trim()} type="submit">
                        {sendingId === message.id ? t('Sending…') : t('Send email reply')}
                      </button>
                      <button className="rounded-full border border-[#d9d6cc] px-4 py-2 text-sm font-bold transition hover:bg-white disabled:opacity-60" disabled={sendingId === message.id} onClick={() => { setReplyingTo(null); setReplyDraft('') }} type="button">
                        {t('Cancel')}
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="flex flex-wrap items-center gap-3">
                    <button className="rounded-full border border-[#65748a] px-4 py-2 text-sm font-bold transition hover:bg-[#f4f1e7]" onClick={() => { setReplyingTo(message.id); setReplyDraft(''); setReplySent((current) => ({ ...current, [message.id]: false })) }} type="button">
                      {t('Reply')}
                    </button>
                    {replySent[message.id] && <p className="text-sm font-semibold text-[#163e35]" role="status">{t('Reply email sent to {email}.', { email: message.email })}</p>}
                    {message.repliedAt && (
                      <>
                        <p className="text-sm font-semibold text-[#163e35]">{t('Reply sent')}</p>
                        <button
                          className="rounded-full border border-red-300 px-4 py-2 text-sm font-bold text-red-700 transition hover:bg-red-50 disabled:cursor-wait disabled:opacity-60"
                          disabled={deletingId === message.id}
                          onClick={() => deleteRepliedMessage(message)}
                          type="button"
                        >
                          {deletingId === message.id ? t('Deleting…') : t('Delete notification')}
                        </button>
                      </>
                    )}
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
