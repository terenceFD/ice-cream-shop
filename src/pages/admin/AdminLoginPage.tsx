import { useEffect, useState, type FormEvent, type KeyboardEvent } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAdminAuth } from "./useAdminAuth";
import { PasswordField } from "../../components/PasswordField";
import { useLanguage } from "../../language/useLanguage";
import { IDLE_SIGN_OUT_KEY } from "../../components/admin/AdminIdleGuard";

const icons = {
  mail: "M4 6h16v12H4V6Zm0 0 8 7 8-7",
  arrow: "M5 12h14m-5-5 5 5-5 5",
  back: "M19 12H5m5-5-5 5 5 5",
  shield: "M12 3 5 6v5c0 4.5 3 8.3 7 10 4-1.7 7-5.5 7-10V6l-7-3Zm-3 9 2 2 4-4",
  receipt: "M6 3h12v18l-3-2-3 2-3-2-3 2V3Zm3 5h6m-6 4h6m-6 4h3",
  store: "M4 10h16l-1.5-5h-13L4 10Zm0 0v10h16V10M9 20v-5h6v5",
  chart: "M4 19V5m0 14h16M8 15v-3m4 3V8m4 7v-5",
  alert: "M12 8v5m0 3.5v.01M10.3 3.9 2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z",
  lock: "M6 11h12v9H6v-9Zm2 0V8a4 4 0 0 1 8 0v3",
  check: "m5 12.5 4.5 4.5L19 7.5",
};

function Icon({ path, className = "size-4" }: { path: string; className?: string }) {
  return (
    <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 24 24">
      <path d={path} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
    </svg>
  );
}

