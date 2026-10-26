export type PaymentStatus = 'checking' | 'success' | 'pending' | 'error' | 'failed' | 'cancelled'

type PaymentStatusDialogProps = {
  status: PaymentStatus
  eyebrow: string
  title: string
  message: string
  checkingMessage: string
  closeLabel: string
  successLabel: string
  retryLabel: string
  onClose: () => void
  onRetry?: () => void
}

export function PaymentStatusDialog({
  status,
  eyebrow,
  title,
  message,
  checkingMessage,
  closeLabel,
  successLabel,
  retryLabel,
  onClose,
  onRetry,
}: PaymentStatusDialogProps) {
  const isChecking = status === 'checking'
  const isSuccess = status === 'success'
  const isPending = status === 'pending'
  const isError = status === 'error' || status === 'failed'

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#472a3b]/65 p-4 backdrop-blur-sm">
      <section
        aria-busy={isChecking || isPending}
        aria-describedby="payment-status-message"
        aria-labelledby="payment-status-title"
        aria-modal="true"
        className="relative w-full max-w-md overflow-hidden rounded-[28px] bg-white shadow-[0_32px_90px_rgba(3,20,42,0.35)] ring-1 ring-white/70"
        role="dialog"
      >
        <div className="h-1.5 bg-gradient-to-r from-[#ffb84d] via-[#f7ba32] to-[#472a3b]" />
        <div className="px-7 pb-7 pt-8 sm:px-9 sm:pb-9">
          <div className="mt-1 flex items-start gap-4">
            <div
              aria-hidden="true"
              className={`grid size-12 shrink-0 place-items-center rounded-full ring-8 ${
                isSuccess
                  ? 'bg-emerald-50 text-emerald-600 ring-emerald-50/70'
                  : isChecking || isPending
                    ? 'bg-blue-50 text-[#315982] ring-blue-50/70'
                    : isError
                      ? 'bg-red-50 text-red-600 ring-red-50/70'
                      : 'bg-amber-50 text-amber-600 ring-amber-50/70'
              }`}
            >
              {isSuccess ? (
                <svg className="size-7" fill="none" viewBox="0 0 24 24">
                  <path d="m5 12.5 4.5 4.5L19 7.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" />
                </svg>
              ) : isChecking || isPending ? (
                <svg className="size-6 animate-spin motion-reduce:animate-none" fill="none" viewBox="0 0 24 24">
                  <path d="M4 12a8 8 0 0 1 13.7-5.7L20 8.5M20 4v4.5h-4.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                </svg>
              ) : (
                <svg className="size-6" fill="none" viewBox="0 0 24 24">
                  <path d="M12 8v5m0 3h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                </svg>
              )}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-[#b8721e]">{eyebrow}</p>
              <h2 className="mt-1 font-display text-2xl font-extrabold tracking-tight text-[#472a3b]" id="payment-status-title">
                {title}
              </h2>
              <p className="mt-2 text-sm leading-6 text-[#65748a]" id="payment-status-message" role="status">
                {message}
              </p>
            </div>
          </div>
          {isChecking ? (
            <p className="mt-6 text-xs font-semibold text-[#65748a]">{checkingMessage}</p>
          ) : (
            <div className="mt-7 flex flex-col-reverse justify-center gap-3 sm:flex-row">
              {isPending && onRetry && (
                <button
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-[#472a3b] px-5 text-sm font-extrabold text-white transition hover:bg-[#123d70] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#472a3b] focus-visible:ring-offset-2"
                  onClick={onRetry}
                  type="button"
                >
                  <svg aria-hidden="true" className="size-4" fill="none" viewBox="0 0 24 24">
                    <path d="M4 12a8 8 0 0 1 13.7-5.7L20 8.5M20 4v4.5h-4.5M20 12a8 8 0 0 1-13.7 5.7L4 15.5M4 20v-4.5h4.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                  </svg>
                  {retryLabel}
                </button>
              )}
              <button
                className="inline-flex min-h-11 items-center justify-center rounded-full bg-[#ffb84d] px-6 text-sm font-extrabold text-[#472a3b] transition hover:bg-[#ffcf85] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b8721e] focus-visible:ring-offset-2"
                onClick={onClose}
                type="button"
              >
                {isSuccess ? successLabel : closeLabel}
              </button>
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
