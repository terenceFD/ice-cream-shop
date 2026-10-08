import { useEffect, useState } from "react";
import { PasswordField } from "../../../components/PasswordField";
import { useAdminAuth } from "../../../AdminAuthContext";
import { useLanguage } from "../../../LanguageContext";

const inputClassName =
  "mt-1.5 w-full rounded-xl border border-[#d9d6cc] bg-white px-4 py-3 text-sm font-normal text-[#102c50] outline-none transition focus:border-[#bd9c00] focus:ring-2 focus:ring-[#ffdc32]/40";
const MAX_PROFILE_IMAGE_SIZE = 5 * 1024 * 1024;
const PROFILE_IMAGE_DIMENSION = 256;

async function resizeProfilePicture(file) {
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
  const { admins, currentAdmin, createAdmin, refreshAdmins } = useAdminAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [profilePicture, setProfilePicture] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    refreshAdmins().catch((loadError) => {
      setError(t(loadError.message));
    });
  }, [refreshAdmins, t]);

  async function handleProfilePictureChange(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    setError("");
    try {
      setProfilePicture(await resizeProfilePicture(file));
    } catch (imageError) {
      console.error("Unable to prepare admin profile picture.", imageError);
      setProfilePicture("");
      setError(t(imageError.message || "Could not load this profile picture."));
    }
  }

  async function handleSubmit(event) {
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
      await createAdmin({ name, email, password, profilePicture });

      setName("");
      setEmail("");
      setPassword("");
      setConfirmPassword("");
      setProfilePicture("");
      formElement.reset();
      setMessage(
        t(
          "Admin account created. They can sign in with their email and password.",
        ),
      );
    } catch (creationError) {
      setError(t(creationError.message));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="min-w-0">
      <div className="mb-8">
        <p className="mb-2 inline-block rounded-full bg-[#ffeb9c] px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.12em]">
          {t("Admin access")}
        </p>
        <h1 className="font-display text-4xl font-bold tracking-tight sm:text-5xl">
          {t("Manage admin accounts")}
        </h1>
        <p className="mt-2 text-sm text-[#65748a]">
          {t("Create another admin login and add their profile picture.")}
        </p>
      </div>

      <div className="grid items-start gap-8 lg:grid-cols-[1fr_0.9fr]">
        <section className="rounded-[24px] border border-[#ece8de] bg-white p-5 shadow-[0_8px_30px_rgba(18,44,80,0.05)] sm:p-7">
          <h2 className="font-display text-2xl font-bold">
            {t("Add an admin")}
          </h2>
          <form className="mt-5 space-y-4" onSubmit={handleSubmit}>
            <label className="block text-sm font-semibold">
              {t("Full name")}
              <input
                autoComplete="name"
                className={inputClassName}
                onChange={(event) => setName(event.target.value)}
                required
                value={name}
              />
            </label>
            <label className="block text-sm font-semibold">
              {t("Email address")}
              <input
                autoComplete="email"
                className={inputClassName}
                onChange={(event) => setEmail(event.target.value)}
                required
                type="email"
                value={email}
              />
            </label>
            <PasswordField
              autoComplete="new-password"
              label={t("Password")}
              minLength={8}
              name="password"
              onChange={(event) => setPassword(event.target.value)}
              required
              value={password}
            />
            <PasswordField
              autoComplete="new-password"
              label={t("Confirm password")}
              minLength={8}
              name="confirmPassword"
              onChange={(event) => setConfirmPassword(event.target.value)}
              required
              value={confirmPassword}
            />
            <label className="block text-sm font-semibold">
              {t("Profile picture")}
              <input
                accept="image/*"
                className={`${inputClassName} file:mr-3 file:rounded-full file:border-0 file:bg-[#ffeb9c] file:px-3 file:py-1.5 file:text-xs file:font-bold`}
                onChange={handleProfilePictureChange}
                type="file"
              />
              <span className="mt-1 block text-xs font-normal text-[#65748a]">
                {t("Optional. Image will be resized before saving (5 MB max).")}
              </span>
            </label>
            {profilePicture && (
              <img
                alt={t("New admin profile preview")}
                className="size-20 rounded-full object-cover"
                src={profilePicture}
              />
            )}
            {error && (
              <p
                className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700"
                role="alert"
              >
                {error}
              </p>
            )}
            {message && (
              <p
                className="rounded-xl bg-[#d8f29a] px-4 py-3 text-sm text-[#163e35]"
                role="status"
              >
                {message}
              </p>
            )}
            <button
              className="w-full rounded-full bg-[#ffdc32] px-6 py-3.5 text-sm font-bold transition hover:bg-[#ffe76c] disabled:cursor-wait disabled:opacity-60"
              disabled={isSaving}
              type="submit"
            >
              {isSaving ? t("Creating account…") : t("Create admin account")}
            </button>
          </form>
        </section>

        <section className="rounded-[24px] border border-[#ece8de] bg-white p-5 shadow-[0_8px_30px_rgba(18,44,80,0.05)] sm:p-7">
          <h2 className="font-display text-2xl font-bold">
            {t("Admin accounts")}
          </h2>
          <p className="mt-1 text-sm text-[#65748a]">
            {t("{count} admin account(s) can access this portal.", {
              count: admins.length,
            })}
          </p>
          <div className="mt-5 divide-y divide-[#ece8de]">
            {admins.map((admin) => (
              <article
                className="flex items-center gap-3 py-4 first:pt-0 last:pb-0"
                key={admin.email}
              >
                {admin.profilePicture ? (
                  <img
                    alt=""
                    className="size-12 shrink-0 rounded-full object-cover"
                    src={admin.profilePicture}
                  />
                ) : (
                  <span
                    aria-hidden="true"
                    className="grid size-12 shrink-0 place-items-center rounded-full bg-[#ffeb9c] font-display text-lg font-bold"
                  >
                    {admin.name.charAt(0).toUpperCase()}
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold">
                    {admin.name}
                    {admin.email === currentAdmin?.email
                      ? ` (${t("you")})`
                      : ""}
                  </p>
                  <p className="truncate text-xs text-[#65748a]">
                    {admin.email}
                  </p>
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