export function AdminLoginPage() {
  const { isAdmin, login } = useAdminAuth();
  const { t, language, setLanguage } = useLanguage();
  const location = useLocation();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [errorKey, setErrorKey] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [capsLockOn, setCapsLockOn] = useState(false);
  const [wasSignedOutIdle] = useState(() => {
    try {
      return sessionStorage.getItem(IDLE_SIGN_OUT_KEY) === "1";
    } catch {
      return false;
    }
  });
  const signedOutForInactivity = wasSignedOutIdle && !error;

  useEffect(() => {
    try {
      sessionStorage.removeItem(IDLE_SIGN_OUT_KEY);
    } catch {
      // Storage unavailable; nothing to clear.
    }
  }, []);

  // Admins start on the store overview (today's orders and what needs attention).
  if (isAdmin) {
    return <Navigate to="/admin/overview" replace />;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);
    try {
      await login(email, password);
      const from = location.state?.from;
      const destination = from?.pathname ? `${from.pathname}${from.search || ""}${from.hash || ""}` : "/admin/overview";
      navigate(destination, { replace: true });
    } catch (loginError) {
      setError(t(loginError instanceof Error ? loginError.message : "Unable to sign in."));
      setErrorKey((key) => key + 1);
    } finally {
      setIsSubmitting(false);
    }
  }

  function trackCapsLock(event: KeyboardEvent<HTMLInputElement>) {
    setCapsLockOn(event.getModifierState?.("CapsLock") ?? false);
  }

  const highlights = [
    { icon: icons.receipt, title: t("Live order queue"), body: t("Follow every order from payment to delivery.") },
    { icon: icons.store, title: t("Store-level access"), body: t("Each store admin only sees their own branch.") },
    { icon: icons.chart, title: t("Sales and reports"), body: t("Revenue, best sellers and stock at a glance.") },
  ];

  return (
    <div className="min-h-screen bg-[#f3f6fa] text-[#102c50] lg:grid lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
      {/* Brand panel */}
      <aside className="relative isolate hidden overflow-hidden bg-[#092a53] text-white lg:flex lg:flex-col lg:justify-between lg:p-12 xl:p-16">
        <img decoding="async" loading="lazy" alt="" className="absolute inset-0 -z-30 size-full object-cover opacity-25" src="/images/hero-ice-cream.jpg" />
        <div aria-hidden="true" className="absolute inset-0 -z-20 bg-gradient-to-br from-[#061d3c] via-[#092a53]/95 to-[#123e6c]/90" />
        <div aria-hidden="true" className="absolute -right-32 -top-32 -z-10 size-[28rem] rounded-full border-[70px] border-white/[0.04]" />
        <div aria-hidden="true" className="absolute -bottom-40 left-10 -z-10 size-96 rounded-full bg-[#ffdc32]/10 blur-3xl" />
        <div aria-hidden="true" className="absolute inset-0 -z-10 opacity-[0.05] [background-image:radial-gradient(#fff_1px,transparent_1px)] [background-size:22px_22px]" />

        <Link aria-label={t("Return to the shop")} className="group inline-flex w-fit items-center gap-3" to="/">
          <img decoding="async" loading="eager" alt="" aria-hidden="true" className="size-12 rounded-full shadow-[0_10px_24px_rgba(0,0,0,0.3)] transition group-hover:rotate-[-6deg]" height={48} src="/logo.png" width={48} />
          <span>
            <span className="block font-display text-lg font-extrabold leading-tight">Cold Stone <span className="text-[#ffdc32]">Creamery</span></span>
            <span className="block text-[10px] font-extrabold uppercase tracking-[0.2em] text-white/55">{t("Admin portal")}</span>
          </span>
        </Link>

        <div className="max-w-lg">
          <p className="flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-[0.2em] text-[#ffdc32] before:h-px before:w-8 before:bg-[#ffdc32]/70">
            {t("Staff only")}
          </p>
          <h2 className="mt-4 font-display text-4xl font-extrabold leading-[1.08] xl:text-[3.2rem]">
            {t("Every scoop, order and store —")} <span className="text-[#ffdc32]">{t("in one place.")}</span>
          </h2>
          <ul className="mt-9 space-y-4">
            {highlights.map((item) => (
              <li className="flex items-start gap-4" key={item.title}>
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white/[0.08] text-[#ffdc32] ring-1 ring-white/10">
                  <Icon path={item.icon} />
                </span>
                <span>
                  <span className="block text-sm font-bold">{item.title}</span>
                  <span className="block text-sm leading-6 text-white/60">{item.body}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        {/* Dashboard preview */}
        <div aria-hidden="true" className="relative max-w-md">
          <div className="rounded-2xl bg-white/[0.07] p-4 ring-1 ring-white/10 backdrop-blur-sm">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-white/50">{t("Kitchen pipeline")}</span>
              <span className="flex items-center gap-1.5 text-[10px] font-bold text-[#7ee2a8]">
                <span className="size-1.5 rounded-full bg-[#35d07f]" />
                {t("Live")}
              </span>
            </div>
            <div className="mt-3 grid grid-cols-4 gap-2">
              {[["Accepted", 3], ["Being prepared", 5], ["Ready", 2], ["Out for delivery", 4]].map(([label, value]) => (
                <div className="rounded-xl bg-white/[0.06] px-2.5 py-2" key={label}>
                  <p className="truncate text-[9px] font-bold text-white/45">{t(String(label))}</p>
                  <p className="font-display text-lg font-extrabold">{value}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="absolute -right-6 -top-8 flex items-center gap-2.5 rounded-xl bg-white px-3 py-2 text-[#092a53] shadow-[0_14px_30px_rgba(0,0,0,0.25)]">
            <span className="grid size-7 place-items-center rounded-lg bg-[#eaf6ee] text-[#2c7a4f]"><Icon className="size-3.5" path={icons.check} /></span>
            <span>
              <span className="block text-[11px] font-extrabold">{t("Order #{id}", { id: 128 })}</span>
              <span className="block text-[10px] text-[#65748a]">{t("Delivered")}</span>
            </span>
          </div>
        </div>
      </aside>

      {/* Sign-in panel */}
      <main className="flex min-h-screen flex-col px-5 py-6 sm:px-10 lg:px-12 xl:px-20">
        <div className="flex items-center justify-between gap-4">
          <Link className="inline-flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-bold text-[#4f6379] transition hover:bg-white hover:text-[#092a53]" to="/">
            <Icon path={icons.back} />
            {t("Return to the shop")}
          </Link>
          <div aria-label={t("Select language")} className="inline-flex items-center rounded-full bg-white p-1 shadow-sm ring-1 ring-[#e3e9f0]" role="group">
            {(["en", "fr"] as const).map((option) => (
              <button
                aria-pressed={language === option}
                className={`min-h-7 min-w-9 rounded-full px-2 text-[10px] font-extrabold tracking-wide transition ${language === option ? "bg-[#092a53] text-white" : "text-[#7b8a9c] hover:text-[#092a53]"}`}
                key={option}
                onClick={() => setLanguage(option)}
                type="button"
              >
                {option.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-[26rem]">
            <img decoding="async" loading="eager" alt="" aria-hidden="true" className="size-16 rounded-full shadow-[0_12px_28px_rgba(9,42,83,0.25)]" height={64} src="/logo.png" width={64} />
            <h1 className="mt-6 font-display text-3xl font-extrabold tracking-tight text-[#092a53] sm:text-[2.25rem]">{t("Welcome back")}</h1>
            <p className="mt-2 text-sm leading-6 text-[#65748a]">{t("Sign in to the admin portal to manage your store.")}</p>

            {signedOutForInactivity && (
              <p className="mt-6 flex items-start gap-2.5 rounded-2xl bg-[#fff6e5] px-4 py-3 text-sm font-semibold leading-5 text-[#8a5a00] ring-1 ring-[#f3e2b8]" role="status">
                <Icon className="mt-0.5 size-4 shrink-0" path={icons.lock} />
                {t("You were signed out after 30 minutes of inactivity to keep the dashboard secure. Sign in again to continue.")}
              </p>
            )}

            <form className="mt-8 space-y-5" noValidate={false} onSubmit={handleSubmit}>
              <label className="block">
                <span className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-[#52647b]">{t("Admin email")}</span>
                <span className="group relative mt-2 flex items-center rounded-2xl bg-white ring-1 ring-[#e3e1d8] transition hover:ring-[#d6cfbd] focus-within:ring-2 focus-within:ring-[#c9b24a]">
                  <Icon className="pointer-events-none absolute left-4 size-[18px] text-[#65748a] transition group-focus-within:text-[#092a53]" path={icons.mail} />
                  <input
                    autoComplete="username"
                    autoFocus
                    className="w-full rounded-2xl bg-transparent py-3.5 pl-12 pr-4 text-sm font-semibold text-[#092a53] outline-none! placeholder:font-normal placeholder:text-[#a5aebb]"
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="you@coldstone.cm"
                    required
                    type="email"
                    value={email}
                  />
                </span>
              </label>

              <PasswordField
                autoComplete="current-password"
                label={t("Password")}
                name="password"
                onChange={(event) => setPassword(event.target.value)}
                onKeyDown={trackCapsLock}
                onKeyUp={trackCapsLock}
                placeholder="••••••••"
                required
                value={password}
                variant="modern"
              >
                {capsLockOn && (
                  <span className="mt-2 flex items-center gap-1.5 text-xs font-bold text-[#9a6200]">
                    <Icon className="size-3.5" path={icons.alert} />
                    {t("Caps Lock is on")}
                  </span>
                )}
              </PasswordField>

              {error && (
                <p className="admin-login-shake flex items-start gap-2.5 rounded-2xl bg-red-50 px-4 py-3 text-sm font-semibold leading-5 text-red-700 ring-1 ring-red-100" key={errorKey} role="alert">
                  <Icon className="mt-0.5 size-4 shrink-0" path={icons.alert} />
                  {error}
                </p>
              )}

              <button
                className="group inline-flex min-h-[3.25rem] w-full items-center justify-center gap-2 rounded-2xl bg-[#092a53] px-6 text-sm font-extrabold text-white shadow-[0_12px_28px_rgba(9,42,83,0.25)] transition hover:-translate-y-0.5 hover:bg-[#163e6b] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#bd9c00] disabled:translate-y-0 disabled:cursor-wait disabled:opacity-70"
                disabled={isSubmitting}
                type="submit"
              >
                {isSubmitting ? (
                  <>
                    <span aria-hidden="true" className="size-4 animate-spin rounded-full border-2 border-white border-r-transparent" />
                    {t("Signing in…")}
                  </>
                ) : (
                  <>
                    {t("Sign in to dashboard")}
                    <Icon className="size-4 transition group-hover:translate-x-0.5" path={icons.arrow} />
                  </>
                )}
              </button>
            </form>

            <div className="mt-8 flex items-start gap-3 rounded-2xl bg-white p-4 text-xs leading-5 text-[#65748a] ring-1 ring-[#e7ecf2]">
              <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-[#eaf6ee] text-[#2c7a4f]">
                <Icon path={icons.shield} />
              </span>
              <p>
                <span className="block font-bold text-[#102c50]">{t("Protected area")}</span>
                {t("Admin credentials are created by the store owner using the server’s secure bootstrap process.")}
              </p>
            </div>
          </div>
        </div>

        <p className="flex items-center justify-center gap-1.5 text-center text-[11px] font-semibold text-[#a3b0bf]">
          <Icon className="size-3.5" path={icons.lock} />
          {t("Secure sign-in · Cold Stone Creamery")}
        </p>
      </main>
    </div>
  );
}
