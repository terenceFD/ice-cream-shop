import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from "react";
import { PasswordField } from "../../../components/PasswordField";
import { passwordStrength } from "../../../components/passwordStrength";
import { useAdminAuth } from "./useAdminAuth";
import { useLanguage } from "../../../language/useLanguage";
import { apiRequest } from "../../../api/api";

const inputClassName =
  "mt-1.5 w-full rounded-xl border border-[#dde4ec] bg-[#f8fafc] px-3.5 py-2.5 text-sm font-medium text-[#102c50] transition placeholder:text-[#9aa5b3] hover:border-[#c9d4e0] focus:border-[#bd9c00] focus:bg-white focus:ring-4 focus:ring-[#ffdc32]/25 outline-none!";
const labelClassName = "block text-xs font-bold text-[#4f6379]";
const MAX_PROFILE_IMAGE_SIZE = 5 * 1024 * 1024;
const PROFILE_IMAGE_DIMENSION = 256;
const STORE_ADMIN_PAGES = ["Orders", "Delivered", "Payments", "Reports", "Notifications", "Customer accounts", "Customer reviews", "Cake requests"];

const icons = {
  shield: "M12 3 5 6v5c0 4.5 3 8.3 7 10 4-1.7 7-5.5 7-10V6l-7-3Zm-3 9 2 2 4-4",
  users: "M16 20v-1.5a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4V20m17 0v-1.5a4 4 0 0 0-3-3.87M14 3.2a4 4 0 0 1 0 7.6M9.5 10.8a3.8 3.8 0 1 0 0-7.6 3.8 3.8 0 0 0 0 7.6Z",
  crown: "M4 18h16M5 15 4 7l5 4 3-6 3 6 5-4-1 8H5Z",
  store: "M4 10h16l-1.5-5h-13L4 10Zm0 0v10h16V10M9 20v-5h6v5",
  plus: "M12 5v14M5 12h14",
  search: "m20 20-4.2-4.2M10.5 17a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13Z",
  trash: "M4 7h16M10 11v6m4-6v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3",
  close: "M6 6l12 12M18 6 6 18",
  check: "m5 12.5 4.5 4.5L19 7.5",
  alert: "M12 8v5m0 3.5v.01M10.3 3.9 2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z",
  mail: "M4 6h16v12H4V6Zm0 0 8 7 8-7",
  camera: "M4 8h3l2-3h6l2 3h3v11H4V8Zm8 9a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z",
  lock: "M6 11h12v9H6v-9Zm2 0V8a4 4 0 0 1 8 0v3",
};

function Icon({ path, className = "size-4" }: { path: string; className?: string }) {
  return (
    <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 24 24">
      <path d={path} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
    </svg>
  );
}

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

