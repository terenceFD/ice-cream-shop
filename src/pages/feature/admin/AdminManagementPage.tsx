import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import { PasswordField } from "../../../components/PasswordField";
import { useAdminAuth } from "./AdminAuthContext";
import { useLanguage } from "../../../language/LanguageContext";
import { apiRequest } from "../../../api/api";

const inputClassName =
  "mt-1.5 w-full rounded-xl border border-[#d9d6cc] bg-white px-4 py-3 text-sm font-normal text-[#102c50] outline-none transition focus:border-[#bd9c00] focus:ring-2 focus:ring-[#ffdc32]/40";
const MAX_PROFILE_IMAGE_SIZE = 5 * 1024 * 1024;
const PROFILE_IMAGE_DIMENSION = 256;

async function resizeProfilePicture(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Choose an image file for the profile picture.");
  }
  if (file.size > MAX_PROFILE_IMAGE_SIZE) {
    throw new Error("Choose an image smaller than 5 MB.");
  }

  const image = await createImageBitmap(file);
  const scale = Math.min(
    1,
    PROFILE_IMAGE_DIMENSION / Math.max(image.width, image.height),
  );
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.width * scale));
  canvas.height = Math.max(1, Math.round(image.height * scale));
  const context = canvas.getContext("2d");
  if (!context) {
    image.close();
    throw new Error("Your browser could not prepare the profile picture.");
  }
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  image.close();
  return canvas.toDataURL("image/jpeg", 0.8);
}

