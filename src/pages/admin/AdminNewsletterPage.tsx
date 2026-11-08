import { useCallback, useEffect, useState, type FormEvent } from "react";
import { apiRequest } from "../../api/api";
import { AdminPageHeader } from "./AdminPageHeader";
import { useAdminAuth } from "./useAdminAuth";
import { useLanguage } from "../../language/useLanguage";

interface Subscriber {
  id: number;
  email: string;
  source: string;
  isSubscribed: number;
  createdAt: string;
}

const inputClassName =
  "mt-1.5 w-full rounded-lg border border-[#dce3eb] bg-white px-3 py-2 text-sm font-medium text-brand-navy outline-none transition placeholder:text-[#9aa5b3] hover:border-[#bac7d5] focus:border-brand-navy focus:ring-2 focus:ring-brand-navy/10";

function sourceLabel(source: string) {
  if (source === "checkout") return "Signed up at checkout";
  if (source === "admin") return "Added by the shop";
  return "Signed up on the site";
}

function formatJoined(value: string, language: string) {
  const date = new Date(value.includes("T") ? value : `${value.replace(" ", "T")}Z`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(language === "fr" ? "fr-CM" : "en-CM", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function AdminNewsletterPage() {
  const { sessionToken } = useAdminAuth();
  const { t, language } = useLanguage();
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [loadError, setLoadError] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState("");
  const [sendError, setSendError] = useState("");

  const load = useCallback(async () => {
    setLoadError("");
    try {
      const result = await apiRequest("/admin/newsletter", { token: sessionToken });
      setSubscribers(Array.isArray(result?.subscribers) ? result.subscribers : []);
    } catch (error) {
      setLoadError(t(error instanceof Error ? error.message : "Could not load the newsletter."));
    }
  }, [sessionToken, t]);

  useEffect(() => {
    let cancelled = false;
    apiRequest("/admin/newsletter", { token: sessionToken })
      .then((result) => {
        if (!cancelled) setSubscribers(Array.isArray(result?.subscribers) ? result.subscribers : []);
      })
      .catch((error) => {
        if (!cancelled) {
          setLoadError(t(error instanceof Error ? error.message : "Could not load the newsletter."));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [sessionToken, t]);

  const active = subscribers.filter((entry) => Number(entry.isSubscribed) === 1);

  async function handleSend(event: FormEvent) {
    event.preventDefault();
    if (sending) return;
    setSending(true);
    setNotice("");
    setSendError("");
    try {
      const result = await apiRequest("/admin/newsletter/broadcast", {
        method: "POST",
        token: sessionToken,
        body: { subject, message },
      });
      const sent = Number(result?.sent || 0);
      const total = Number(result?.total || active.length);
      const failures = Array.isArray(result?.failures) ? result.failures.length : 0;
      setNotice(
        failures
          ? t("Sent to {sent} of {total}. Some batches did not go out.", { sent, total })
          : t("Sent to {sent} of {total}.", { sent, total }),
      );
      setSubject("");
      setMessage("");
    } catch (error) {
      setSendError(t(error instanceof Error ? error.message : "Could not send the newsletter."));
    } finally {
      setSending(false);
      load();
    }
  }

  return (
    <div className="min-w-0 space-y-6">
      <AdminPageHeader
        actions={null}
        description={t("Write the note. Everyone still on the list receives it, and they cannot see each other's addresses. A copy also arrives in the shop mailbox.")}
        section={t("Sales")}
        t={t}
        title={t("Newsletter")}
      />
      {loadError && (
        <p className="rounded-md bg-red-50 p-3 text-sm font-semibold text-red-700" role="alert">
          {loadError}
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-md border border-[#dce3eb] bg-white px-4 py-4">
          <p className="text-xs font-medium text-[#65748a]">{t("Still on the list")}</p>
          <p className="mt-2 text-2xl font-semibold tabular-nums text-[#111]">{active.length}</p>
        </div>
        <div className="rounded-md border border-[#dce3eb] bg-white px-4 py-4">
          <p className="text-xs font-medium text-[#65748a]">{t("Addresses saved")}</p>
          <p className="mt-2 text-2xl font-semibold tabular-nums text-[#111]">{subscribers.length}</p>
        </div>
      </div>

      <form className="grid gap-4 rounded-md border border-[#dce3eb] bg-white p-4 sm:p-5" onSubmit={handleSend}>
        <label className="block text-sm font-medium text-brand-navy">
          {t("Subject")}
          <input
            className={inputClassName}
            maxLength={120}
            onChange={(event) => setSubject(event.target.value)}
            required
            value={subject}
          />
        </label>
        <label className="block text-sm font-medium text-brand-navy">
          {t("Message")}
          <textarea
            className={`${inputClassName} min-h-32`}
            maxLength={2000}
            onChange={(event) => setMessage(event.target.value)}
            required
            value={message}
          />
        </label>
        <div>
          <button
            className="inline-flex min-h-11 items-center justify-center rounded-lg bg-brand-navy px-5 text-sm font-bold text-white transition hover:bg-brand-blue focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-navy focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={sending || active.length === 0}
            type="submit"
          >
            {sending ? t("Sending the newsletter…") : t("Send the newsletter")}
          </button>
        </div>
        {notice && (
          <p className="text-sm font-semibold text-[#1f5d3c]" role="status">
            {notice}
          </p>
        )}
        {sendError && (
          <p className="text-sm font-semibold text-red-700" role="alert">
            {sendError}
          </p>
        )}
        {active.length === 0 && !loadError && (
          <p className="text-sm text-[#65748a]">{t("Nobody is on the list yet.")}</p>
        )}
      </form>

      <div className="overflow-x-auto rounded-md border border-[#dce3eb] bg-white">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="border-b border-[#f4f6f8] text-xs font-medium text-[#65748a]">
            <tr>
              <th className="px-4 py-3 font-medium">{t("Email address")}</th>
              <th className="px-4 py-3 font-medium">{t("Source")}</th>
              <th className="px-4 py-3 font-medium">{t("Status")}</th>
              <th className="px-4 py-3 font-medium">{t("Joined")}</th>
            </tr>
          </thead>
          <tbody>
            {subscribers.length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-[#65748a]" colSpan={4}>
                  {t("Nobody is on the list yet.")}
                </td>
              </tr>
            ) : (
              subscribers.map((entry) => (
                <tr className="border-t border-[#f4f6f8]" key={entry.id}>
                  <td className="px-4 py-3 font-semibold text-brand-navy">{entry.email}</td>
                  <td className="px-4 py-3 text-[#44526a]">{t(sourceLabel(entry.source))}</td>
                  <td className="px-4 py-3">
                    {Number(entry.isSubscribed) === 1 ? t("On the list") : t("Off the list")}
                  </td>
                  <td className="px-4 py-3 text-[#44526a]">{formatJoined(entry.createdAt, language)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
