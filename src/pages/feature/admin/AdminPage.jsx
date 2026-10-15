import { useEffect, useState } from "react";
import { useLanguage } from "../../../language/useLanguage";
import { Link } from "react-router-dom";
import { useFlavors } from "../../../flavor-context/useFlavors";
import { useAdminAuth } from "./useAdminAuth";
import { useCart } from "../../../useCart";
import { formatCartMoney } from "../../../cartPricing";
import { apiRequest } from "../../../api/api";

const inputClassName =
  "mt-1.5 w-full rounded-xl border border-[#dde4ec] bg-[#f8fafc] px-3.5 py-2.5 text-sm font-medium text-[#102c50] transition placeholder:text-[#9aa5b3] hover:border-[#c9d4e0] focus:border-[#bd9c00] focus:bg-white focus:ring-4 focus:ring-[#ffdc32]/25 outline-none!";
const labelClassName = "block text-xs font-bold text-[#4f6379]";
const MAX_PROFILE_IMAGE_SIZE = 5 * 1024 * 1024;
const PROFILE_IMAGE_DIMENSION = 256;
const LOW_STOCK_THRESHOLD = 10;

const icons = {
  plus: "M12 5v14M5 12h14",
  upload: "M12 16V4m0 0-4.5 4.5M12 4l4.5 4.5M4 15v4a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-4",
  search: "m20 20-4.2-4.2M10.5 17a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13Z",
  grid: "M4 4h7v7H4V4Zm9 0h7v7h-7V4ZM4 13h7v7H4v-7Zm9 0h7v7h-7v-7Z",
  list: "M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01",
  edit: "M4 20h4L19 9l-4-4L4 16v4Zm9-13 4 4",
  trash: "M4 7h16M10 11v6m4-6v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3",
  eye: "M2.5 12S6 5 12 5s9.5 7 9.5 7-3.5 7-9.5 7-9.5-7-9.5-7Zm9.5 3a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z",
  external: "M14 4h6v6m0-6L10 14M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5",
  close: "M6 6l12 12M18 6 6 18",
  check: "m5 12.5 4.5 4.5L19 7.5",
  alert: "M12 8v5m0 3.5v.01M10.3 3.9 2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z",
  scoop: "M7 10a5 5 0 0 1 10 0M6 10h12l-6 11-6-11Z",
  box: "M4 8l8-4 8 4v8l-8 4-8-4V8Zm0 0 8 4m0 0 8-4m-8 4v8",
  camera: "M4 8h3l2-3h6l2 3h3v11H4V8Zm8 9a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z",
  image: "M4 5h16v14H4V5Zm0 11 4.5-4.5L13 16m-2-2 2.5-2.5L20 18M15.5 9.5h.01",
};

function Icon({ path, className = "size-4" }) {
  return (
    <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 24 24">
      <path d={path} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
    </svg>
  );
}

function stockState(flavor) {
  if (flavor.availableQuantity <= 0) return "sold-out";
  if (flavor.availableQuantity <= LOW_STOCK_THRESHOLD) return "low";
  return "ok";
}

const stockStyles = {
  ok: { badge: "bg-[#eaf6ee] text-[#246a46] ring-[#cfe8d8]", dot: "bg-[#35a36b]", bar: "bg-[#35a36b]", label: "In stock" },
  low: { badge: "bg-[#fff6e5] text-[#9a6200] ring-[#f6dfb0]", dot: "bg-[#e0a100]", bar: "bg-[#e0a100]", label: "Low stock" },
  "sold-out": { badge: "bg-[#fdeeee] text-[#a53f37] ring-[#f3d1ce]", dot: "bg-[#d2544b]", bar: "bg-[#d2544b]", label: "Sold out" },
};

function StockBadge({ flavor, t }) {
  const style = stockStyles[stockState(flavor)];
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 ${style.badge}`}>
      <span aria-hidden="true" className={`size-1.5 rounded-full ${style.dot}`} />
      {t(style.label)}
    </span>
  );
}

function StockMeter({ flavor, t }) {
  const style = stockStyles[stockState(flavor)];
  const total = Math.max(flavor.stock || 0, flavor.availableQuantity, 1);
  const percent = Math.min(100, Math.round((flavor.availableQuantity / total) * 100));
  return (
    <div className="min-w-[7.5rem]">
      <div className="flex items-baseline justify-between gap-2 text-xs">
        <span className="font-extrabold tabular-nums text-[#102c50]">{flavor.availableQuantity}</span>
        <span className="text-[11px] text-[#8190a1]">
          / {flavor.stock}
          {flavor.reservedStock ? ` · ${flavor.reservedStock} ${t("reserved")}` : ""}
        </span>
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[#edf1f5]">
        <div className={`h-full rounded-full ${style.bar}`} style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

function FlavorThumb({ src, alt = "", className = "size-12" }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return (
      <span className={`${className} grid shrink-0 place-items-center rounded-xl bg-[#f1f4f8] text-[#a3b0bf]`}>
        <Icon className="size-5" path={icons.image} />
      </span>
    );
  }
  return (
    <img decoding="async"
      alt={alt}
      className={`${className} shrink-0 rounded-xl bg-[#f1f4f8] object-cover`}
      loading="lazy"
      onError={() => setFailed(true)}
      src={src}
    />
  );
}

const FLAVOR_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const FLAVOR_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
const FLAVOR_IMAGE_MAX_DIMENSION = 1600;

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => (typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("Could not read the selected image.")));
    reader.onerror = () => reject(new Error("Could not read the selected image."));
    reader.readAsDataURL(file);
  });
}

