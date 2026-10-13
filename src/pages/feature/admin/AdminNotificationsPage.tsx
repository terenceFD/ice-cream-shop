import { AdminNotifications } from "../../../components/AdminNotifications";
import { useLanguage } from "../../../language/useLanguage";

export function AdminNotificationsPage() {
  const { t } = useLanguage();

  return (
    <div className="space-y-6">
      <header className="relative isolate overflow-hidden rounded-[28px] bg-gradient-to-br from-[#0f2341] via-[#153b68] to-[#1b557d] p-5 text-white shadow-[0_18px_40px_rgba(15,35,65,0.18)] sm:p-7">
        <div aria-hidden="true" className="absolute -right-12 -top-14 size-48 rounded-full border-[30px] border-white/10" />
        <div aria-hidden="true" className="absolute bottom-0 left-0 h-28 w-28 rounded-full bg-[#ffdc32]/10 blur-3xl" />
        <div className="relative flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.15em] text-[#ffdc32]">
              <span aria-hidden="true">✦</span>
              {t("Inbox")}
            </span>
            <h1 className="mt-4 font-display text-3xl font-extrabold tracking-tight sm:text-4xl">
              {t("Notifications")}
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-slate-200">
              {t("Stay on top of customer inquiries and follow up promptly.")}
            </p>
          </div>
        </div>
      </header>

      <AdminNotifications />
    </div>
  );
}
