import { useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { apiRequest } from "../../api/api";
import { Footer, Header } from "../../components/Layout";
import { useLanguage } from "../../language/useLanguage";

const inputClassName =
  "mt-2 w-full min-h-12 rounded-lg border border-[#dcd8cc] bg-white px-4 text-base font-semibold text-brand-navy outline-none transition placeholder:font-medium placeholder:text-[#65748a] hover:border-brand-navy focus:border-brand-navy";

export function UnsubscribePage() {
  const { t } = useLanguage();
  const [params] = useSearchParams();
  const [email, setEmail] = useState(params.get("email") || "");
  const [status, setStatus] = useState("idle");
  const [message, setMessage] = useState("");

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (status === "submitting") return;
    setStatus("submitting");
    setMessage("");
    try {
      await apiRequest("/newsletter/unsubscribe", {
        method: "POST",
        body: { email },
      });
      setStatus("done");
    } catch (error) {
      setStatus("error");
      setMessage(
        t(error instanceof Error ? error.message : "Could not update that address right now."),
      );
    }
  }

  return (
    <div className="min-h-svh bg-[#fbfaf5] text-brand-navy">
      <Header />
      <main className="mx-auto max-w-lg px-5 py-16 sm:px-8" id="main" tabIndex={-1}>
        <h1 className="font-display text-4xl font-extrabold leading-none tracking-tight">
          {t("Unsubscribe")}
        </h1>
        <p className="mt-3 text-base leading-6 text-[#65748a]">
          {t("Enter the address that receives them. We will take it off the list.")}
        </p>
        {status === "done" ? (
          <p className="mt-8 border border-[#dcd8cc] bg-white px-5 py-4 text-base font-bold" role="status">
            {t("That address will no longer receive these emails.")}
          </p>
        ) : (
          <form className="mt-8" onSubmit={handleSubmit}>
            <label className="block text-sm font-bold" htmlFor="unsubscribe-email">
              {t("Email address")}
              <input
                autoComplete="email"
                className={inputClassName}
                id="unsubscribe-email"
                onChange={(event) => setEmail(event.target.value)}
                required
                type="email"
                value={email}
              />
            </label>
            <button
              className="mt-4 inline-flex min-h-12 items-center justify-center bg-brand-navy px-6 text-base font-bold text-white transition duration-150 hover:-translate-y-px hover:bg-brand-blue focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-navy focus-visible:ring-offset-2 active:translate-y-px active:scale-[0.985] disabled:cursor-wait disabled:opacity-60 motion-reduce:transform-none"
              disabled={status === "submitting"}
              type="submit"
            >
              {status === "submitting" ? t("Removing…") : t("Take me off the list")}
            </button>
            {status === "error" && (
              <p className="mt-3 text-sm font-semibold text-red-700" role="alert">
                {message}
              </p>
            )}
          </form>
        )}
      </main>
      <Footer />
    </div>
  );
}