// Phone photos are often several megabytes, so large stills are scaled down before upload.
// GIFs are sent as they are so animations are kept.
async function prepareFlavorImage(file) {
  if (file.type === "image/gif" || typeof createImageBitmap !== "function") return readFileAsDataUrl(file);
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, FLAVOR_IMAGE_MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
  if (scale === 1 && file.size <= 1.5 * 1024 * 1024) {
    bitmap.close();
    return readFileAsDataUrl(file);
  }
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const context = canvas.getContext("2d");
  if (!context) {
    bitmap.close();
    return readFileAsDataUrl(file);
  }
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  // WebP keeps transparent backgrounds; browsers that cannot encode it fall back to JPEG.
  const webp = canvas.toDataURL("image/webp", 0.85);
  return webp.startsWith("data:image/webp") ? webp : canvas.toDataURL("image/jpeg", 0.85);
}

function FlavorDrawer({ mode, values, onChange, onSubmit, onClose, isSaving, error, reservedStock, t }) {
  const isEdit = mode === "edit";
  const price = Number(values.price);
  const { sessionToken } = useAdminAuth();
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [isDraggingImage, setIsDraggingImage] = useState(false);

  async function uploadImageFile(file) {
    if (!file) return;
    setUploadError("");
    if (!FLAVOR_IMAGE_TYPES.includes(file.type)) {
      setUploadError(t("Choose a JPEG, PNG, WebP, or GIF image."));
      return;
    }
    if (file.type === "image/gif" && file.size > FLAVOR_IMAGE_MAX_BYTES) {
      setUploadError(t("Choose an image smaller than 5 MB."));
      return;
    }
    setIsUploadingImage(true);
    try {
      const dataUrl = await prepareFlavorImage(file);
      const { image } = await apiRequest("/admin/uploads", {
        method: "POST",
        token: sessionToken,
        body: { dataUrl },
      });
      onChange({ target: { name: "image", value: image } });
    } catch (imageError) {
      setUploadError(imageError instanceof Error ? imageError.message : t("Unable to upload the selected image."));
    } finally {
      setIsUploadingImage(false);
    }
  }

  function handleImageFileChange(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    uploadImageFile(file);
  }

  function handleImageDrop(event) {
    event.preventDefault();
    setIsDraggingImage(false);
    uploadImageFile(event.dataTransfer.files?.[0]);
  }
  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="presentation">
      <button
        aria-label={t("Close")}
        className="admin-drawer-backdrop absolute inset-0 bg-[#0b1e36]/45 backdrop-blur-[2px]"
        onClick={onClose}
        tabIndex={-1}
        type="button"
      />
      <section
        aria-labelledby="flavor-drawer-title"
        aria-modal="true"
        className="admin-drawer-panel relative flex h-full w-full max-w-[34rem] flex-col bg-white shadow-[-24px_0_60px_rgba(9,42,83,0.18)]"
        role="dialog"
      >
        <header className="flex items-start justify-between gap-4 border-b border-[#edf1f5] px-6 py-5">
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#a48700]">
              {t(isEdit ? "Edit flavor" : "Catalog setup")}
            </p>
            <h2 className="mt-1 font-display text-2xl font-extrabold text-[#092a53]" id="flavor-drawer-title">
              {t(isEdit ? "Edit flavor details" : "Add a flavor")}
            </h2>
            <p className="mt-1 text-sm text-[#65748a]">
              {t(isEdit ? "Changes will appear in the shop right away." : "New flavors are saved to the database and appear in the shop.")}
            </p>
          </div>
          <button
            aria-label={t("Close")}
            className="grid size-9 shrink-0 place-items-center rounded-xl text-[#65748a] transition hover:bg-[#f1f4f8] hover:text-[#092a53]"
            onClick={onClose}
            type="button"
          >
            <Icon className="size-5" path={icons.close} />
          </button>
        </header>

        <form className="flex min-h-0 flex-1 flex-col" onSubmit={onSubmit}>
          <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-6 py-6">
            <div className="flex items-center gap-4 rounded-2xl bg-[#f7f9fc] p-3 ring-1 ring-[#e8edf3]">
              <FlavorThumb className="size-20" key={values.image} src={values.image.trim()} />
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#8190a1]">{t("Live preview")}</p>
                <p className="mt-1 truncate font-display text-lg font-extrabold text-[#092a53]">
                  {values.name || t("Flavor name")}
                </p>
                <p className="truncate text-xs text-[#65748a]">{values.detail || t("Short description")}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className="text-sm font-extrabold text-[#102c50]">
                    {Number.isFinite(price) && price > 0 ? formatCartMoney(price, "xaf") : "— FCFA"}
                  </span>
                  {values.tag && (
                    <span className="rounded-full bg-[#ffdc32] px-2 py-0.5 text-[10px] font-extrabold text-[#092a53]">{values.tag}</span>
                  )}
                </div>
              </div>
            </div>

            <fieldset className="space-y-4">
              <legend className="mb-3 text-[11px] font-extrabold uppercase tracking-[0.14em] text-[#8190a1]">{t("Basics")}</legend>
              <label className={labelClassName}>
                {t("Flavor name")}
                <input className={inputClassName} name="name" onChange={onChange} required value={values.name} />
              </label>
              <label className={labelClassName}>
                {t("Short description")}
                <input className={inputClassName} name="detail" onChange={onChange} required value={values.detail} />
              </label>
              <label className={labelClassName}>
                {t("Full description")}
                <textarea className={`${inputClassName} min-h-28 resize-y`} name="description" onChange={onChange} required value={values.description} />
              </label>
            </fieldset>

            <fieldset className="space-y-4">
              <legend className="mb-3 text-[11px] font-extrabold uppercase tracking-[0.14em] text-[#8190a1]">{t("Pricing & stock")}</legend>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className={labelClassName}>
                  {t("Price per scoop (FCFA)")}
                  <span className="relative block">
                    <input className={`${inputClassName} pr-16`} min="1" name="price" onChange={onChange} required step="1" type="number" value={values.price} />
                    <span className="pointer-events-none absolute right-3.5 top-1/2 mt-[3px] -translate-y-1/2 text-[11px] font-extrabold text-[#8190a1]">FCFA</span>
                  </span>
                </label>
                <label className={labelClassName}>
                  {t(isEdit ? "Stock quantity" : "Starting stock")}
                  <input className={inputClassName} min={isEdit ? reservedStock : 0} name="stock" onChange={onChange} required step="1" type="number" value={values.stock} />
                  {isEdit && reservedStock > 0 && (
                    <span className="mt-1 block text-[11px] font-medium text-[#8190a1]">
                      {reservedStock} {t("reserved for pending checkouts.")}
                    </span>
                  )}
                </label>
              </div>
            </fieldset>

            <fieldset className="space-y-4">
              <legend className="mb-3 text-[11px] font-extrabold uppercase tracking-[0.14em] text-[#8190a1]">{t("Presentation")}</legend>
              <div className={labelClassName}>
                {t("Flavor image")}
                <div
                  className={`mt-1.5 flex items-center gap-4 rounded-2xl border-2 border-dashed p-3 transition ${isDraggingImage ? "border-[#bd9c00] bg-[#fffbea]" : "border-[#dde4ec] bg-[#f8fafc]"}`}
                  onDragLeave={() => setIsDraggingImage(false)}
                  onDragOver={(event) => { event.preventDefault(); setIsDraggingImage(true); }}
                  onDrop={handleImageDrop}
                >
                  <FlavorThumb className="size-16" key={values.image} src={values.image.trim()} />
                  <div className="min-w-0 flex-1">
                    <label
                      className={`inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-xl bg-[#092a53] px-4 text-sm font-bold text-white shadow-sm transition hover:bg-[#163e6b] focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[#bd9c00] ${isUploadingImage ? "pointer-events-none opacity-60" : ""}`}
                    >
                      <Icon path={icons.upload} />
                      {isUploadingImage ? t("Uploading…") : t(values.image.trim() ? "Replace image" : "Upload from device")}
                      <input
                        accept="image/jpeg,image/png,image/webp,image/gif"
                        className="sr-only"
                        disabled={isUploadingImage}
                        onChange={handleImageFileChange}
                        type="file"
                      />
                    </label>
                    <p className="mt-1.5 text-[11px] font-medium leading-4 text-[#8190a1]">
                      {t("Choose a photo or drag it here. JPEG, PNG, WebP, or GIF. Large photos are resized automatically.")}
                    </p>
                  </div>
                </div>
                {uploadError && (
                  <p className="mt-2 flex items-start gap-2 text-xs font-semibold text-red-700" role="alert">
                    <Icon className="mt-0.5 size-3.5 shrink-0" path={icons.alert} />
                    {uploadError}
                  </p>
                )}
              </div>
              <label className={labelClassName}>
                {t("Or paste an image URL or path")}
                <input className={inputClassName} name="image" onChange={onChange} placeholder="/images/flavor.jpg" required value={values.image} />
              </label>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className={labelClassName}>
                  {t("Flavor badge")}
                  <input className={inputClassName} name="tag" onChange={onChange} placeholder={t("Fan favorite")} value={values.tag} />
                </label>
                <label className={labelClassName}>
                  {t("Origin")}
                  <input className={inputClassName} name="origin" onChange={onChange} placeholder={t("Local dairy")} value={values.origin} />
                </label>
              </div>
            </fieldset>

            {error && (
              <p className="flex items-start gap-2 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 ring-1 ring-red-100" role="alert">
                <Icon className="mt-0.5 size-4 shrink-0" path={icons.alert} />
                {error}
              </p>
            )}
          </div>

          <footer className="flex items-center justify-end gap-3 border-t border-[#edf1f5] bg-[#fafbfd] px-6 py-4">
            <button
              className="min-h-10 rounded-xl px-4 text-sm font-bold text-[#4f6379] transition hover:bg-[#eef2f6] hover:text-[#092a53]"
              onClick={onClose}
              type="button"
            >
              {t("Cancel")}
            </button>
            <button
              className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-[#092a53] px-5 text-sm font-bold text-white shadow-sm transition hover:bg-[#163e6b] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#bd9c00] disabled:cursor-wait disabled:opacity-60"
              disabled={isSaving || isUploadingImage}
              type="submit"
            >
              <Icon path={isEdit ? icons.check : icons.plus} />
              {isSaving ? t("Saving…") : t(isEdit ? "Save changes" : "Add flavor to shop")}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}

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

const initialForm = {
  name: "",
  detail: "",
  description: "",
  price: "",
  image: "",
  tag: "",
  origin: "",
  stock: "100",
};

export function AdminPage() {
  const {
    flavors,
    loading,
    error: flavorsError,
    addFlavor,
    deleteFlavor,
    updateFlavor,
  } = useFlavors();
  const { currentAdmin, updateProfilePicture } = useAdminAuth();
  const { t } = useLanguage();
  const { removeFromCart, updateCartFlavor } = useCart();
  const [form, setForm] = useState(initialForm);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [flavorToDelete, setFlavorToDelete] = useState(null);
  const [flavorToEdit, setFlavorToEdit] = useState(null);
  const [editForm, setEditForm] = useState(initialForm);
  const [flavorSearch, setFlavorSearch] = useState("");
  const [selectedFlavorTag, setSelectedFlavorTag] = useState("");
  const [stockFilter, setStockFilter] = useState("all");
  const [sortBy, setSortBy] = useState("name");
  const [view, setView] = useState("table");
  const [profilePicture, setProfilePicture] = useState("");
  const [profilePictureError, setProfilePictureError] = useState("");
  const [profilePictureMessage, setProfilePictureMessage] = useState("");
  const [isSavingProfilePicture, setIsSavingProfilePicture] = useState(false);
  const flavorTags = [
    ...new Set(flavors.map((flavor) => flavor.tag).filter(Boolean)),
  ].sort((a, b) => a.localeCompare(b));
  const inStockCount = flavors.filter(
    (flavor) => flavor.availableQuantity > 0,
  ).length;
  const soldOutCount = flavors.length - inStockCount;
  const lowStockCount = flavors.filter((flavor) => stockState(flavor) === "low").length;
  const totalStock = flavors.reduce(
    (sum, flavor) => sum + flavor.availableQuantity,
    0,
  );
  const filteredFlavors = flavors
    .filter((flavor) => {
      const searchText = flavorSearch.trim().toLocaleLowerCase();
      const matchesSearch =
        !searchText ||
        [flavor.name, flavor.detail, flavor.tag].some(
          (value) =>
            value.toLocaleLowerCase().includes(searchText) ||
            t(value).toLocaleLowerCase().includes(searchText),
        );
      const matchesTag = !selectedFlavorTag || flavor.tag === selectedFlavorTag;
      const matchesStock =
        stockFilter === "all" ||
        (stockFilter === "available" && flavor.availableQuantity > 0) ||
        (stockFilter === "low" && stockState(flavor) === "low") ||
        (stockFilter === "sold-out" && flavor.availableQuantity === 0);
      return matchesSearch && matchesTag && matchesStock;
    })
    .sort((a, b) => {
      if (sortBy === "price-asc") return a.price - b.price;
      if (sortBy === "price-desc") return b.price - a.price;
      if (sortBy === "stock") return a.availableQuantity - b.availableQuantity;
      return a.name.localeCompare(b.name);
    });
  const hasActiveFilters = Boolean(flavorSearch.trim() || selectedFlavorTag || stockFilter !== "all");
  const isOverlayOpen = isAddOpen || Boolean(flavorToEdit) || Boolean(flavorToDelete);

  useEffect(() => {
    if (!message) return undefined;
    const timer = window.setTimeout(() => setMessage(""), 5000);
    return () => window.clearTimeout(timer);
  }, [message]);

  useEffect(() => {
    if (!isOverlayOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function handleKeyDown(event) {
      if (event.key !== "Escape") return;
      setIsAddOpen(false);
      setFlavorToEdit(null);
      setFlavorToDelete(null);
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOverlayOpen]);

  async function handleProfilePictureChange(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setProfilePictureError("");
    setProfilePictureMessage("");
    try {
      setProfilePicture(await resizeProfilePicture(file));
    } catch (imageError) {
      console.error("Unable to prepare admin profile picture.", imageError);
      setProfilePicture("");
      setProfilePictureError(
        t(
          imageError instanceof Error
            ? imageError.message
            : "Could not load this profile picture.",
        ),
      );
    }
  }

  async function handleProfilePictureSave() {
    if (!profilePicture) return;
    setProfilePictureError("");
    setProfilePictureMessage("");
    setIsSavingProfilePicture(true);
    try {
      await updateProfilePicture(profilePicture);
      setProfilePicture("");
      setProfilePictureMessage(t("Profile picture updated."));
    } catch (saveError) {
      setProfilePictureError(
        t(
          saveError instanceof Error
            ? saveError.message
            : "Unable to update profile picture.",
        ),
      );
    } finally {
      setIsSavingProfilePicture(false);
    }
  }

  function handleChange(event) {
    const { name, value } = event.target;
    setForm((currentForm) => ({ ...currentForm, [name]: value }));
  }

  function handleEditChange(event) {
    const { name, value } = event.target;
    setEditForm((currentForm) => ({ ...currentForm, [name]: value }));
  }

  function openAddForm() {
    setError("");
    setIsAddOpen(true);
  }

  function openEditForm(flavor) {
    setError("");
    setFlavorToEdit(flavor);
    setEditForm({
      name: flavor.name,
      detail: flavor.detail,
      description: flavor.description,
      price: String(flavor.price),
      image: flavor.image,
      tag: flavor.tag,
      origin: flavor.origin,
      stock: String(flavor.stock),
    });
  }

  function resetFilters() {
    setFlavorSearch("");
    setSelectedFlavorTag("");
    setStockFilter("all");
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setMessage("");
    setError("");
    const price = Number(form.price);
    if (!Number.isSafeInteger(price) || price <= 0) {
      setError("Enter a price greater than zero.");
      return;
    }
    const stock = Number(form.stock);
    if (!Number.isSafeInteger(stock) || stock < 0) {
      setError("Enter a whole-number stock quantity of zero or more.");
      return;
    }

    setIsSaving(true);
    try {
      await addFlavor({
        ...form,
        price,
        stock,
        image: form.image.trim(),
        tag: form.tag.trim() || "New flavor",
        origin: form.origin.trim() || "Not specified",
        color: "bg-[#fff1cf]",
        servings: 2,
        allergies: [],
      });
      setForm(initialForm);
      setIsAddOpen(false);
      setMessage("Flavor added to the shop and saved to the database.");
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDeleteFlavor() {
    if (!flavorToDelete) return;
    setError("");
    setIsDeleting(true);
    try {
      await deleteFlavor(flavorToDelete.id);
      removeFromCart(flavorToDelete.id);
      setMessage(`${flavorToDelete.name} was removed from the shop.`);
      setFlavorToDelete(null);
    } catch (deleteError) {
      setError(deleteError.message);
    } finally {
      setIsDeleting(false);
    }
  }

  async function handleUpdateFlavor(event) {
    event.preventDefault();
    if (!flavorToEdit) return;

    const price = Number(editForm.price);
    if (!Number.isSafeInteger(price) || price <= 0) {
      setError("Enter a price greater than zero.");
      return;
    }
    const stock = Number(editForm.stock);
    if (!Number.isSafeInteger(stock) || stock < 0) {
      setError("Enter a whole-number stock quantity of zero or more.");
      return;
    }

    const updatedFlavor = {
      ...flavorToEdit,
      ...editForm,
      price,
      stock,
      image: editForm.image.trim(),
      tag: editForm.tag.trim() || "New flavor",
      origin: editForm.origin.trim() || "Not specified",
    };
    setError("");
    setIsSaving(true);
    try {
      const savedFlavor = await updateFlavor(flavorToEdit.id, updatedFlavor);
      updateCartFlavor(savedFlavor);
      setMessage(`${savedFlavor.name} was updated.`);
      setFlavorToEdit(null);
    } catch (updateError) {
      setError(updateError.message);
    } finally {
      setIsSaving(false);
    }
  }

  const metrics = [
    { label: "Total flavors", value: flavors.length, icon: icons.scoop, accent: "bg-[#fff4c2] text-[#8a6f00]", filter: "all" },
    { label: "In stock", value: inStockCount, icon: icons.check, accent: "bg-[#e5f4ea] text-[#2c7a4f]", filter: "available" },
    { label: "Low stock", value: lowStockCount, icon: icons.alert, accent: "bg-[#fff1dc] text-[#a86a00]", filter: "low" },
    { label: "Sold out", value: soldOutCount, icon: icons.close, accent: "bg-[#fdecea] text-[#b2433a]", filter: "sold-out" },
  ];

  const rowActions = (flavor) => (
    <div className="flex items-center justify-end gap-1">
      <Link
        aria-label={`${t("View")} ${flavor.name}`}
        className="grid size-8 place-items-center rounded-lg text-[#6b7d91] transition hover:bg-[#eef2f7] hover:text-[#092a53]"
        title={t("View")}
        to={`/flavor/${flavor.id}`}
      >
        <Icon path={icons.eye} />
      </Link>
      <button
        aria-label={`${t("Edit")} ${flavor.name}`}
        className="grid size-8 place-items-center rounded-lg text-[#6b7d91] transition hover:bg-[#eef2f7] hover:text-[#092a53] focus-visible:outline-2 focus-visible:outline-[#bd9c00]"
        onClick={() => openEditForm(flavor)}
        title={t("Edit")}
        type="button"
      >
        <Icon path={icons.edit} />
      </button>
      <button
        aria-label={`${t("Delete")} ${flavor.name}`}
        className="grid size-8 place-items-center rounded-lg text-[#6b7d91] transition hover:bg-red-50 hover:text-red-600 focus-visible:outline-2 focus-visible:outline-red-400"
        onClick={() => setFlavorToDelete(flavor)}
        title={t("Delete")}
        type="button"
      >
        <Icon path={icons.trash} />
      </button>
    </div>
  );

  return (
    <div className="min-w-0 space-y-6">
      {/* Page header */}
      <header className="flex flex-col gap-5 border-b border-[#edf1f5] pb-6 xl:flex-row xl:items-end xl:justify-between">
        <div className="flex min-w-0 items-center gap-4">
          <div className="group relative shrink-0">
            {profilePicture || currentAdmin?.profilePicture ? (
              <img decoding="async" loading="lazy"
                alt=""
                className="size-16 rounded-2xl object-cover ring-1 ring-[#e2e8f0]"
                src={profilePicture || currentAdmin.profilePicture}
              />
            ) : (
              <span
                aria-hidden="true"
                className="grid size-16 place-items-center rounded-2xl bg-[#ffdc32] font-display text-2xl font-extrabold text-[#092a53]"
              >
                {currentAdmin?.name?.charAt(0).toUpperCase()}
              </span>
            )}
            <label
              className="absolute -bottom-1.5 -right-1.5 grid size-7 cursor-pointer place-items-center rounded-full bg-[#092a53] text-white ring-[3px] ring-white transition hover:bg-[#163e6b] focus-within:outline-2 focus-within:outline-[#bd9c00]"
              title={t(currentAdmin?.profilePicture ? "Change profile picture" : "Add profile picture")}
            >
              <span className="sr-only">
                {t(currentAdmin?.profilePicture ? "Change profile picture" : "Add profile picture")}
              </span>
              <Icon className="size-3.5" path={icons.camera} />
              <input accept="image/*" className="sr-only" onChange={handleProfilePictureChange} type="file" />
            </label>
          </div>
          <div className="min-w-0">
            <nav aria-label={t("Breadcrumb")} className="text-[11px] font-bold text-[#8190a1]">
              {t("Catalog")} <span aria-hidden="true" className="mx-1">/</span>
              <span className="text-[#a48700]">{t("Flavors")}</span>
            </nav>
            <h1 className="mt-1 truncate font-display text-2xl font-extrabold tracking-tight text-[#092a53] sm:text-[1.9rem]">
              {t("Welcome, {name}", { name: currentAdmin?.name || "Admin" })}
            </h1>
            <p className="mt-0.5 text-sm text-[#65748a]">
              {t("Add a flavor and manage the list of flavors available in your shop.")}
            </p>
            {profilePicture && (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <button
                  className="inline-flex min-h-8 items-center gap-1.5 rounded-lg bg-[#ffdc32] px-3 text-xs font-extrabold text-[#092a53] transition hover:bg-[#ffe76c] disabled:cursor-wait disabled:opacity-60"
                  disabled={isSavingProfilePicture}
                  onClick={handleProfilePictureSave}
                  type="button"
                >
                  <Icon className="size-3.5" path={icons.check} />
                  {t(isSavingProfilePicture ? "Saving…" : "Save profile picture")}
                </button>
                <button
                  className="min-h-8 rounded-lg px-3 text-xs font-bold text-[#65748a] transition hover:bg-[#f1f4f8]"
                  onClick={() => setProfilePicture("")}
                  type="button"
                >
                  {t("Cancel")}
                </button>
              </div>
            )}
            {profilePictureError && (
              <p className="mt-1.5 text-xs font-semibold text-red-700" role="alert">{profilePictureError}</p>
            )}
            {profilePictureMessage && (
              <p className="mt-1.5 text-xs font-semibold text-[#2c7a4f]" role="status">{profilePictureMessage}</p>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <Link
            className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-[#dce5ef] bg-white px-4 text-sm font-bold text-[#355777] transition hover:border-[#bacbdc] hover:bg-[#f6f9fc] hover:text-[#092a53] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#bd9c00]"
            to="/flavors"
          >
            <Icon path={icons.external} />
            {t("View customer shop")}
          </Link>
          <button
            className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-[#092a53] px-4 text-sm font-bold text-white shadow-[0_6px_16px_rgba(9,42,83,0.18)] transition hover:-translate-y-0.5 hover:bg-[#163e6b] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#bd9c00]"
            onClick={openAddForm}
            type="button"
          >
            <Icon path={icons.plus} />
            {t("Add a flavor")}
          </button>
        </div>
      </header>

      {message && (
        <div
          className="flex items-center justify-between gap-3 rounded-xl bg-[#eaf6ee] px-4 py-3 text-sm font-semibold text-[#1f5d3c] ring-1 ring-[#cfe8d8]"
          role="status"
        >
          <span className="flex items-center gap-2">
            <Icon path={icons.check} />
            {t(message)}
          </span>
          <button
            aria-label={t("Dismiss")}
            className="grid size-7 place-items-center rounded-lg transition hover:bg-[#d7eedf]"
            onClick={() => setMessage("")}
            type="button"
          >
            <Icon className="size-3.5" path={icons.close} />
          </button>
        </div>
      )}

      {/* Metrics */}
      <section aria-label={t("Flavor inventory overview")} className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {metrics.map((metric) => {
          const isActive = stockFilter === metric.filter && metric.filter !== "all";
          return (
            <button
              aria-pressed={isActive}
              className={`group rounded-2xl border bg-white p-4 text-left transition hover:-translate-y-0.5 hover:shadow-[0_12px_26px_rgba(18,44,80,0.07)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#bd9c00] sm:p-5 ${
                isActive ? "border-[#092a53] shadow-[0_0_0_1px_#092a53]" : "border-[#e5ebf3]"
              }`}
              key={metric.label}
              onClick={() => setStockFilter(isActive ? "all" : metric.filter)}
              type="button"
            >
              <div className="flex items-center justify-between gap-2">
                <span className={`grid size-9 place-items-center rounded-xl ${metric.accent}`}>
                  <Icon path={metric.icon} />
                </span>
                {metric.filter !== "all" && (
                  <span className="text-[10px] font-bold text-[#a3b0bf] opacity-0 transition group-hover:opacity-100">
                    {t(isActive ? "Clear filter" : "Filter")}
                  </span>
                )}
              </div>
              <p className="mt-4 font-display text-[1.75rem] font-extrabold leading-none tracking-tight text-[#102c50]">
                {metric.value.toLocaleString()}
              </p>
              <p className="mt-1.5 text-xs font-semibold text-[#65748a]">{t(metric.label)}</p>
            </button>
          );
        })}
      </section>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl bg-[#f7f9fc] px-4 py-3 text-xs ring-1 ring-[#e8edf3]">
        <span className="flex items-center gap-2 font-bold text-[#4f6379]">
          <Icon className="size-4 text-[#8190a1]" path={icons.box} />
          {totalStock.toLocaleString()} {t("Units in stock")}
        </span>
        {flavors.length > 0 && (
          <div aria-hidden="true" className="flex h-2 min-w-40 flex-1 overflow-hidden rounded-full bg-[#e6ebf1]">
            <span className="bg-[#35a36b]" style={{ width: `${((inStockCount - lowStockCount) / flavors.length) * 100}%` }} />
            <span className="bg-[#e0a100]" style={{ width: `${(lowStockCount / flavors.length) * 100}%` }} />
            <span className="bg-[#d2544b]" style={{ width: `${(soldOutCount / flavors.length) * 100}%` }} />
          </div>
        )}
        <span className="font-semibold text-[#8190a1]">
          {t("Low stock = {count} or fewer available", { count: LOW_STOCK_THRESHOLD })}
        </span>
      </div>

      {/* Catalog */}
      <section aria-labelledby="flavor-catalog-title" className="min-w-0 rounded-[20px] border border-[#e5ebf3] bg-white">
        <div className="flex flex-col gap-4 border-b border-[#edf1f5] p-4 sm:p-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="font-display text-xl font-extrabold text-[#092a53]" id="flavor-catalog-title">
                {t("Available flavors")}
              </h2>
              <p aria-live="polite" className="mt-0.5 text-xs text-[#65748a]">
                {t("Showing {shown} of {total} flavors", { shown: filteredFlavors.length, total: flavors.length })}
              </p>
            </div>
            <div aria-label={t("View")} className="inline-flex rounded-xl bg-[#f1f4f8] p-1" role="group">
              {[
                { key: "table", icon: icons.list, label: t("Table view") },
                { key: "grid", icon: icons.grid, label: t("Grid view") },
              ].map((option) => (
                <button
                  aria-label={option.label}
                  aria-pressed={view === option.key}
                  className={`grid size-8 place-items-center rounded-lg transition ${
                    view === option.key ? "bg-white text-[#092a53] shadow-sm" : "text-[#8190a1] hover:text-[#092a53]"
                  }`}
                  key={option.key}
                  onClick={() => setView(option.key)}
                  title={option.label}
                  type="button"
                >
                  <Icon path={option.icon} />
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto_auto_auto]">
            <label className="relative block">
              <span className="sr-only">{t("Search flavors")}</span>
              <Icon className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-[#8190a1]" path={icons.search} />
              <input
                className={`${inputClassName} mt-0 pl-10`}
                onChange={(event) => setFlavorSearch(event.target.value)}
                placeholder={t("Search by flavor name or description")}
                type="search"
                value={flavorSearch}
              />
            </label>
            <label className="block">
              <span className="sr-only">{t("Flavor tag")}</span>
              <select
                className={`${inputClassName} mt-0 lg:w-44`}
                onChange={(event) => setSelectedFlavorTag(event.target.value)}
                value={selectedFlavorTag}
              >
                <option value="">{t("All tags")}</option>
                {flavorTags.map((tag) => (
                  <option key={tag} value={tag}>{t(tag)}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="sr-only">{t("Sort by")}</span>
              <select className={`${inputClassName} mt-0 lg:w-44`} onChange={(event) => setSortBy(event.target.value)} value={sortBy}>
                <option value="name">{t("Sort: Name (A–Z)")}</option>
                <option value="price-asc">{t("Sort: Price, low to high")}</option>
                <option value="price-desc">{t("Sort: Price, high to low")}</option>
                <option value="stock">{t("Sort: Lowest stock first")}</option>
              </select>
            </label>
            <div aria-label={t("Stock status")} className="flex overflow-x-auto rounded-xl bg-[#f1f4f8] p-1" role="group">
              {[
                { key: "all", label: t("All") },
                { key: "available", label: t("In stock") },
                { key: "low", label: t("Low stock") },
                { key: "sold-out", label: t("Sold out") },
              ].map((option) => (
                <button
                  aria-pressed={stockFilter === option.key}
                  className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                    stockFilter === option.key ? "bg-white text-[#092a53] shadow-sm" : "text-[#65748a] hover:text-[#092a53]"
                  }`}
                  key={option.key}
                  onClick={() => setStockFilter(option.key)}
                  type="button"
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {(flavorsError || (error && !isOverlayOpen)) && (
          <p className="mx-4 mt-4 flex items-start gap-2 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 ring-1 ring-red-100 sm:mx-5" role="alert">
            <Icon className="mt-0.5 size-4 shrink-0" path={icons.alert} />
            {flavorsError || error}
          </p>
        )}

        {loading ? (
          <div aria-label={t("Loading flavors from the database…")} className="space-y-3 p-4 sm:p-5" role="status">
            {[0, 1, 2, 3].map((row) => (
              <div className="flex animate-pulse items-center gap-4" key={row}>
                <span className="size-12 rounded-xl bg-[#eef2f6]" />
                <span className="h-3 flex-1 rounded bg-[#eef2f6]" />
                <span className="h-3 w-24 rounded bg-[#eef2f6]" />
              </div>
            ))}
          </div>
        ) : filteredFlavors.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-[#f1f4f8] text-[#8190a1]">
              <Icon className="size-5" path={icons.search} />
            </span>
            <p className="mt-4 font-display text-lg font-extrabold text-[#092a53]">
              {t(flavors.length ? "No flavors match your filters." : "No flavors yet")}
            </p>
            <div className="mt-4 flex justify-center gap-2">
              {hasActiveFilters ? (
                <button
                  className="min-h-9 rounded-xl border border-[#dce5ef] px-4 text-xs font-bold text-[#355777] transition hover:bg-[#f6f9fc]"
                  onClick={resetFilters}
                  type="button"
                >
                  {t("Clear filters")}
                </button>
              ) : (
                <button
                  className="inline-flex min-h-9 items-center gap-2 rounded-xl bg-[#092a53] px-4 text-xs font-bold text-white transition hover:bg-[#163e6b]"
                  onClick={openAddForm}
                  type="button"
                >
                  <Icon path={icons.plus} />
                  {t("Add a flavor")}
                </button>
              )}
            </div>
          </div>
        ) : view === "table" ? (
          <div className="relative overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead>
                <tr className="border-b border-[#edf1f5] text-[11px] font-extrabold uppercase tracking-[0.08em] text-[#8190a1]">
                  <th className="px-5 py-3 font-extrabold" scope="col">{t("Flavor")}</th>
                  <th className="px-3 py-3 font-extrabold" scope="col">{t("Badge")}</th>
                  <th className="px-3 py-3 text-right font-extrabold" scope="col">{t("Price")}</th>
                  <th className="px-3 py-3 font-extrabold" scope="col">{t("Stock")}</th>
                  <th className="px-3 py-3 font-extrabold" scope="col">{t("Status")}</th>
                  <th className="px-5 py-3 text-right font-extrabold" scope="col"><span className="sr-only">{t("Actions")}</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f0f3f7]">
                {filteredFlavors.map((flavor) => (
                  <tr className="transition hover:bg-[#fafbfd]" key={flavor.id}>
                    <td className="px-5 py-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <FlavorThumb alt="" src={flavor.image} />
                        <div className="min-w-0">
                          <p className="truncate font-bold text-[#102c50]">{flavor.name}</p>
                          <p className="max-w-[18rem] truncate text-xs text-[#7b8796]">{flavor.detail}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      {flavor.tag ? (
                        <span className="inline-block max-w-[9rem] truncate rounded-full bg-[#fff6cc] px-2.5 py-1 text-[11px] font-bold text-[#7a6300]">
                          {t(flavor.tag)}
                        </span>
                      ) : (
                        <span className="text-[#a3b0bf]">—</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-right font-bold tabular-nums text-[#102c50]">
                      {formatCartMoney(flavor.price, "xaf")}
                    </td>
                    <td className="px-3 py-3"><StockMeter flavor={flavor} t={t} /></td>
                    <td className="px-3 py-3"><StockBadge flavor={flavor} t={t} /></td>
                    <td className="px-5 py-3">{rowActions(flavor)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="grid gap-4 p-4 sm:grid-cols-2 sm:p-5 2xl:grid-cols-3">
            {filteredFlavors.map((flavor) => (
              <article
                className="group flex flex-col overflow-hidden rounded-2xl border border-[#e7edf4] bg-white transition hover:-translate-y-0.5 hover:border-[#cbd8e6] hover:shadow-[0_14px_30px_rgba(16,44,80,0.09)]"
                key={flavor.id}
              >
                <div className="relative h-40 overflow-hidden bg-[#f1f4f7]">
                  <img decoding="async"
                    alt={flavor.name}
                    className="size-full object-cover transition duration-300 group-hover:scale-[1.03]"
                    loading="lazy"
                    src={flavor.image}
                  />
                  <span className="absolute left-3 top-3"><StockBadge flavor={flavor} t={t} /></span>
                  {flavor.tag && (
                    <span className="absolute right-3 top-3 max-w-[50%] truncate rounded-full bg-[#ffdc32] px-2.5 py-1 text-[10px] font-extrabold text-[#092a53] shadow-sm">
                      {t(flavor.tag)}
                    </span>
                  )}
                </div>
                <div className="flex flex-1 flex-col p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="truncate font-display text-lg font-extrabold text-[#123253]">{flavor.name}</h3>
                      <p className="mt-0.5 line-clamp-2 text-xs leading-5 text-[#65748a]">{flavor.detail}</p>
                    </div>
                    <p className="shrink-0 text-sm font-extrabold tabular-nums text-[#123253]">{formatCartMoney(flavor.price, "xaf")}</p>
                  </div>
                  <div className="mt-auto flex items-end justify-between gap-3 border-t border-[#edf1f5] pt-3 [&>div:first-child]:mt-0">
                    <StockMeter flavor={flavor} t={t} />
                    {rowActions(flavor)}
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {isAddOpen && (
        <FlavorDrawer
          error={error}
          isSaving={isSaving}
          mode="add"
          onChange={handleChange}
          onClose={() => setIsAddOpen(false)}
          onSubmit={handleSubmit}
          t={t}
          values={form}
        />
      )}

      {flavorToEdit && (
        <FlavorDrawer
          error={error}
          isSaving={isSaving}
          mode="edit"
          onChange={handleEditChange}
          onClose={() => setFlavorToEdit(null)}
          onSubmit={handleUpdateFlavor}
          reservedStock={flavorToEdit.reservedStock || 0}
          t={t}
          values={editForm}
        />
      )}

      {flavorToDelete && (
        <div className="fixed inset-0 z-50 grid place-items-center px-5" role="presentation">
          <button
            aria-label={t("Cancel")}
            className="admin-drawer-backdrop absolute inset-0 bg-[#0b1e36]/45 backdrop-blur-[2px]"
            onClick={() => setFlavorToDelete(null)}
            tabIndex={-1}
            type="button"
          />
          <section
            aria-labelledby="delete-flavor-title"
            aria-modal="true"
            className="admin-modal-panel relative w-full max-w-md rounded-[22px] bg-white p-6 shadow-[0_30px_80px_rgba(9,42,83,0.3)]"
            role="dialog"
          >
            <span className="grid size-12 place-items-center rounded-2xl bg-red-50 text-red-600">
              <Icon className="size-6" path={icons.trash} />
            </span>
            <h2 className="mt-4 font-display text-xl font-extrabold text-[#092a53]" id="delete-flavor-title">
              {t("Remove this flavor?")}
            </h2>
            <div className="mt-4 flex items-center gap-3 rounded-xl bg-[#f7f9fc] p-3 ring-1 ring-[#e8edf3]">
              <FlavorThumb src={flavorToDelete.image} />
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-[#102c50]">{flavorToDelete.name}</p>
                <p className="text-xs text-[#7b8796]">{formatCartMoney(flavorToDelete.price, "xaf")}</p>
              </div>
            </div>
            <p className="mt-3 text-sm leading-6 text-[#65748a]">
              {t("will be removed from the shop and any saved bags.")}
            </p>
            {error && (
              <p className="mt-3 rounded-xl bg-red-50 px-3 py-2.5 text-sm font-semibold text-red-700" role="alert">{error}</p>
            )}
            <div className="mt-6 flex justify-end gap-2.5">
              <button
                className="min-h-10 rounded-xl px-4 text-sm font-bold text-[#4f6379] transition hover:bg-[#eef2f6]"
                onClick={() => setFlavorToDelete(null)}
                type="button"
              >
                {t("Cancel")}
              </button>
              <button
                className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-red-600 px-4 text-sm font-bold text-white transition hover:bg-red-700 disabled:cursor-wait disabled:opacity-60"
                disabled={isDeleting}
                onClick={handleDeleteFlavor}
                type="button"
              >
                <Icon path={icons.trash} />
                {isDeleting ? t("Deleting…") : t("Delete flavor")}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