function Avatar({ name, picture, className = "size-10", highlight = false }: { name: string; picture?: string | null; className?: string; highlight?: boolean }) {
  if (picture) return <img decoding="async" loading="lazy" alt="" className={`${className} shrink-0 rounded-xl object-cover ring-1 ring-black/5`} src={picture} />;
  return (
    <span aria-hidden="true" className={`${className} grid shrink-0 place-items-center rounded-xl font-display text-sm font-extrabold ${highlight ? "bg-[#ffdc32] text-[#092a53]" : "bg-[#eaf0f7] text-[#24496f]"}`}>
      {name.trim().split(/\s+/).slice(0, 2).map((part) => part.charAt(0).toUpperCase()).join("") || "?"}
    </span>
  );
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
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [adminToRemove, setAdminToRemove] = useState<(typeof admins)[number] | null>(null);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | "owner" | "store_admin">("all");
  const isOverlayOpen = isFormOpen || Boolean(adminToRemove);

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

  useEffect(() => {
    if (!message) return undefined;
    const timer = window.setTimeout(() => setMessage(""), 5000);
    return () => window.clearTimeout(timer);
  }, [message]);

  useEffect(() => {
    if (!isOverlayOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setIsFormOpen(false);
      setAdminToRemove(null);
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOverlayOpen]);

  const ownerCount = admins.filter((admin) => admin.role === "owner").length;
  const storeAdminCount = admins.length - ownerCount;
  const coverage = useMemo(() => stores.map((store) => ({
    store,
    admins: admins.filter((admin) => admin.role !== "owner" && admin.storeId === store.id),
  })), [admins, stores]);
  const uncoveredCount = coverage.filter((entry) => !entry.admins.length).length;

  const visibleAdmins = useMemo(() => {
    const query = search.trim().toLowerCase();
    return admins
      .filter((admin) => roleFilter === "all" || admin.role === roleFilter)
      .filter((admin) => !query || [admin.name, admin.email, admin.storeName].some((value) => String(value || "").toLowerCase().includes(query)))
      .sort((a, b) => (a.role === b.role ? a.name.localeCompare(b.name) : a.role === "owner" ? -1 : 1));
  }, [admins, roleFilter, search]);

  function openForm(presetStoreId?: number) {
    setError("");
    setMessage("");
    if (presetStoreId) setStoreId(String(presetStoreId));
    setIsFormOpen(true);
  }

  async function handleProfilePictureChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
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
      setIsFormOpen(false);
      setMessage(t("Admin account created. They can sign in with their email and password."));
    } catch (creationError) {
      setError(t(creationError instanceof Error ? creationError.message : "Unable to create admin account."));
    } finally {
      setIsSaving(false);
    }
  }

  async function handleRemoveAdmin() {
    const admin = adminToRemove;
    if (!admin) return;
    setError("");
    setMessage("");
    setRemovingAdminId(admin.id);
    try {
      await removeAdmin(admin.id);
      setAdminToRemove(null);
      setMessage(t("Admin account removed."));
    } catch (removalError) {
      setError(t(removalError instanceof Error ? removalError.message : "Unable to remove admin account."));
    } finally {
      setRemovingAdminId(null);
    }
  }

  const strength = passwordStrength(password);
  const strengthMeta = [
    { label: t("Too short"), color: "bg-[#d2544b]" },
    { label: t("Weak"), color: "bg-[#d2544b]" },
    { label: t("Fair"), color: "bg-[#e0a100]" },
    { label: t("Good"), color: "bg-[#35a36b]" },
    { label: t("Strong"), color: "bg-[#1f7a46]" },
  ][password ? strength : 0];
  const passwordsMatch = confirmPassword.length > 0 && password === confirmPassword;
  const selectedStore = stores.find((store) => String(store.id) === storeId);

  const metrics = [
    { label: "Admin accounts", value: admins.length, icon: icons.users, accent: "bg-[#e9f1fa] text-[#315982]" },
    { label: "Owners", value: ownerCount, icon: icons.crown, accent: "bg-[#fff4c2] text-[#8a6f00]" },
    { label: "Store admins", value: storeAdminCount, icon: icons.store, accent: "bg-[#e5f4ea] text-[#2c7a4f]" },
    { label: "Stores without an admin", value: uncoveredCount, icon: icons.alert, accent: uncoveredCount ? "bg-[#fdecea] text-[#b2433a]" : "bg-[#f1f4f8] text-[#65748a]" },
  ];

  return (
    <div className="min-w-0 space-y-6">
      <header className="flex flex-col gap-5 border-b border-[#edf1f5] pb-6 xl:flex-row xl:items-end xl:justify-between">
        <div className="flex min-w-0 items-center gap-4">
          <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-[#092a53] text-[#ffdc32]">
            <Icon className="size-7" path={icons.shield} />
          </span>
          <div className="min-w-0">
            <nav aria-label={t("Breadcrumb")} className="text-[11px] font-bold text-[#8190a1]">
              {t("Workspace")} <span aria-hidden="true" className="mx-1">/</span>
              <span className="text-[#8a7000]">{t("Admin accounts")}</span>
            </nav>
            <h1 className="mt-1 font-display text-2xl font-extrabold tracking-tight text-[#092a53] sm:text-[1.9rem]">{t("Manage admin accounts")}</h1>
            <p className="mt-0.5 max-w-2xl text-sm text-[#65748a]">{t("Create a store-specific admin login and choose which branch it can access.")}</p>
          </div>
        </div>
        <button
          className="inline-flex min-h-10 items-center gap-2 self-start rounded-xl bg-[#092a53] px-4 text-sm font-bold text-white shadow-[0_6px_16px_rgba(9,42,83,0.18)] transition hover:-translate-y-0.5 hover:bg-[#163e6b] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#bd9c00] disabled:opacity-50 xl:self-auto"
          disabled={!stores.length}
          onClick={() => openForm()}
          type="button"
        >
          <Icon path={icons.plus} />
          {t("Add an admin")}
        </button>
      </header>

      {message && (
        <div className="flex items-center justify-between gap-3 rounded-xl bg-[#eaf6ee] px-4 py-3 text-sm font-semibold text-[#1f5d3c] ring-1 ring-[#cfe8d8]" role="status">
          <span className="flex items-center gap-2"><Icon path={icons.check} />{message}</span>
          <button aria-label={t("Dismiss")} className="grid size-7 shrink-0 place-items-center rounded-lg transition hover:bg-[#d7eedf]" onClick={() => setMessage("")} type="button">
            <Icon className="size-3.5" path={icons.close} />
          </button>
        </div>
      )}
      {error && !isOverlayOpen && (
        <p className="flex items-start gap-2 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 ring-1 ring-red-100" role="alert">
          <Icon className="mt-0.5 size-4 shrink-0" path={icons.alert} />
          {error}
        </p>
      )}

      <section aria-label={t("Admin overview")} className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {metrics.map((metric) => (
          <article className="rounded-2xl border border-[#e5ebf3] bg-white p-4 sm:p-5" key={metric.label}>
            <span className={`grid size-9 place-items-center rounded-xl ${metric.accent}`}><Icon path={metric.icon} /></span>
            <p className="mt-4 font-display text-[1.75rem] font-extrabold leading-none tracking-tight text-[#102c50]">{metric.value}</p>
            <p className="mt-1.5 text-xs font-semibold text-[#65748a]">{t(metric.label)}</p>
          </article>
        ))}
      </section>

      <div className="grid min-w-0 grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <section aria-labelledby="admin-list-title" className="min-w-0 rounded-[20px] border border-[#e5ebf3] bg-white">
          <div className="flex flex-col gap-4 border-b border-[#edf1f5] p-4 sm:p-5">
            <div>
              <h2 className="font-display text-xl font-extrabold text-[#092a53]" id="admin-list-title">{t("Admin accounts")}</h2>
              <p className="mt-0.5 text-xs text-[#65748a]">{t("Review who has access to the admin portal.")}</p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <label className="relative block flex-1">
                <span className="sr-only">{t("Search")}</span>
                <Icon className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-[#8190a1]" path={icons.search} />
                <input className={`${inputClassName} mt-0 pl-10`} onChange={(event) => setSearch(event.target.value)} placeholder={t("Name, email, or store")} type="search" value={search} />
              </label>
              <div aria-label={t("Role")} className="flex max-w-full overflow-x-auto rounded-xl bg-[#f1f4f8] p-1" role="group">
                {([
                  { key: "all", label: t("All"), count: admins.length },
                  { key: "owner", label: t("Owners"), count: ownerCount },
                  { key: "store_admin", label: t("Store admins"), count: storeAdminCount },
                ] as const).map((option) => (
                  <button
                    aria-pressed={roleFilter === option.key}
                    className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-bold transition ${roleFilter === option.key ? "bg-white text-[#092a53] shadow-sm" : "text-[#65748a] hover:text-[#092a53]"}`}
                    key={option.key}
                    onClick={() => setRoleFilter(option.key)}
                    type="button"
                  >
                    {option.label}
                    <span className="rounded-full bg-[#e6ebf1] px-1.5 text-[10px] text-[#65748a]">{option.count}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {isLoadingAdmins ? (
            <div className="space-y-3 p-4 sm:p-5" role="status">
              <span className="sr-only">{t("Loading administrators…")}</span>
              {[0, 1, 2].map((row) => (
                <div aria-hidden="true" className="flex animate-pulse items-center gap-4" key={row}>
                  <span className="size-10 rounded-xl bg-[#eef2f6]" />
                  <span className="h-3 flex-1 rounded bg-[#eef2f6]" />
                  <span className="h-3 w-24 rounded bg-[#eef2f6]" />
                </div>
              ))}
            </div>
          ) : visibleAdmins.length === 0 ? (
            <div className="px-6 py-14 text-center">
              <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-[#f1f4f8] text-[#8190a1]"><Icon className="size-5" path={icons.users} /></span>
              <p className="mt-4 font-display text-lg font-extrabold text-[#092a53]">{t(admins.length ? "No admins match your search." : "No shop admins assigned yet.")}</p>
            </div>
          ) : (
            <div className="relative overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead>
                  <tr className="border-b border-[#edf1f5] text-[11px] uppercase tracking-[0.08em] text-[#8190a1]">
                    <th className="px-5 py-3 font-extrabold" scope="col">{t("Admin")}</th>
                    <th className="px-3 py-3 font-extrabold" scope="col">{t("Role")}</th>
                    <th className="px-3 py-3 font-extrabold" scope="col">{t("Assigned store")}</th>
                    <th className="px-5 py-3" scope="col"><span className="sr-only">{t("Action")}</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f0f3f7]">
                  {visibleAdmins.map((admin) => {
                    const isCurrentAdmin = admin.email === currentAdmin?.email;
                    const isOwnerAccount = admin.role === "owner";
                    return (
                      <tr className={`transition hover:bg-[#fafbfd] ${isCurrentAdmin ? "bg-[#fffdf3]" : ""} ${removingAdminId === admin.id ? "opacity-50" : ""}`} key={admin.id}>
                        <td className="px-5 py-3.5">
                          <div className="flex min-w-0 items-center gap-3">
                            <Avatar highlight={isCurrentAdmin} name={admin.name} picture={admin.profilePicture} />
                            <div className="min-w-0">
                              <p className="flex items-center gap-2 font-bold text-[#102c50]">
                                <span className="max-w-[14rem] truncate">{admin.name}</span>
                                {isCurrentAdmin && <span className="rounded-full bg-[#ffdc32] px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wide text-[#092a53]">{t("You")}</span>}
                              </p>
                              <a className="flex max-w-[16rem] items-center gap-1 truncate text-[11px] text-[#8190a1] hover:text-[#092a53]" href={`mailto:${admin.email}`}>
                                <Icon className="size-3 shrink-0" path={icons.mail} />
                                <span className="truncate">{admin.email}</span>
                              </a>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-3.5">
                          <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 ${isOwnerAccount ? "bg-[#fff6cc] text-[#7a6300] ring-[#efdc85]" : "bg-[#e9f1fa] text-[#245281] ring-[#cfe0f2]"}`}>
                            <Icon className="size-3.5" path={isOwnerAccount ? icons.crown : icons.store} />
                            {t(isOwnerAccount ? "Owner" : "Store admin")}
                          </span>
                        </td>
                        <td className="px-3 py-3.5 text-xs font-semibold text-[#4f6379]">
                          {isOwnerAccount ? t("All stores") : admin.storeName ? t(admin.storeName) : <span className="text-[#b2433a]">{t("No store assigned")}</span>}
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          {!isOwnerAccount && !isCurrentAdmin ? (
                            <button
                              aria-label={`${t("Remove")} ${admin.name}`}
                              className="grid size-8 place-items-center rounded-lg text-[#6b7d91] transition hover:bg-red-50 hover:text-red-600 disabled:cursor-wait"
                              disabled={removingAdminId === admin.id}
                              onClick={() => { setError(""); setAdminToRemove(admin); }}
                              title={t("Remove")}
                              type="button"
                            >
                              <Icon path={icons.trash} />
                            </button>
                          ) : (
                            <span className="grid size-8 place-items-center text-[#c3ccd7]" title={t(isOwnerAccount ? "Owner accounts cannot be removed here." : "You cannot remove your own account.")}>
                              <Icon path={icons.lock} />
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <aside aria-labelledby="coverage-title" className="rounded-[20px] border border-[#e5ebf3] bg-white p-4 sm:p-5 xl:sticky xl:top-24">
          <h2 className="font-display text-lg font-extrabold text-[#092a53]" id="coverage-title">{t("Store coverage")}</h2>
          <p className="mt-0.5 text-xs text-[#65748a]">{t("Every branch should have at least one admin.")}</p>
          {stores.length > 0 && (
            <div aria-hidden="true" className="mt-4 flex h-2 overflow-hidden rounded-full bg-[#fdecea]">
              <span className="bg-[#35a36b]" style={{ width: `${((stores.length - uncoveredCount) / stores.length) * 100}%` }} />
            </div>
          )}
          <ul className="mt-4 space-y-2">
            {coverage.map(({ store, admins: storeAdmins }) => (
              <li className={`flex items-center gap-3 rounded-xl p-3 ring-1 ${storeAdmins.length ? "bg-[#fafbfd] ring-[#eef2f6]" : "bg-[#fffafa] ring-[#f6dcd8]"}`} key={store.id}>
                <span className={`grid size-9 shrink-0 place-items-center rounded-lg ${storeAdmins.length ? "bg-[#e5f4ea] text-[#2c7a4f]" : "bg-[#fdecea] text-[#b2433a]"}`}>
                  <Icon path={storeAdmins.length ? icons.store : icons.alert} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-[#102c50]">{t(store.name)}</p>
                  <p className="truncate text-[11px] text-[#8190a1]">{t(store.town)}</p>
                </div>
                {storeAdmins.length ? (
                  <div className="flex -space-x-2">
                    {storeAdmins.slice(0, 3).map((admin) => (
                      <span className="rounded-xl ring-2 ring-white" key={admin.id} title={admin.name}>
                        <Avatar className="size-7" name={admin.name} picture={admin.profilePicture} />
                      </span>
                    ))}
                    {storeAdmins.length > 3 && <span className="grid size-7 place-items-center rounded-xl bg-[#f1f4f8] text-[10px] font-extrabold text-[#65748a] ring-2 ring-white">+{storeAdmins.length - 3}</span>}
                  </div>
                ) : (
                  <button
                    className="inline-flex min-h-8 shrink-0 items-center gap-1 rounded-lg bg-[#092a53] px-2.5 text-[11px] font-bold text-white transition hover:bg-[#163e6b]"
                    onClick={() => openForm(store.id)}
                    type="button"
                  >
                    <Icon className="size-3.5" path={icons.plus} />
                    {t("Assign")}
                  </button>
                )}
              </li>
            ))}
            {!stores.length && !isLoadingAdmins && <li className="rounded-xl bg-[#f7f9fc] p-4 text-center text-sm text-[#8190a1]">{t("No stores found.")}</li>}
          </ul>
        </aside>
      </div>

      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex justify-end" role="presentation">
          <button aria-label={t("Close")} className="admin-drawer-backdrop absolute inset-0 bg-[#0b1e36]/45 backdrop-blur-[2px]" onClick={() => setIsFormOpen(false)} tabIndex={-1} type="button" />
          <section aria-labelledby="add-admin-title" aria-modal="true" className="admin-drawer-panel relative flex h-full w-full max-w-[32rem] flex-col bg-white shadow-[-24px_0_60px_rgba(9,42,83,0.18)]" role="dialog">
            <header className="flex items-start justify-between gap-4 border-b border-[#edf1f5] px-6 py-5">
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#8a7000]">{t("Admin access")}</p>
                <h2 className="mt-1 font-display text-2xl font-extrabold text-[#092a53]" id="add-admin-title">{t("Add an admin")}</h2>
                <p className="mt-1 text-sm text-[#65748a]">{t("Assign this login to one store. It can only access that store’s operational data.")}</p>
              </div>
              <button aria-label={t("Close")} className="grid size-9 shrink-0 place-items-center rounded-xl text-[#65748a] transition hover:bg-[#f1f4f8] hover:text-[#092a53]" onClick={() => setIsFormOpen(false)} type="button">
                <Icon className="size-5" path={icons.close} />
              </button>
            </header>

            <form className="flex min-h-0 flex-1 flex-col" onSubmit={handleSubmit}>
              <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-6">
                <div className="flex items-center gap-4 rounded-2xl bg-[#f7f9fc] p-4 ring-1 ring-[#e8edf3]">
                  <div className="relative">
                    <Avatar className="size-16" name={name || "?"} picture={profilePicture} />
                    <label className="absolute -bottom-1.5 -right-1.5 grid size-7 cursor-pointer place-items-center rounded-full bg-[#092a53] text-white ring-[3px] ring-[#f7f9fc] transition hover:bg-[#163e6b] focus-within:outline-2 focus-within:outline-[#bd9c00]" title={t("Profile picture")}>
                      <span className="sr-only">{t("Profile picture")}</span>
                      <Icon className="size-3.5" path={icons.camera} />
                      <input accept="image/*" className="sr-only" onChange={handleProfilePictureChange} type="file" />
                    </label>
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-display text-lg font-extrabold text-[#092a53]">{name || t("New admin profile preview")}</p>
                    <p className="truncate text-xs text-[#65748a]">{email || t("Email address")}</p>
                    <span className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-[#e9f1fa] px-2 py-0.5 text-[10px] font-bold text-[#245281]">
                      <Icon className="size-3" path={icons.store} />
                      {selectedStore ? t(selectedStore.name) : t("Store admin")}
                    </span>
                  </div>
                </div>
                <p className="-mt-2 text-[11px] text-[#8190a1]">{t("Optional. Image will be resized before saving (5 MB max).")}</p>

                <label className={labelClassName}>
                  {t("Assigned store")}
                  <select className={inputClassName} onChange={(event) => setStoreId(event.target.value)} required value={storeId}>
                    {stores.map((store) => {
                      const assigned = coverage.find((entry) => entry.store.id === store.id)?.admins.length || 0;
                      return <option key={store.id} value={store.id}>{t(store.name)} · {t(store.town)}{assigned ? "" : ` — ${t("No admin yet")}`}</option>;
                    })}
                  </select>
                </label>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className={labelClassName}>
                    {t("Full name")}
                    <input autoComplete="name" className={inputClassName} onChange={(event) => setName(event.target.value)} required value={name} />
                  </label>
                  <label className={labelClassName}>
                    {t("Email address")}
                    <input autoComplete="email" className={inputClassName} onChange={(event) => setEmail(event.target.value)} required type="email" value={email} />
                  </label>
                </div>
                <div>
                  <PasswordField autoComplete="new-password" label={t("Password")} minLength={8} name="password" onChange={(event) => setPassword(event.target.value)} required value={password} />
                  {password && (
                    <div className="mt-2 flex items-center gap-3">
                      <div aria-hidden="true" className="grid flex-1 grid-cols-4 gap-1">
                        {[1, 2, 3, 4].map((step) => (
                          <span className={`h-1.5 rounded-full ${step <= strength ? strengthMeta.color : "bg-[#e6ebf1]"}`} key={step} />
                        ))}
                      </div>
                      <span className="text-[11px] font-bold text-[#65748a]">{strengthMeta.label}</span>
                    </div>
                  )}
                </div>
                <div>
                  <PasswordField autoComplete="new-password" label={t("Confirm password")} minLength={8} name="confirmPassword" onChange={(event) => setConfirmPassword(event.target.value)} required value={confirmPassword} />
                  {confirmPassword && (
                    <p className={`mt-1.5 flex items-center gap-1.5 text-[11px] font-bold ${passwordsMatch ? "text-[#2c7a4f]" : "text-[#b2433a]"}`}>
                      <Icon className="size-3.5" path={passwordsMatch ? icons.check : icons.close} />
                      {t(passwordsMatch ? "Passwords match" : "The passwords do not match.")}
                    </p>
                  )}
                </div>

                <div className="rounded-2xl bg-[#f7f9fc] p-4 ring-1 ring-[#e8edf3]">
                  <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-[#8190a1]">{t("This admin can access")}</p>
                  <ul className="mt-2.5 grid grid-cols-2 gap-x-3 gap-y-1.5">
                    {STORE_ADMIN_PAGES.map((page) => (
                      <li className="flex items-center gap-1.5 text-xs font-semibold text-[#355777]" key={page}>
                        <Icon className="size-3.5 text-[#35a36b]" path={icons.check} />
                        {t(page)}
                      </li>
                    ))}
                  </ul>
                  <p className="mt-3 text-[11px] leading-5 text-[#8190a1]">{t("Catalog, promotions and admin accounts stay owner-only.")}</p>
                </div>

                <p className="flex items-start gap-2 rounded-xl bg-[#fff6e5] px-3.5 py-3 text-xs leading-5 text-[#8a5a00]">
                  <Icon className="mt-0.5 size-4 shrink-0" path={icons.shield} />
                  {t("Only create administrator accounts for people you trust with store access.")}
                </p>

                {error && (
                  <p className="flex items-start gap-2 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 ring-1 ring-red-100" role="alert">
                    <Icon className="mt-0.5 size-4 shrink-0" path={icons.alert} />
                    {error}
                  </p>
                )}
              </div>

              <footer className="flex items-center justify-end gap-3 border-t border-[#edf1f5] bg-[#fafbfd] px-6 py-4">
                <button className="min-h-10 rounded-xl px-4 text-sm font-bold text-[#4f6379] transition hover:bg-[#eef2f6] hover:text-[#092a53]" onClick={() => setIsFormOpen(false)} type="button">{t("Cancel")}</button>
                <button
                  className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-[#092a53] px-5 text-sm font-bold text-white shadow-sm transition hover:bg-[#163e6b] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#bd9c00] disabled:cursor-wait disabled:opacity-60"
                  disabled={isSaving}
                  type="submit"
                >
                  <Icon path={icons.plus} />
                  {isSaving ? t("Creating account…") : t("Create admin account")}
                </button>
              </footer>
            </form>
          </section>
        </div>
      )}

      {adminToRemove && (
        <div className="fixed inset-0 z-50 grid place-items-center px-5" role="presentation">
          <button aria-label={t("Cancel")} className="admin-drawer-backdrop absolute inset-0 bg-[#0b1e36]/45 backdrop-blur-[2px]" onClick={() => setAdminToRemove(null)} tabIndex={-1} type="button" />
          <section aria-labelledby="remove-admin-title" aria-modal="true" className="admin-modal-panel relative w-full max-w-md rounded-[22px] bg-white p-6 shadow-[0_30px_80px_rgba(9,42,83,0.3)]" role="dialog">
            <span className="grid size-12 place-items-center rounded-2xl bg-red-50 text-red-600"><Icon className="size-6" path={icons.trash} /></span>
            <h2 className="mt-4 font-display text-xl font-extrabold text-[#092a53]" id="remove-admin-title">{t("Remove admin access")}</h2>
            <div className="mt-4 flex items-center gap-3 rounded-xl bg-[#f7f9fc] p-3 ring-1 ring-[#e8edf3]">
              <Avatar name={adminToRemove.name} picture={adminToRemove.profilePicture} />
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-[#102c50]">{adminToRemove.name}</p>
                <p className="truncate text-xs text-[#7b8796]">{adminToRemove.email} · {adminToRemove.storeName ? t(adminToRemove.storeName) : t("No store assigned")}</p>
              </div>
            </div>
            <p className="mt-3 text-sm leading-6 text-[#65748a]">
              {t("Remove admin {name} ({email})? They will immediately lose access, and this cannot be undone.", { name: adminToRemove.name, email: adminToRemove.email })}
            </p>
            {error && <p className="mt-3 rounded-xl bg-red-50 px-3 py-2.5 text-sm font-semibold text-red-700" role="alert">{error}</p>}
            <div className="mt-6 flex justify-end gap-2.5">
              <button className="min-h-10 rounded-xl px-4 text-sm font-bold text-[#4f6379] transition hover:bg-[#eef2f6]" onClick={() => setAdminToRemove(null)} type="button">{t("Cancel")}</button>
              <button
                className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-red-600 px-4 text-sm font-bold text-white transition hover:bg-red-700 disabled:cursor-wait disabled:opacity-60"
                disabled={removingAdminId === adminToRemove.id}
                onClick={handleRemoveAdmin}
                type="button"
              >
                <Icon path={icons.trash} />
                {removingAdminId === adminToRemove.id ? t("Removing…") : t("Remove")}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
