import { useEffect, useState, type FormEvent, type KeyboardEvent } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import { useAdminAuth } from "./useAdminAuth";
import { PasswordField } from "../../components/PasswordField";
import { useLanguage } from "../../language/useLanguage";
import { IDLE_SIGN_OUT_KEY } from "../../components/admin/AdminIdleGuard";
import { ADMIN_CREDENTIALS_CHANGED_KEY } from "../../api/api";

const fieldClassName = "mt-2 min-h-12 w-full rounded-lg border border-[#dce3eb] bg-white px-4 text-sm font-semibold text-brand-navy outline-none! placeholder:font-normal placeholder:text-[#65748a] focus:border-brand-navy";
const labelClassName = "text-sm font-bold text-brand-navy";

export function AdminLoginPage() {
  const {
    isAdmin,
    login,
    beginAdminMfaSetup,
    confirmAdminMfaSetup,
    verifyAdminMfaLogin,
    completeLogin,
  } = useAdminAuth();
  const { t, language, setLanguage } = useLanguage();
  const location = useLocation();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [errorKey, setErrorKey] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [capsLockOn, setCapsLockOn] = useState(false);
  const [mfaStage, setMfaStage] = useState<"password" | "setup" | "verify" | "recovery">("password");
  const [challengeToken, setChallengeToken] = useState("");
  const [authenticatorSecret, setAuthenticatorSecret] = useState("");
  const [authenticatorUri, setAuthenticatorUri] = useState("");
  const [authenticatorCode, setAuthenticatorCode] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [wasSignedOutIdle] = useState(() => {
    try {
      return sessionStorage.getItem(IDLE_SIGN_OUT_KEY) === "1";
    } catch {
      return false;
    }
  });
  const [credentialsWereChanged] = useState(() => {
    try {
      return sessionStorage.getItem(ADMIN_CREDENTIALS_CHANGED_KEY) === "1";
    } catch {
      return false;
    }
  });
  const signedOutForInactivity = wasSignedOutIdle && !error;

  useEffect(() => {
    try {
      sessionStorage.removeItem(IDLE_SIGN_OUT_KEY);
      sessionStorage.removeItem(ADMIN_CREDENTIALS_CHANGED_KEY);
    } catch {
      // Storage unavailable; nothing to clear.
    }
  }, []);

  // Admins start on the store overview (today's orders and what needs attention).
  if (isAdmin && recoveryCodes.length === 0) {
    return <Navigate to="/admin/overview" replace />;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);
    try {
      if (mfaStage === "password") {
        const result = await login(email, password);
        setChallengeToken(result.challengeToken);
        if (result.setupRequired) {
          const setup = await beginAdminMfaSetup(result.challengeToken);
          setAuthenticatorSecret(setup.secret);
          setAuthenticatorUri(setup.authenticatorUri);
          setMfaStage("setup");
        } else {
          setMfaStage("verify");
        }
        return;
      }

      if (!challengeToken) throw new Error("Your sign-in step expired. Enter your password again.");
      if (mfaStage === "setup") {
        const result = await confirmAdminMfaSetup(challengeToken, authenticatorCode);
        setRecoveryCodes(result.recoveryCodes);
        completeLogin(result);
        setAuthenticatorCode("");
        setMfaStage("recovery");
        return;
      }

      const result = await verifyAdminMfaLogin(challengeToken, authenticatorCode);
      completeLogin(result);
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

  function restartSignIn() {
    setMfaStage("password");
    setChallengeToken("");
    setAuthenticatorSecret("");
    setAuthenticatorUri("");
    setAuthenticatorCode("");
    setRecoveryCodes([]);
    setError("");
  }

  function continueToDashboard() {
    const from = location.state?.from;
    const destination = from?.pathname ? `${from.pathname}${from.search || ""}${from.hash || ""}` : "/admin/overview";
    setRecoveryCodes([]);
    navigate(destination, { replace: true });
  }

  const highlights = [
    { title: t("Live order queue"), body: t("Follow every order from payment to delivery.") },
    { title: t("Store-level access"), body: t("Each store admin only sees their own branch.") },
    { title: t("Sales and reports"), body: t("Revenue, best sellers and stock at a glance.") },
  ];

  return (
    <div className="min-h-screen bg-white text-brand-navy lg:grid lg:grid-cols-2">
      <div className="h-1.5 bg-brand-yellow lg:col-span-2" />
      <aside className="relative h-56 overflow-hidden lg:h-auto lg:min-h-[calc(100vh-0.375rem)]">
        <img
          alt=""
          className="absolute inset-0 size-full object-cover"
          decoding="async"
          fetchPriority="high"
          height={1200}
          src="/images/hero-ice-cream.jpg"
          width={1600}
        />
        <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-[#061d3a] via-[#061d3a]/82 to-[#061d3a]/68" />
        <div className="relative flex h-full flex-col justify-between p-6 sm:p-8 lg:p-12">
          <Link className="flex w-fit items-center gap-3 rounded-md outline-none! focus-visible:outline-2! focus-visible:outline-offset-4 focus-visible:outline-white" to="/">
            <img alt="" className="size-12" decoding="async" height={48} src="/logo.png" width={48} />
            <span className="font-display text-lg font-extrabold leading-[0.95] text-white">
              Cold Stone
              <span className="mt-1 block">Creamery</span>
            </span>
          </Link>
          <div>
            <p className="text-sm font-bold text-white lg:hidden">{t("Admin portal")}</p>
            <div className="hidden lg:block">
              <h2 className="font-display text-[2.35rem] font-extrabold leading-[1.05] tracking-[-0.03em] text-white">
                <span className="block">{t("Every scoop, order and store —")}</span>
                {" "}
                <span className="mt-2 block">{t("in one place.")}</span>
              </h2>
              <ul className="mt-10 space-y-5 border-l-2 border-brand-yellow pl-5">
                {highlights.map((item) => (
                  <li key={item.title}>
                    <p className="font-bold text-white">{item.title}</p>
                    <p className="mt-1 text-sm leading-6 text-white/80">{item.body}</p>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </aside>

      <main className="flex min-h-[calc(100vh-14rem-0.375rem)] flex-col px-6 py-8 sm:px-12 lg:min-h-[calc(100vh-0.375rem)] lg:px-16 xl:px-20" id="main" tabIndex={-1}>
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col lg:mx-0">
        <div className="flex justify-end">
          <div aria-label={t("Select language")} className="flex items-center gap-3" role="group">
            {([["en", "English"], ["fr", "Français"]] as const).map(([option, label]) => (
              <button
                aria-pressed={language === option}
                className={`text-sm outline-none! focus-visible:outline-2! focus-visible:outline-offset-4 focus-visible:outline-brand-navy ${language === option ? "font-bold text-brand-navy underline decoration-2 decoration-[#b8721e] underline-offset-4" : "font-semibold text-[#65748a]"}`}
                key={option}
                onClick={() => setLanguage(option)}
                type="button"
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-1 flex-col justify-center py-12">
          <h1 className="font-display text-4xl font-extrabold tracking-[-0.03em]">{t("Welcome back")}</h1>
          <p className="mt-3 max-w-[36ch] text-sm leading-6 text-[#65748a]">{t("Sign in to the admin portal to manage your store.")}</p>

          {signedOutForInactivity && (
            <p className="mt-6 text-sm leading-6 text-brand-blue" role="status">
              {t("You were signed out after 30 minutes of inactivity to keep the dashboard secure. Sign in again to continue.")}
            </p>
          )}

          {credentialsWereChanged && (
            <p className="mt-6 rounded-lg bg-[#e7f6ee] px-4 py-3 text-sm leading-6 text-[#1f7a46]" role="status">
              {t("Your sign-in details were updated. Sign in again with your new email and current password.")}
            </p>
          )}

          {error && (
            <p className="admin-login-shake mt-6 text-sm leading-6 text-red-700" key={errorKey} role="alert">
              {error}
            </p>
          )}

          {mfaStage === "recovery" ? (
            <section aria-labelledby="recovery-codes-title" className="mt-8">
              <h2 className="font-display text-2xl font-extrabold" id="recovery-codes-title">{t("Save your recovery codes")}</h2>
              <p className="mt-2 text-sm leading-6 text-[#65748a]">{t("These codes are shown only once. Keep them somewhere private. Each code can be used once if you cannot access your authenticator.")}</p>
              <div className="mt-5 grid grid-cols-2 gap-x-4 gap-y-2 border-y border-[#dce3eb] py-4 font-mono text-sm font-bold text-brand-navy">
                {recoveryCodes.map((code) => <code key={code}>{code}</code>)}
              </div>
              <button
                className="mt-6 inline-flex min-h-12 w-full items-center justify-center rounded-lg bg-brand-navy px-6 text-sm font-bold text-white outline-none! hover:bg-brand-blue focus-visible:outline-2! focus-visible:outline-offset-2 focus-visible:outline-brand-navy"
                onClick={continueToDashboard}
                type="button"
              >
                {t("I have saved these codes")}
              </button>
            </section>
          ) : (
            <form className="mt-8 space-y-5" noValidate={false} onSubmit={handleSubmit}>
              {mfaStage === "password" ? (
                <>
                  <label className="block">
                    <span className={labelClassName}>{t("Admin email")}</span>
                    <input
                      autoComplete="username"
                      autoFocus
                      className={fieldClassName}
                      onChange={(event) => setEmail(event.target.value)}
                      placeholder="you@coldstone.cm"
                      required
                      type="email"
                      value={email}
                    />
                  </label>

                  <PasswordField
                    autoComplete="current-password"
                    label={t("Password")}
                    labelClassName={labelClassName}
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
                      <span className="mt-2 block text-sm font-semibold text-[#8a5a00]">
                        {t("Caps Lock is on")}
                      </span>
                    )}
                  </PasswordField>
                </>
              ) : (
                <>
                  {mfaStage === "setup" && (
                    <div className="text-sm leading-6 text-[#65748a]">
                      <h2 className="font-display text-2xl font-extrabold text-brand-navy">{t("Set up your authenticator app")}</h2>
                      <p className="mt-2">{t("Scan this QR code with Google Authenticator, Microsoft Authenticator, or 1Password.")}</p>
                      <div className="mt-5 flex justify-center border border-[#dce3eb] bg-white p-4">
                        <QRCodeSVG
                          aria-label={t("Authenticator setup QR code")}
                          bgColor="#ffffff"
                          fgColor="#472a3b"
                          includeMargin
                          level="M"
                          size={200}
                          title={t("Authenticator setup QR code")}
                          value={authenticatorUri}
                        />
                      </div>
                      <details className="mt-4">
                        <summary className="cursor-pointer font-bold text-brand-navy">{t("Can't scan? Use manual setup")}</summary>
                        <p className="mt-2">{t("Enter this setup key in your authenticator app:")}</p>
                        <code className="mt-2 block break-all border border-[#dce3eb] bg-white p-3 text-sm font-bold text-brand-navy">{authenticatorSecret}</code>
                        <details className="mt-3">
                          <summary className="cursor-pointer font-bold text-brand-navy">{t("Show manual setup URI")}</summary>
                          <code className="mt-2 block break-all border border-[#dce3eb] bg-white p-3 text-xs">{authenticatorUri}</code>
                        </details>
                      </details>
                    </div>
                  )}
                  <label className="block">
                    <span className={labelClassName}>{t(mfaStage === "setup" ? "Authenticator code" : "Authenticator or recovery code")}</span>
                    <input
                      autoComplete="one-time-code"
                      autoCapitalize="characters"
                      autoFocus
                      className={`${fieldClassName} text-center font-mono tracking-[0.2em]`}
                      inputMode={mfaStage === "setup" ? "numeric" : "text"}
                      maxLength={mfaStage === "setup" ? 6 : 19}
                      onChange={(event) => setAuthenticatorCode(event.target.value)}
                      pattern={mfaStage === "setup" ? "[0-9]{6}" : undefined}
                      placeholder={mfaStage === "setup" ? "000000" : "000000 or XXXX-XXXX"}
                      required
                      type="text"
                      value={authenticatorCode}
                    />
                  </label>
                </>
              )}

              <button
                className="inline-flex min-h-12 w-full items-center justify-center rounded-lg bg-brand-navy px-6 text-sm font-bold text-white outline-none! hover:bg-brand-blue focus-visible:outline-2! focus-visible:outline-offset-2 focus-visible:outline-brand-navy disabled:cursor-wait disabled:opacity-70"
                disabled={isSubmitting}
                type="submit"
              >
                {isSubmitting ? t("Signing in…") : t(mfaStage === "password" ? "Login" : mfaStage === "setup" ? "Verify and finish setup" : "Verify and sign in")}
              </button>
              {mfaStage !== "password" && (
                <button className="text-sm font-bold text-brand-navy underline decoration-[#b8721e] decoration-2 underline-offset-4 outline-none! focus-visible:outline-2! focus-visible:outline-offset-4 focus-visible:outline-brand-navy" onClick={restartSignIn} type="button">
                  {t("Start sign-in again")}
                </button>
              )}
            </form>
          )}

          <Link className="mt-8 w-fit text-sm font-bold text-brand-navy underline decoration-[#b8721e] decoration-2 underline-offset-4 outline-none! focus-visible:outline-2! focus-visible:outline-offset-4 focus-visible:outline-brand-navy" to="/">
            {t("Return to the shop")}
          </Link>
        </div>
        </div>
      </main>
    </div>
  );
}
