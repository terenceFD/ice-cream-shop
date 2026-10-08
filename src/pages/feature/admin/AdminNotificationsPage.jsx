import { AdminNotifications } from "../../../components/AdminNotifications";
import { useLanguage } from "../../../LanguageContext";

export function AdminNotificationsPage() {
  const { t } = useLanguage();
  return (
    <div>
      <p className="mb-2 inline-block rounded-full bg-[#ffeb9c] px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.12em]">
        {t("Inbox")}
      </p>
      <h1 className="mb-6 font-display text-3xl font-bold tracking-tight sm:text-4xl">
        {t("Notifications")}
      </h1>
      <AdminNotifications />
    </div>
  );
}
