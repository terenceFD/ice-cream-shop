import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { PasswordField } from "../../components/PasswordField";
import { passwordStrength } from "../../components/passwordStrength";
import { useAdminAuth } from "./useAdminAuth";
import { useLanguage } from "../../language/useLanguage";
import { apiRequest } from "../../api/api";
import { AdminPageHeader } from "./AdminPageHeader";

const inputClassName =
  "mt-1.5 w-full rounded-lg border border-[#d1d5db] bg-white px-3 py-2 text-sm text-[#111827] transition placeholder:text-[#6b7280] hover:border-[#c2c8d0] focus:border-[#111827] focus:outline-2 focus:outline-offset-1 focus:outline-[#111827]/40";
const labelClassName = "block text-xs font-medium text-[#6b6b6b]";
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

type AssignmentChoice = {
  value: string;
  title: string;
  description: string;
  badge: string;
  kind: "branch" | "store";
};

type AssignmentGroup = {
  label: string;
  choices: AssignmentChoice[];
};

function AssignmentPicker({
  value,
  groups,
  onChange,
  t,
}: {
  value: string;
  groups: AssignmentGroup[];
  onChange: (value: string) => void;
  t: (value: string) => string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const choices = groups.flatMap((group) => group.choices);
  const selectedChoice = choices.find((choice) => choice.value === value);

  useEffect(() => {
    if (!isOpen) return undefined;
    function handlePointerDown(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setIsOpen(false);
    }
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [isOpen]);

  function handleOptionKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    const option = (event.target as HTMLElement).closest<HTMLElement>("[role='option']");
    if (!option) return;
    const currentIndex = Number(option.dataset.index);
    let nextIndex: number | null = null;
    if (event.key === "ArrowDown") nextIndex = (currentIndex + 1) % choices.length;
    if (event.key === "ArrowUp") nextIndex = (currentIndex - 1 + choices.length) % choices.length;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = choices.length - 1;
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      setIsOpen(false);
      triggerRef.current?.focus();
      return;
    }
    if (nextIndex !== null) {
      event.preventDefault();
      containerRef.current?.querySelector<HTMLElement>(`[data-index="${nextIndex}"]`)?.focus();
      return;
    }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onChange(choices[currentIndex].value);
      setIsOpen(false);
      triggerRef.current?.focus();
    }
  }

  let optionIndex = 0;
  return (
    <div className="relative mt-1.5" ref={containerRef}>
      <button
        aria-controls="admin-assignment-options"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-labelledby="admin-assignment-label"
        aria-required="true"
        className={`group flex min-h-[4.25rem] w-full items-center gap-3 rounded-2xl border bg-white px-4 py-3 text-left shadow-sm transition duration-200 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#ffdc32]/25 ${isOpen ? "border-[#bd9c00] shadow-[0_0_0_1px_#bd9c00]" : "border-[#dbe3ec] hover:border-[#aebdcd] hover:shadow-md"
          }`}
        onClick={() => setIsOpen((open) => !open)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            setIsOpen(true);
            window.setTimeout(() => {
              const selectedIndex = choices.findIndex((choice) => choice.value === value);
              const targetIndex = selectedIndex >= 0 ? selectedIndex : 0;
              containerRef.current?.querySelector<HTMLElement>(`[data-index="${targetIndex}"]`)?.focus();
            }, 0);
          }
        }}
        ref={triggerRef}
        type="button"
      >
        <span className={`grid size-10 shrink-0 place-items-center rounded-xl transition ${selectedChoice?.kind === "branch" ? "bg-[#fff5c4] text-[#bd9c00]" : "bg-[#eaf1f9] text-[#245281]"
          }`}>
          <Icon className="size-[1.15rem]" path={selectedChoice?.kind === "branch" ? icons.shield : icons.store} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-bold text-[#092a53]">
            {selectedChoice ? t(selectedChoice.title) : t("Choose a store or branch")}
          </span>
          <span className="mt-0.5 block truncate text-xs text-[#718198]">
            {selectedChoice ? t(selectedChoice.description) : t("Choose where this admin can access")}
          </span>
        </span>
        {selectedChoice && (
          <span className="hidden shrink-0 rounded-full bg-[#f1f5f9] px-2.5 py-1 text-xs font-bold text-[#526780] sm:inline-flex">
            {t(selectedChoice.badge)}
          </span>
        )}
        <svg aria-hidden="true" className={`size-4 shrink-0 text-[#718198] transition-transform ${isOpen ? "rotate-180" : ""}`} fill="none" viewBox="0 0 20 20">
          <path d="m5 7.5 5 5 5-5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute inset-x-0 top-[calc(100%+0.5rem)] z-30 overflow-hidden rounded-2xl border border-[#dce3eb] bg-white shadow-[0_18px_48px_rgba(9,42,83,0.18)] ring-1 ring-black/[0.03]">
          <div className="border-b border-[#f4f6f8] bg-[#f4f6f8] px-4 py-3">
            <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-[#65748a]">{t("Choose access scope")}</p>
            <p className="mt-0.5 text-xs text-[#65748a]">{t("Select a main branch or an individual store.")}</p>
          </div>
          <div
            aria-label={t("Assigned store or branch")}
            className="max-h-72 overflow-y-auto p-2"
            id="admin-assignment-options"
            onKeyDown={handleOptionKeyDown}
            role="listbox"
          >
            {groups.map((group) => (
              group.choices.length > 0 && (
                <div className="py-1" key={group.label}>
                  <p className="px-2.5 pb-1.5 pt-2 text-xs font-extrabold uppercase tracking-[0.12em] text-[#8794a4]">{t(group.label)}</p>
                  <div className="space-y-1">
                    {group.choices.map((choice) => {
                      const index = optionIndex++;
                      const isSelected = choice.value === value;
                      return (
                        <div
                          aria-selected={isSelected}
                          className={`flex cursor-pointer items-center gap-3 rounded-xl px-2.5 py-2.5 outline-none transition focus-visible:ring-2 focus-visible:ring-[#bd9c00] ${isSelected ? "bg-[#f1f6fb]" : "hover:bg-[#f4f6f8]"
                            }`}
                          data-index={index}
                          id={`admin-assignment-option-${index}`}
                          key={choice.value}
                          onClick={() => {
                            onChange(choice.value);
                            setIsOpen(false);
                            triggerRef.current?.focus();
                          }}
                          role="option"
                          tabIndex={-1}
                        >
                          <span className={`grid size-9 shrink-0 place-items-center rounded-xl ${choice.kind === "branch" ? "bg-[#fff5c4] text-[#bd9c00]" : "bg-[#eaf1f9] text-[#245281]"
                            }`}>
                            <Icon className="size-4" path={choice.kind === "branch" ? icons.shield : icons.store} />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-bold text-[#092a53]">{t(choice.title)}</span>
                            <span className="mt-0.5 block truncate text-xs text-[#718198]">{t(choice.description)}</span>
                          </span>
                          <span className="shrink-0 text-xs font-semibold text-[#718198]">{t(choice.badge)}</span>
                          {isSelected && <Icon className="size-4 shrink-0 text-[#26744b]" path={icons.check} />}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function AdminManagementPage() {
  const { t } = useLanguage();
  const { admins, currentAdmin, createAdmin, removeAdmin, refreshAdmins, sessionToken } = useAdminAuth();
  const [stores, setStores] = useState<{ id: number; name: string; town: string; area: string }[]>([]);
  const [assignment, setAssignment] = useState("");
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
  const [roleFilter, setRoleFilter] = useState<"all" | "owner" | "store_admin" | "branch_admin">("all");
  const isOverlayOpen = isFormOpen || Boolean(adminToRemove);

  useEffect(() => {
    Promise.all([
      refreshAdmins(),
      apiRequest<{ stores: typeof stores }>("/admin/stores?storeTown=all", { token: sessionToken }),
    ]).then(([, result]) => {
      setStores(result.stores);
      setAssignment(result.stores[0] ? `store:${result.stores[0].id}` : "");
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
    function handleKeyDown(event: globalThis.KeyboardEvent) {
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
  const storeAdminCount = admins.filter((admin) => admin.role === "store_admin").length;
  const branchAdminCount = admins.filter((admin) => admin.role === "branch_admin").length;
  const towns = ["Douala", "Yaoundé"].filter((town) => stores.some((store) => store.town === town));
  const coverage = useMemo(() => stores.map((store) => ({
    store,
    storeAdmins: admins.filter((admin) => admin.role === "store_admin" && admin.storeId === store.id),
    branchAdmins: admins.filter((admin) => admin.role === "branch_admin" && admin.branchTown === store.town),
  })), [admins, stores]);
  const uncoveredCount = coverage.filter((entry) => !entry.storeAdmins.length && !entry.branchAdmins.length).length;

  const visibleAdmins = useMemo(() => {
    const query = search.trim().toLowerCase();
    return admins
      .filter((admin) => roleFilter === "all" || admin.role === roleFilter)
      .filter((admin) => !query || [admin.name, admin.email, admin.storeName, admin.branchTown].some((value) => String(value || "").toLowerCase().includes(query)))
      .sort((a, b) => (a.role === b.role
        ? a.name.localeCompare(b.name)
        : a.role === "owner" ? -1 : b.role === "owner" ? 1 : a.role === "branch_admin" ? -1 : 1));
  }, [admins, roleFilter, search]);

  function openForm(presetStoreId?: number) {
    setError("");
    setMessage("");
    if (presetStoreId) setAssignment(`store:${presetStoreId}`);
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
    if (!assignment) {
      setError(t("Choose a store or branch."));
      return;
    }
    if (password !== confirmPassword) {
      setError(t("The passwords do not match."));
      return;
    }

    setIsSaving(true);
    try {
      const [assignmentType, assignmentValue] = assignment.split(":", 2);
      await createAdmin({
        name,
        email,
        password,
        profilePicture,
        ...(assignmentType === "branch" ? { branchTown: assignmentValue } : { storeId: Number(assignmentValue) }),
      });

      setName("");
      setEmail("");
      setPassword("");
      setConfirmPassword("");
      setProfilePicture("");
      setAssignment(stores[0] ? `store:${stores[0].id}` : "");
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
    { label: t("Fair"), color: "bg-[#bd9c00]" },
    { label: t("Good"), color: "bg-[#35a36b]" },
    { label: t("Strong"), color: "bg-[#1f7a46]" },
  ][password ? strength : 0];
  const passwordsMatch = confirmPassword.length > 0 && password === confirmPassword;
  const [assignmentType, assignmentValue] = assignment.split(":", 2);
  const selectedStore = assignmentType === "store"
    ? stores.find((store) => String(store.id) === assignmentValue)
    : null;
  const selectedBranch = assignmentType === "branch" ? assignmentValue : "";
  const assignmentGroups: AssignmentGroup[] = [
    {
      label: "Main branches",
      choices: towns.map((town) => ({
        value: `branch:${town}`,
        title: town,
        description: "All stores in town",
        badge: `${stores.filter((store) => store.town === town).length} stores`,
        kind: "branch",
      })),
    },
    {
      label: "Individual stores",
      choices: stores.map((store) => {
        const storeCoverage = coverage.find((entry) => entry.store.id === store.id);
        const assignedStoreAdmins = storeCoverage?.storeAdmins.length || 0;
        const hasBranchAdmin = (storeCoverage?.branchAdmins.length || 0) > 0;
        return {
          value: `store:${store.id}`,
          title: store.name,
          description: store.town,
          badge: assignedStoreAdmins ? `${assignedStoreAdmins} admins` : hasBranchAdmin ? "Branch access only" : "No admin yet",
          kind: "store",
        };
      }),
    },
  ];

  const coveredStores = Math.max(0, stores.length - uncoveredCount);
  const coveragePercent = stores.length ? Math.round((coveredStores / stores.length) * 100) : 0;

  return (
    <div className="min-w-0 space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <nav aria-label={t("Breadcrumb")} className="text-xs text-[#6b6b6b]">
            {t("Workspace")} <span aria-hidden="true" className="mx-1">/</span>
            {t("Admin accounts")}
          </nav>
          <h1 className="mt-1 text-2xl font-bold tracking-[-0.01em] text-[#111827]">{t("Admin accounts")}</h1>
          <p className="mt-1 text-sm text-[#6b6b6b]">{t("Create separate branch or store admin logins and assign their access.")}</p>
        </div>
        <button
          className="inline-flex h-9 flex-none items-center gap-1.5 rounded-lg bg-[#1d1f20] px-3 text-sm font-medium text-white transition hover:bg-[#3a3d3f] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[#1d1f20] disabled:opacity-50"
          disabled={!stores.length}
          onClick={() => openForm()}
          type="button"
        >
          <Icon path={icons.plus} />
          {t("Add an admin")}
        </button>
      </header>

      {message && (
        <div className="flex items-center justify-between gap-3 rounded-lg bg-[#f4f6f8] px-4 py-3 text-sm font-medium text-[#111827]" role="status">
          <span className="flex items-center gap-2"><Icon className="text-[#247b50]" path={icons.check} />{message}</span>
          <button aria-label={t("Dismiss")} className="grid size-7 shrink-0 place-items-center rounded-lg transition hover:bg-[#e8e8e8]" onClick={() => setMessage("")} type="button">
            <Icon className="size-3.5" path={icons.close} />
          </button>
        </div>
      )}
      {error && !isOverlayOpen && (
        <p className="flex items-start gap-2 rounded-lg bg-[#ffedea] px-4 py-3 text-sm font-medium text-[#831c1e]" role="alert">
          <Icon className="mt-0.5 size-4 shrink-0" path={icons.alert} />
          {error}
        </p>
      )}

      <section aria-label={t("Team overview")} className="grid grid-cols-2 overflow-hidden rounded-lg border border-[#e8e8e8] bg-white xl:grid-cols-4 xl:divide-x xl:divide-[#e8e8e8]">
        <div className={`px-4 py-4 sm:px-5 ${uncoveredCount ? "" : ""}`}>
          <p className="text-xs text-[#6b6b6b]">{t("Admin accounts")}</p>
          <p className="num mt-1.5 text-2xl font-semibold leading-none tracking-[-0.01em] text-[#111827]">{admins.length}</p>
          <p className="mt-1.5 truncate text-xs text-[#6b6b6b]">{t("{percent}% of stores covered", { percent: coveragePercent })}</p>
        </div>
        <div className="border-b border-[#e8e8e8] px-4 py-4 sm:px-5 xl:border-b-0">
          <p className="text-xs text-[#6b6b6b]">{t("Owners")}</p>
          <p className="num mt-1.5 text-2xl font-semibold leading-none tracking-[-0.01em] text-[#111827]">{ownerCount}</p>
          <p className="mt-1.5 truncate text-xs text-[#6b6b6b]">{t("Branch and store admins")} {storeAdminCount + branchAdminCount}</p>
        </div>
        <div className="border-r border-[#e8e8e8] px-4 py-4 sm:px-5 xl:border-r-0">
          <p className="text-xs text-[#6b6b6b]">{t("Stores covered")}</p>
          <p className="num mt-1.5 text-2xl font-semibold leading-none tracking-[-0.01em] text-[#111827]">
            {coveredStores}
            <span className="ml-1 text-sm font-medium text-[#6b6b6b]">/ {stores.length}</span>
          </p>
          <p className="mt-1.5 truncate text-xs text-[#6b6b6b]">{t("Branch and store admins")}</p>
        </div>
        <div className="px-4 py-4 sm:px-5">
          <p className="text-xs text-[#6b6b6b]">{t("Stores without an admin")}</p>
          <p className={`num mt-1.5 text-2xl font-semibold leading-none tracking-[-0.01em] ${uncoveredCount ? "text-[#c4242a]" : "text-[#111827]"}`}>{uncoveredCount}</p>
          <p className="mt-1.5 truncate text-xs text-[#6b6b6b]">{uncoveredCount ? t("Needs an admin assigned") : t("Every store has an admin")}</p>
        </div>
      </section>

      <div className="grid min-w-0 grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <section aria-labelledby="admin-list-title" className="@container min-w-0 overflow-hidden rounded-lg border border-[#e8e8e8] bg-white">
          <div className="flex flex-col gap-3 px-4 pb-3 pt-4 sm:px-5">
            <div>
              <h2 className="text-base font-semibold text-[#111827]" id="admin-list-title">{t("Access roster")}</h2>
              <p className="num mt-0.5 text-xs text-[#6b6b6b]">
                {visibleAdmins.length === 1
                  ? t("1 person in this view")
                  : t("{count} people in this view", { count: visibleAdmins.length })}
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <label className="relative block flex-1">
                <span className="sr-only">{t("Search")}</span>
                <Icon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#6b6b6b]" path={icons.search} />
                <input className={`${inputClassName} mt-0 pl-9`} onChange={(event) => setSearch(event.target.value)} placeholder={t("Name, email, or store")} type="search" value={search} />
              </label>
              <div aria-label={t("Role")} className="inline-flex max-w-full flex-none overflow-x-auto rounded-lg border border-[#d1d5db] p-0.5" role="group">
                {([
                  { key: "all", label: t("All"), count: admins.length },
                  { key: "owner", label: t("Owners"), count: ownerCount },
                  { key: "branch_admin", label: t("Branch admins"), count: branchAdminCount },
                  { key: "store_admin", label: t("Store admins"), count: storeAdminCount },
                ] as const).map((option) => (
                  <button
                    aria-pressed={roleFilter === option.key}
                    className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium transition focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#111827]/40 ${roleFilter === option.key ? "bg-[#eef1f5] text-[#111827]" : "text-[#6b6b6b] hover:text-[#111827]"}`}
                    key={option.key}
                    onClick={() => setRoleFilter(option.key)}
                    type="button"
                  >
                    {option.label}
                    <span className="num text-[#6b6b6b]">{option.count}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {isLoadingAdmins ? (
            <div className="space-y-3 px-4 py-5 sm:px-5" role="status">
              <span className="sr-only">{t("Loading administrators…")}</span>
              {[0, 1, 2].map((row) => (
                <div aria-hidden="true" className="flex animate-pulse items-center gap-4" key={row}>
                  <span className="size-10 rounded-md bg-[#f3f4f6]" />
                  <span className="h-3.5 flex-1 rounded bg-[#f3f4f6]" />
                  <span className="h-3.5 w-24 rounded bg-[#f3f4f6]" />
                </div>
              ))}
            </div>
          ) : visibleAdmins.length === 0 ? (
            <div className="border-t border-[#e8e8e8] px-6 py-12 text-center">
              <p className="text-sm font-medium text-[#111827]">{t(admins.length ? "No admins match your search." : "No shop admins assigned yet.")}</p>
              {admins.length > 0 && (
                <button
                  className="mt-2 text-sm font-medium text-[#092a53] hover:underline"
                  onClick={() => { setSearch(""); setRoleFilter("all"); }}
                  type="button"
                >
                  {t("Clear filters")}
                </button>
              )}
            </div>
          ) : (
            <ul className="divide-y divide-[#f2f3f5]">
              <li className="hidden px-5 py-2.5 text-xs font-medium text-[#6b6b6b] @[42rem]:grid @[42rem]:grid-cols-[minmax(14rem,1.4fr)_minmax(8rem,0.75fr)_minmax(9rem,1fr)_auto]">
                <span>{t("Admin")}</span>
                <span>{t("Role")}</span>
                <span>{t("Access")}</span>
                <span className="sr-only">{t("Action")}</span>
              </li>
              {visibleAdmins.map((admin) => {
                const isCurrentAdmin = admin.email === currentAdmin?.email;
                const isOwnerAccount = admin.role === "owner";
                const isBranchAccount = admin.role === "branch_admin";
                const accessLabel = isOwnerAccount
                  ? t("All stores")
                  : isBranchAccount
                    ? t(admin.branchTown || "No branch assigned")
                    : admin.storeName ? t(admin.storeName) : t("No store assigned");
                const missingAccess = !isOwnerAccount && ((isBranchAccount && !admin.branchTown) || (!isBranchAccount && !admin.storeName));
                return (
                  <li
                    className={`grid gap-3 px-4 py-4 sm:px-5 @[42rem]:grid-cols-[minmax(14rem,1.4fr)_minmax(8rem,0.75fr)_minmax(9rem,1fr)_auto] @[42rem]:items-center ${isCurrentAdmin ? "bg-[#fffdf3]" : "hover:bg-[#f4f6f8]"
                      } ${removingAdminId === admin.id ? "opacity-50" : ""}`}
                    key={admin.id}
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <Avatar highlight={isCurrentAdmin} name={admin.name} picture={admin.profilePicture} />
                      <div className="min-w-0">
                        <p className="flex flex-wrap items-center gap-2 font-medium text-[#111827]">
                          <span className="truncate">{admin.name}</span>
                          {isCurrentAdmin && (
                            <span className="rounded-full bg-[#111827] px-2 py-0.5 text-xs font-medium text-white">{t("You")}</span>
                          )}
                        </p>
                        <a className="mt-0.5 flex max-w-full items-center gap-1 truncate text-xs text-[#65748a] hover:text-[#092a53] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#bd9c00]" href={`mailto:${admin.email}`}>
                          <Icon className="size-3 shrink-0" path={icons.mail} />
                          <span className="truncate">{admin.email}</span>
                        </a>
                      </div>
                    </div>

                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-[#8e9bab] @[42rem]:sr-only">{t("Role")}</p>
                      <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${isOwnerAccount
                        ? "bg-[#fffbeb] text-[#92400e]"
                        : isBranchAccount
                          ? "bg-[#eef1f5] text-[#111827]"
                          : "bg-[#e8f0fb] text-[#1d4f91]"
                        }`}>
                        <Icon className="size-3.5" path={isOwnerAccount ? icons.crown : isBranchAccount ? icons.shield : icons.store} />
                        {t(isOwnerAccount ? "Owner" : isBranchAccount ? "Branch admin" : "Store admin")}
                      </span>
                    </div>

                    <div className="min-w-0">
                      <p className="text-xs font-medium text-[#6b6b6b] @[42rem]:sr-only">{t("Access")}</p>
                      <p className={`truncate text-sm font-medium ${missingAccess ? "text-[#831c1e]" : "text-[#111827]"}`}>{accessLabel}</p>
                    </div>

                    <div className="flex justify-end">
                      {!isOwnerAccount && !isCurrentAdmin ? (
                        <button
                          aria-label={`${t("Remove")} ${admin.name}`}
                          className="grid size-9 place-items-center rounded-lg text-[#6b6b6b] transition hover:bg-[#ffedea] hover:text-[#831c1e] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#111827]/40 disabled:cursor-wait"
                          disabled={removingAdminId === admin.id}
                          onClick={() => { setError(""); setAdminToRemove(admin); }}
                          title={t("Remove")}
                          type="button"
                        >
                          <Icon path={icons.trash} />
                        </button>
                      ) : (
                        <span className="grid size-9 place-items-center rounded-lg text-[#c3ccd7]" title={t(isOwnerAccount ? "Owner accounts cannot be removed here." : "You cannot remove your own account.")}>
                          <Icon path={icons.lock} />
                        </span>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <aside aria-labelledby="coverage-title" className="overflow-hidden rounded-lg border border-[#e8e8e8] bg-white xl:sticky xl:top-24">
          <div className="border-b border-[#e8e8e8] px-4 py-4 sm:px-5">
            <h2 className="text-base font-semibold text-[#111827]" id="coverage-title">{t("Store coverage")}</h2>
            <p className="mt-0.5 text-xs text-[#6b6b6b]">{t("Every branch should have at least one admin.")}</p>
            {stores.length > 0 && (
              <>
                <div aria-hidden="true" className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#f3f4f6]">
                  <span className="block h-full rounded-full bg-[#111827]" style={{ width: `${coveragePercent}%` }} />
                </div>
                <p className="num mt-2 text-xs text-[#6b6b6b]">
                  {t("{covered} of {total} stores covered", { covered: coveredStores, total: stores.length })}
                </p>
              </>
            )}
          </div>
          <ul className="max-h-[32rem] space-y-0 overflow-y-auto divide-y divide-[#f2f3f5] p-0">
            {coverage.map(({ store, storeAdmins, branchAdmins }) => {
              const hasAdminCoverage = storeAdmins.length > 0 || branchAdmins.length > 0;
              const branchAdminNames = branchAdmins.map((admin) => admin.name).join(", ");
              return (
                <li className={`flex items-center gap-3 px-4 py-3.5 sm:px-5 ${hasAdminCoverage ? "" : "bg-[#fdf7f6]"}`} key={store.id}>
                  <span className={`grid size-9 shrink-0 place-items-center rounded-lg ${hasAdminCoverage ? "bg-[#dcfae5] text-[#04250e]" : "bg-[#ffedea] text-[#831c1e]"}`}>
                    <Icon path={hasAdminCoverage ? icons.check : icons.alert} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-[#111827]">{t(store.name)}</p>
                    <p className="truncate text-xs text-[#6b6b6b]">{t(store.town)}</p>
                    {branchAdmins.length > 0 && (
                      <p className="mt-1 truncate text-xs font-medium text-[#92400e]" title={`${t("Branch admin")}: ${branchAdminNames}`}>
                        {t("Branch admin")}: {branchAdminNames}
                      </p>
                    )}
                  </div>
                  {storeAdmins.length ? (
                    <div className="flex -space-x-2">
                      {storeAdmins.slice(0, 3).map((admin) => (
                        <span className="rounded-lg ring-2 ring-white" key={admin.id} title={admin.name}>
                          <Avatar className="size-7" name={admin.name} picture={admin.profilePicture} />
                        </span>
                      ))}
                      {storeAdmins.length > 3 && <span className="num grid size-7 place-items-center rounded-lg bg-[#f3f4f6] text-xs font-medium text-[#6b6b6b] ring-2 ring-white">+{storeAdmins.length - 3}</span>}
                    </div>
                  ) : (
                    <button
                      className="inline-flex h-8 shrink-0 items-center gap-1 rounded-lg border border-[#d1d5db] bg-white px-2.5 text-xs font-medium text-[#111827] transition hover:border-[#9aa2ad] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#111827]/40"
                      onClick={() => openForm(store.id)}
                      type="button"
                    >
                      <Icon className="size-3.5" path={icons.plus} />
                      {t("Assign")}
                    </button>
                  )}
                </li>
              );
            })}
            {!stores.length && !isLoadingAdmins && <li className="p-6 text-center text-sm text-[#6b6b6b]">{t("No stores found.")}</li>}
          </ul>
        </aside>
      </div>

      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex justify-end" role="presentation">
          <button aria-label={t("Close")} className="admin-drawer-backdrop absolute inset-0 bg-[#0b1e36]/45 backdrop-blur-[2px]" onClick={() => setIsFormOpen(false)} tabIndex={-1} type="button" />
          <section aria-labelledby="add-admin-title" aria-modal="true" className="admin-drawer-panel relative flex h-full w-full max-w-[32rem] flex-col border-l border-[#e8e8e8] bg-white" role="dialog">
            <header className="flex items-start justify-between gap-4 border-b border-[#e8e8e8] px-6 py-5">
              <div>
                <p className="text-xs text-[#6b6b6b]">{t("Admin access")}</p>
                <h2 className="mt-1 text-xl font-semibold text-[#111827]" id="add-admin-title">{t("Add an admin")}</h2>
                <p className="mt-1 text-sm text-[#6b6b6b]">{t("Assign a login to a whole branch or to one store. Branch admins can access only stores in their assigned town.")}</p>
              </div>
              <button aria-label={t("Close")} className="grid size-9 shrink-0 place-items-center rounded-lg text-[#6b6b6b] transition hover:bg-[#f6f7f9] hover:text-[#111827]" onClick={() => setIsFormOpen(false)} type="button">
                <Icon className="size-5" path={icons.close} />
              </button>
            </header>

            <form className="flex min-h-0 flex-1 flex-col" onSubmit={handleSubmit}>
              <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-6">
                <div className="flex items-center gap-4 rounded-lg bg-[#f9fafb] p-4 border border-[#e8e8e8]">
                  <div className="relative">
                    <Avatar className="size-16" name={name || "?"} picture={profilePicture} />
                    <label className="absolute -bottom-1.5 -right-1.5 grid size-7 cursor-pointer place-items-center rounded-full bg-[#111827] text-white ring-[3px] ring-[#f9fafb] transition hover:bg-[#3a3d3f] focus-within:outline-2 focus-within:outline-[#111827]/40" title={t("Profile picture")}>
                      <span className="sr-only">{t("Profile picture")}</span>
                      <Icon className="size-3.5" path={icons.camera} />
                      <input accept="image/*" className="sr-only" onChange={handleProfilePictureChange} type="file" />
                    </label>
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-lg font-semibold text-[#111827]">{name || t("New admin profile preview")}</p>
                    <p className="truncate text-xs text-[#6b6b6b]">{email || t("Email address")}</p>
                    <span className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-[#e8f0fb] px-2 py-0.5 text-xs font-medium text-[#1d4f91]">
                      <Icon className="size-3" path={icons.store} />
                      {selectedStore ? t(selectedStore.name) : selectedBranch ? t(selectedBranch) : t("Store admin")}
                    </span>
                  </div>
                </div>
                <p className="-mt-2 text-xs text-[#6b6b6b]">{t("Optional. Image will be resized before saving (5 MB max).")}</p>

                <div>
                  <span className={labelClassName} id="admin-assignment-label">{t("Assigned store or branch")}</span>
                  <AssignmentPicker groups={assignmentGroups} onChange={setAssignment} t={t} value={assignment} />
                  <p className="mt-2 text-xs leading-4 text-[#6b6b6b]">{t("Branch admins can access every store in the selected town.")}</p>
                </div>
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
                          <span className={`h-1.5 rounded-full ${step <= strength ? strengthMeta.color : "bg-[#dce3eb]"}`} key={step} />
                        ))}
                      </div>
                      <span className="text-xs font-medium text-[#6b6b6b]">{strengthMeta.label}</span>
                    </div>
                  )}
                </div>
                <div>
                  <PasswordField autoComplete="new-password" label={t("Confirm password")} minLength={8} name="confirmPassword" onChange={(event) => setConfirmPassword(event.target.value)} required value={confirmPassword} />
                  {confirmPassword && (
                    <p className={`mt-1.5 flex items-center gap-1.5 text-xs font-medium ${passwordsMatch ? "text-[#247b50]" : "text-[#831c1e]"}`}>
                      <Icon className="size-3.5" path={passwordsMatch ? icons.check : icons.close} />
                      {t(passwordsMatch ? "Passwords match" : "The passwords do not match.")}
                    </p>
                  )}
                </div>

                <div className="rounded-lg bg-[#f9fafb] p-4 border border-[#e8e8e8]">
                  <p className="text-xs font-medium text-[#6b6b6b]">{t("This admin can access")}</p>
                  <ul className="mt-2.5 grid grid-cols-2 gap-x-3 gap-y-1.5">
                    {STORE_ADMIN_PAGES.map((page) => (
                      <li className="flex items-center gap-1.5 text-xs font-medium text-[#111827]" key={page}>
                        <Icon className="size-3.5 text-[#247b50]" path={icons.check} />
                        {t(page)}
                      </li>
                    ))}
                  </ul>
                  <p className="mt-3 text-xs leading-5 text-[#6b6b6b]">{t("Catalog, promotions and admin accounts stay owner-only.")}</p>
                </div>

                <p className="flex items-start gap-2 rounded-lg bg-[#fffbeb] px-3.5 py-3 text-xs leading-5 text-[#92400e]">
                  <Icon className="mt-0.5 size-4 shrink-0" path={icons.shield} />
                  {t("Only create administrator accounts for people you trust with store access.")}
                </p>

                {error && (
                  <p className="flex items-start gap-2 rounded-lg bg-[#ffedea] px-4 py-3 text-sm font-medium text-[#831c1e]" role="alert">
                    <Icon className="mt-0.5 size-4 shrink-0" path={icons.alert} />
                    {error}
                  </p>
                )}
              </div>

              <footer className="flex items-center justify-end gap-3 border-t border-[#e8e8e8] bg-[#f9fafb] px-6 py-4">
                <button className="min-h-10 rounded-lg px-4 text-sm font-medium text-[#6b6b6b] transition hover:bg-[#eef1f5] hover:text-[#111827]" onClick={() => setIsFormOpen(false)} type="button">{t("Cancel")}</button>
                <button
                  className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-[#1d1f20] px-5 text-sm font-medium text-white transition hover:bg-[#3a3d3f] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#111827]/40 disabled:cursor-wait disabled:opacity-60"
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
          <section aria-labelledby="remove-admin-title" aria-modal="true" className="admin-modal-panel relative w-full max-w-md rounded-xl bg-white p-6" role="dialog">
            <span className="grid size-12 place-items-center rounded-lg bg-[#ffedea] text-[#831c1e]"><Icon className="size-6" path={icons.trash} /></span>
            <h2 className="mt-4 text-xl font-semibold text-[#111827]" id="remove-admin-title">{t("Remove admin access")}</h2>
            <div className="mt-4 flex items-center gap-3 rounded-lg bg-[#f9fafb] p-3 border border-[#e8e8e8]">
              <Avatar name={adminToRemove.name} picture={adminToRemove.profilePicture} />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-[#111827]">{adminToRemove.name}</p>
                <p className="truncate text-xs text-[#6b6b6b]">{adminToRemove.email} · {adminToRemove.storeName ? t(adminToRemove.storeName) : t("No store assigned")}</p>
              </div>
            </div>
            <p className="mt-3 text-sm leading-6 text-[#6b6b6b]">
              {t("Remove admin {name} ({email})? They will immediately lose access, and this cannot be undone.", { name: adminToRemove.name, email: adminToRemove.email })}
            </p>
            {error && <p className="mt-3 rounded-lg bg-[#ffedea] px-3 py-2.5 text-sm font-medium text-[#831c1e]" role="alert">{error}</p>}
            <div className="mt-6 flex justify-end gap-2.5">
              <button className="min-h-10 rounded-lg px-4 text-sm font-medium text-[#6b6b6b] transition hover:bg-[#eef1f5]" onClick={() => setAdminToRemove(null)} type="button">{t("Cancel")}</button>
              <button
                className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-[#c4242a] px-4 text-sm font-medium text-white transition hover:bg-[#a51d22] disabled:cursor-wait disabled:opacity-60"
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
