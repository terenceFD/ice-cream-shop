import { useState, type FormEvent } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { Header } from "../../../components/Layout";
import { useAdminAuth } from "./useAdminAuth";
import { PasswordField } from "../../../components/PasswordField";
import { useLanguage } from "../../../language/useLanguage";

export function AdminLoginPage() {
  const { isAdmin, login } = useAdminAuth();
  const { t } = useLanguage();
  const location = useLocation();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (isAdmin) {
    return <Navigate to="/admin" replace />;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);
    try {
      await login(email, password);
      const destination = location.state?.from?.pathname || "/admin";
      navigate(destination, { replace: true });
    } catch (loginError) {
      setError(t(loginError.message));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#f8f7f2] text-[#102c50]">
      <Header />
      <main className="flex flex-1 items-center justify-center px-4 py-8 sm:px-7 sm:py-12">
        <section className="grid w-full max-w-[1040px] overflow-hidden rounded-[30px] border border-[#e7e3d9] bg-white shadow-[0_24px_70px_rgba(18,44,80,0.12)] lg:min-h-[570px] lg:grid-cols-[0.95fr_1.05fr]">
          <div className="relative isolate hidden flex-col justify-between overflow-hidden bg-[#092a53] p-10 text-white lg:flex xl:p-12">
            <img alt="" className="absolute inset-0 -z-20 size-full object-cover opacity-30" src="/images/hero-ice-cream.jpg" />
            <div aria-hidden="true" className="absolute inset-0 -z-10 bg-gradient-to-br from-[#061d3c]/95 via-[#092a53]/85 to-[#15416d]/75" />
            <div aria-hidden="true" className="absolute -bottom-32 -right-20 -z-10 size-80 rounded-full border-[52px] border-white/[0.06]" />
            <Link aria-label={t("Return to the shop")} className="inline-flex w-fit items-center gap-3" to="/">
              <span aria-hidden="true" className="grid size-12 place-items-center rounded-2xl border border-white/15 bg-white/10 text-2xl">✦</span>
              <span className="text-xs font-extrabold uppercase tracking-[0.16em] text-white/80">{t("Admin portal")}</span>
            </Link>
            <div>
              <p className="inline-flex rounded-full border border-white/20 bg-white/10 px-3.5 py-2 text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#ffdc32]">{t("Admin portal")}</p>
              <h2 className="mt-5 max-w-md font-display text-4xl font-extrabold leading-tight xl:text-5xl">{t("Admin sign in")}</h2>
              <p className="mt-4 max-w-sm text-sm leading-7 text-white/75">{t("Sign in to open the flavor management dashboard.")}</p>
            </div>
            <div className="border-t border-white/15 pt-5 text-xs font-medium leading-6 text-white/65">
              {t("Admin credentials are created by the store owner using the server’s secure bootstrap process.")}
            </div>
          </div>

          <div className="flex min-w-0 flex-col justify-center p-6 sm:p-10 lg:px-12 lg:py-12">
            <Link aria-label={t("Return to the shop")} className="mb-8 inline-flex w-fit items-center gap-2 text-sm font-bold text-[#52647b] transition hover:text-[#092a53] lg:hidden" to="/">
              <span aria-hidden="true">←</span> {t("Return to the shop")}
            </Link>
            <div className="mb-6 grid size-12 place-items-center rounded-2xl bg-[#092a53] text-xl text-[#ffdc32] shadow-sm" aria-hidden="true">✦</div>
            <p className="mb-2 inline-flex w-fit rounded-full bg-[#edf3f9] px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.13em] text-[#092a53]">
              {t("Admin portal")}
            </p>
            <h1 className="font-display text-3xl font-extrabold tracking-tight sm:text-4xl">
              {t("Admin sign in")}
            </h1>
            <p className="mt-2 text-sm leading-6 text-[#65748a]">
              {t("Sign in to open the flavor management dashboard.")}
            </p>

            <div className="mt-5 flex gap-3 rounded-2xl border border-[#eadb8a] bg-[#fff9dc] p-4 text-sm leading-6 text-[#624f00]">
              <span aria-hidden="true" className="mt-0.5 shrink-0">ⓘ</span>
              <p>{t("Admin credentials are created by the store owner using the server’s secure bootstrap process.")}</p>
            </div>

            <form className="mt-7 space-y-5" onSubmit={handleSubmit}>
              <label className="block text-xs font-extrabold text-[#52647b]">
                {t("Admin email")}
                <input
                  autoComplete="username"
                  className="mt-2 w-full rounded-xl border border-[#d9d6cc] bg-[#fbfaf5] px-4 py-3.5 text-sm font-normal text-[#102c50] outline-none transition focus:border-[#bd9c00] focus:bg-white focus:ring-2 focus:ring-[#ffdc32]/40"
                  onChange={(event) => setEmail(event.target.value)}
                  required
                  type="email"
                  value={email}
                />
              </label>
              <PasswordField
                autoComplete="current-password"
                label={t("Password")}
                name="password"
                onChange={(event) => setPassword(event.target.value)}
                required
                value={password}
              />
              {error && (
                <p
                  className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm leading-5 text-red-700"
                  role="alert"
                >
                  {error}
                </p>
              )}
              <button
                className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#092a53] px-6 py-3.5 text-sm font-extrabold text-white transition hover:-translate-y-0.5 hover:bg-[#163e6b] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#bd9c00] disabled:cursor-wait disabled:opacity-60"
                disabled={isSubmitting}
                type="submit"
              >
                {isSubmitting ? t("Signing in…") : t("Sign in to dashboard")} {!isSubmitting && <span aria-hidden="true">→</span>}
              </button>
            </form>

            <p className="mt-6 text-center text-sm text-[#65748a]">
              <Link
                className="font-bold text-[#092a53] underline decoration-[#ffdc32] decoration-2 underline-offset-4"
                to="/"
              >
                {t("Return to the shop")}
              </Link>
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}