export function AdminManagementPage() {
  const { t } = useLanguage();
  const { admins, currentAdmin, createAdmin, removeAdmin, refreshAdmins, sessionToken } = useAdminAuth();
  const [stores, setStores] = useState<{ id: number; name: string; town: string; area: string }[]>([]);
  const [storeId, setStoreId] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [profilePicture, setProfilePicture] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingAdmins, setIsLoadingAdmins] = useState(true);
  const [removingAdminId, setRemovingAdminId] = useState<number | null>(null);

  useEffect(() => {
    Promise.all([
      refreshAdmins(),
      apiRequest<{ stores: typeof stores }>("/admin/stores", { token: sessionToken }),
    ]).then(([, result]) => {
      setStores(result.stores);
      setStoreId(String(result.stores[0]?.id || ""));
    }).catch((loadError: unknown) => {
      setError(t(loadError instanceof Error ? loadError.message : "Unable to load admin accounts."));
    }).finally(() => setIsLoadingAdmins(false));
  }, [refreshAdmins, sessionToken, t]);

  async function handleProfilePictureChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setError("");
    try {
      setProfilePicture(await resizeProfilePicture(file));
    } catch (imageError) {
      console.error("Unable to prepare admin profile picture.", imageError);
      setProfilePicture("");
      setError(t(imageError instanceof Error ? imageError.message : "Could not load this profile picture."));
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    setMessage("");
    setError("");
    if (password !== confirmPassword) {
      setError(t("The passwords do not match."));
      return;
    }

    setIsSaving(true);
    try {
      await createAdmin({ name, email, password, profilePicture, storeId: Number(storeId) });

      setName("");
      setEmail("");
      setPassword("");
      setConfirmPassword("");
      setProfilePicture("");
      setStoreId(String(stores[0]?.id || ""));
      formElement.reset();
      setMessage(
        t(
          "Admin account created. They can sign in with their email and password.",
        ),
      );
    } catch (creationError) {
      setError(t(creationError instanceof Error ? creationError.message : "Unable to create admin account."));
    } finally {
      setIsSaving(false);
    }
  }

  async function handleRemoveAdmin(admin: (typeof admins)[number]) {
    if (!window.confirm(t(
      "Remove admin {name} ({email})? They will immediately lose access, and this cannot be undone.",
      { name: admin.name, email: admin.email },
    ))) return;

    setError("");
    setMessage("");
    setRemovingAdminId(admin.id);
    try {
      await removeAdmin(admin.id);
      setMessage(t("Admin account removed."));
    } catch (removalError) {
      setError(t(removalError instanceof Error ? removalError.message : "Unable to remove admin account."));
    } finally {
      setRemovingAdminId(null);
    }
  }

  return (
    <div className="min-w-0">
      <header className="relative isolate mb-7 overflow-hidden rounded-[28px] bg-gradient-to-br from-[#092a53] via-[#123b68] to-[#1b4d78] p-6 text-white shadow-[0_18px_45px_rgba(9,42,83,0.16)] sm:p-8">
        <div aria-hidden="true" className="absolute -right-16 -top-24 -z-10 size-72 rounded-full border-[44px] border-white/[0.06]" />
        <div aria-hidden="true" className="absolute -bottom-28 right-36 -z-10 size-52 rounded-full bg-[#ffdc32]/10 blur-2xl" />
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div className="max-w-2xl">
            <p className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#ffdc32]">
              <svg aria-hidden="true" className="size-3.5" fill="none" viewBox="0 0 20 20">
                <path d="M10 2.5 16 5v4.2c0 3.8-2.4 6.5-6 8.3-3.6-1.8-6-4.5-6-8.3V5l6-2.5Z" stroke="currentColor" strokeWidth="1.5" />
                <path d="m7.5 9.7 1.7 1.7 3.5-3.7" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
              </svg>
              {t("Admin access")}
            </p>
            <h1 className="font-display text-3xl font-extrabold tracking-tight sm:text-4xl">
              {t("Manage admin accounts")}
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-white/75">
              {t("Create a store-specific admin login and choose which branch it can access.")}
            </p>
          </div>
          <div className="flex min-w-[170px] items-center gap-4 rounded-2xl border border-white/15 bg-white/10 px-4 py-3 backdrop-blur">
            <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-[#ffdc32] text-[#092a53]">
              <svg aria-hidden="true" className="size-5" fill="none" viewBox="0 0 24 24">
                <path d="M16 20v-1.5a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4V20m17 0v-1.5a4 4 0 0 0-3-3.87M14 3.2a4 4 0 0 1 0 7.6M9.5 10.8a3.8 3.8 0 1 0 0-7.6 3.8 3.8 0 0 0 0 7.6Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" />
              </svg>
            </span>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.13em] text-white/65">{t("Admin accounts")}</p>
              <p className="mt-0.5 font-display text-2xl font-extrabold">{admins.length}</p>
            </div>
          </div>
        </div>
      </header>

      {error && <p className="mb-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">{error}</p>}
      {message && <p className="mb-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800" role="status">{message}</p>}

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.05fr)_minmax(360px,0.95fr)]">
        <section className="overflow-hidden rounded-[24px] border border-[#e2e5eb] bg-white shadow-[0_10px_32px_rgba(18,44,80,0.06)]">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#edf0f4] px-5 py-5 sm:px-6">
            <div>
              <h2 className="font-display text-xl font-bold tracking-tight">{t("Admin accounts")}</h2>
              <p className="mt-1 text-sm text-[#65748a]">{t("Review who has access to the admin portal.")}</p>
            </div>
            <span className="inline-flex items-center gap-2 rounded-full bg-[#f1f5f9] px-3 py-1.5 text-xs font-bold text-[#52647b]">
              <span aria-hidden="true" className="size-2 rounded-full bg-emerald-500" />
              {t("{count} admin account(s) have access to the dashboard.", { count: admins.length })}
            </span>
          </div>
          <div className="space-y-3 p-4 sm:p-5">
            {isLoadingAdmins ? (
              <p className="rounded-xl bg-[#f4f7fa] px-4 py-5 text-sm text-[#65748a]" role="status">{t("Loading administrators…")}</p>
            ) : admins.map((admin) => {
              const isCurrentAdmin = admin.email === currentAdmin?.email
              const isOwnerAccount = admin.role === "owner"
              return (
                <article className={`flex min-w-0 items-center gap-4 rounded-2xl border p-4 transition ${isCurrentAdmin ? "border-[#d8c56b] bg-[#fffdf3]" : "border-[#e9edf2] bg-white hover:border-[#cbd5e1] hover:bg-[#fbfcfe]"}`} key={admin.id}>
                  {admin.profilePicture ? (
                    <img alt="" className="size-12 shrink-0 rounded-2xl object-cover ring-1 ring-black/5" src={admin.profilePicture} />
                  ) : (
                    <span aria-hidden="true" className={`grid size-12 shrink-0 place-items-center rounded-2xl font-display text-lg font-extrabold ${isCurrentAdmin ? "bg-[#ffdc32] text-[#092a53]" : "bg-[#eaf0f7] text-[#24496f]"}`}>
                      {admin.name.trim().charAt(0).toUpperCase()}
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-[#102c50]">{admin.name}</p>
                    <p className="mt-0.5 truncate text-xs text-[#65748a]">{admin.email}</p>
                    <p className="mt-1 truncate text-xs font-semibold text-[#365775]">{t("Assigned store: {store}", { store: admin.storeName || t("No store assigned") })}</p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide ${isCurrentAdmin ? "bg-[#fff0a8] text-[#705b00]" : "bg-[#edf3f8] text-[#365775]"}`}>
                    {t(isCurrentAdmin ? "You" : isOwnerAccount ? "Owner" : "Store admin")}
                  </span>
                  {!isOwnerAccount && <button
                    className="shrink-0 rounded-lg border border-red-200 px-3 py-2 text-xs font-bold text-red-700 transition hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600 disabled:cursor-wait disabled:opacity-50"
                    disabled={isCurrentAdmin || removingAdminId === admin.id}
                    onClick={() => handleRemoveAdmin(admin)}
                    type="button"
                  >
                    {removingAdminId === admin.id ? t("Removing…") : t("Remove")}
                  </button>}
                </article>
              )
            })}
            {!isLoadingAdmins && !admins.length && (
              <div className="rounded-2xl border border-dashed border-[#d9dfe7] bg-[#fafbfd] px-5 py-10 text-center">
                <span aria-hidden="true" className="mx-auto grid size-12 place-items-center rounded-2xl bg-[#edf3f8] text-[#355777]">
                  <svg className="size-6" fill="none" viewBox="0 0 24 24">
                    <path d="M16 20v-1.5a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4V20m17 0v-1.5a4 4 0 0 0-3-3.87M14 3.2a4 4 0 0 1 0 7.6M9.5 10.8a3.8 3.8 0 1 0 0-7.6 3.8 3.8 0 0 0 0 7.6Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6" />
                  </svg>
                </span>
                <p className="mt-3 text-sm font-bold text-[#102c50]">{t("No shop admins assigned yet.")}</p>
              </div>
            )}
          </div>
        </section>

        <section className="overflow-hidden rounded-[24px] border border-[#e2e5eb] bg-white shadow-[0_10px_32px_rgba(18,44,80,0.06)]">
          <div className="flex items-center gap-3 border-b border-[#edf0f4] px-5 py-5 sm:px-6">
            <span aria-hidden="true" className="grid size-11 place-items-center rounded-2xl bg-[#fff3bd] text-[#735f00]">
              <svg className="size-5" fill="none" viewBox="0 0 20 20">
                <path d="M10 4v12M4 10h12" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
              </svg>
            </span>
            <div>
              <h2 className="font-display text-xl font-bold tracking-tight">{t("Add an admin")}</h2>
              <p className="mt-1 text-sm text-[#65748a]">{t("Assign this login to one store. It can only access that store’s operational data.")}</p>
            </div>
          </div>
          <form className="space-y-4 p-5 sm:p-6" onSubmit={handleSubmit}>
            <label className="block text-xs font-extrabold text-[#52647b]">
              {t("Assigned store")}
              <select className={inputClassName} onChange={(event) => setStoreId(event.target.value)} required value={storeId}>
                {stores.map((store) => <option key={store.id} value={store.id}>{t(store.name)} · {t(store.town)}</option>)}
              </select>
            </label>
            <label className="block text-xs font-extrabold text-[#52647b]">
              {t("Full name")}
              <input autoComplete="name" className={inputClassName} onChange={(event) => setName(event.target.value)} required value={name} />
            </label>
            <label className="block text-xs font-extrabold text-[#52647b]">
              {t("Email address")}
              <input autoComplete="email" className={inputClassName} onChange={(event) => setEmail(event.target.value)} required type="email" value={email} />
            </label>
            <PasswordField autoComplete="new-password" label={t("Password")} minLength={8} name="password" onChange={(event) => setPassword(event.target.value)} required value={password} />
            <PasswordField autoComplete="new-password" label={t("Confirm password")} minLength={8} name="confirmPassword" onChange={(event) => setConfirmPassword(event.target.value)} required value={confirmPassword} />
            <label className="block text-xs font-extrabold text-[#52647b]">
              {t("Profile picture")}
              <input accept="image/*" className={`${inputClassName} file:mr-3 file:rounded-full file:border-0 file:bg-[#fff0a8] file:px-3 file:py-1.5 file:text-xs file:font-bold`} onChange={handleProfilePictureChange} type="file" />
              <span className="mt-1 block text-xs font-normal leading-5 text-[#65748a]">{t("Optional. Image will be resized before saving (5 MB max).")}</span>
            </label>
            {profilePicture && (
              <div className="flex items-center gap-3 rounded-2xl border border-[#e9edf2] bg-[#fafbfd] p-3">
                <img alt={t("New admin profile preview")} className="size-12 rounded-xl object-cover" src={profilePicture} />
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-[#102c50]">{name || t("New admin profile preview")}</p>
                  <p className="truncate text-xs text-[#65748a]">{t("Profile picture ready")}</p>
                </div>
              </div>
            )}
            <button className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#092a53] px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-[#163e6b] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#bd9c00] disabled:cursor-wait disabled:opacity-60" disabled={isSaving} type="submit">
              {isSaving ? t("Creating account…") : t("Create admin account")}
              {!isSaving && <span aria-hidden="true">→</span>}
            </button>
            <p className="flex items-start gap-2 rounded-xl bg-[#f4f7fa] px-3.5 py-3 text-xs leading-5 text-[#65748a]">
              <svg aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-[#355777]" fill="none" viewBox="0 0 20 20">
                <path d="M10 2.5 16 5v4.2c0 3.8-2.4 6.5-6 8.3-3.6-1.8-6-4.5-6-8.3V5l6-2.5Z" stroke="currentColor" strokeWidth="1.5" />
                <path d="m7.5 9.7 1.7 1.7 3.5-3.7" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
              </svg>
              {t("Only create administrator accounts for people you trust with store access.")}
            </p>
          </form>
        </section>
      </div>
    </div>
  );
}
