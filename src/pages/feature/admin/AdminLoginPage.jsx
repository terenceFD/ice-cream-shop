import { useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { Footer, Header } from "../../../components/Layout";
import { useAdminAuth } from "./AdminAuthContext";
import { PasswordField } from "../../../components/PasswordField";
import { useLanguage } from "../../../language/LanguageContext";

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

  async function handleSubmit(event) {
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
      <main className="flex flex-1 items-center justify-center px-5 py-12 sm:px-8">
        <section className="w-full max-w-md rounded-[28px] border border-[#d9d6cc] bg-white p-6 shadow-[0_12px_40px_rgba(18,44,80,0.08)] sm:p-9">
          <p className="mb-2 inline-block rounded-full bg-[#ffeb9c] px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.12em]">
            {t("Admin portal")}
          </p>
          <h1 className="font-display text-4xl font-bold tracking-tight">
            {t("Admin sign in")}
          </h1>
          <p className="mt-2 text-sm leading-6 text-[#65748a]">
            {t("Sign in to open the flavor management dashboard.")}
          </p>

          <div className="mt-5 rounded-xl border border-[#eadb8a] bg-[#fff9dc] p-4 text-sm leading-5 text-[#624f00]">
            {t(
              "Admin credentials are created by the store owner using the server’s secure bootstrap process.",
            )}
          </div>

          <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
            <label className="block text-sm font-semibold text-[#65748a]">
              {t("Admin email")}
              <input
                autoComplete="username"
                className="mt-1.5 w-full rounded-xl border border-[#d9d6cc] bg-[#f8f7f2] px-4 py-3 font-normal outline-none transition focus:border-[#bd9c00] focus:ring-2 focus:ring-[#ffdc32]/40"
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
                className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700"
                role="alert"
              >
                {error}
              </p>
            )}
            <button
              className="w-full rounded-full bg-[#ffdc32] px-6 py-3.5 text-sm font-bold text-[#102c50] transition hover:-translate-y-0.5 hover:bg-[#ffe76c] disabled:cursor-wait disabled:opacity-60"
              disabled={isSubmitting}
              type="submit"
            >
              {isSubmitting ? t("Signing in…") : t("Sign in to dashboard")}
            </button>
          </form>

          <p className="mt-5 text-center text-sm text-[#65748a]">
            <Link
              className="font-bold text-[#102c50] underline decoration-[#ffdc32] underline-offset-4"
              to="/"
            >
              {t("Return to the shop")}
            </Link>
          </p>
        </section>
      </main>
      <Footer />
    </div>
  );
}
