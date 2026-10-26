import { useEffect, useState } from "react";
import { useLanguage } from "../../language/useLanguage";
import { Link } from "react-router-dom";
import { useFlavors } from "../../context/useFlavors";
import { useAdminAuth } from "./useAdminAuth";
import { useCart } from "../../context/useCart";
import { formatCartMoney } from "../../lib/cartPricing";
import { apiRequest } from "../../api/api";
import { prepareImageForUpload, UPLOAD_IMAGE_TYPES, UPLOAD_MAX_BYTES } from "../../lib/prepareUploadImage";
import { stockBarPercent } from "./stockMeter";
import { PINNED_ACTION_CELL, PINNED_ACTION_HEAD } from "./adminTable";
import "./AdminPage.css";

const inputClassName =
  "mt-1.5 w-full rounded-md border border-[#dce3eb] bg-[#f4f6f8] px-3.5 py-2.5 text-sm font-medium text-[#092a53] transition placeholder:text-[#9aa5b3] hover:border-[#dce3eb] focus:border-[#bd9c00] focus:bg-white focus:ring-4 focus:ring-[#ffdc32]/25 outline-none!";
const labelClassName = "block text-xs font-bold text-[#65748a]";
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
  low: { badge: "bg-[#fff6e5] text-[#9a6200] ring-[#f6dfb0]", dot: "bg-[#bd9c00]", bar: "bg-[#bd9c00]", label: "Low stock" },
  "sold-out": { badge: "bg-[#fdeeee] text-[#a53f37] ring-[#f3d1ce]", dot: "bg-[#d2544b]", bar: "bg-[#d2544b]", label: "Sold out" },
};

function StockBadge({ flavor, t }) {
  const style = stockStyles[stockState(flavor)];
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-bold ring-1 ${style.badge}`}>
      <span aria-hidden="true" className={`size-1.5 rounded-full ${style.dot}`} />
      {t(style.label)}
    </span>
  );
}

function StockMeter({ flavor, t }) {
  const style = stockStyles[stockState(flavor)];
  const percent = stockBarPercent(flavor.availableQuantity, LOW_STOCK_THRESHOLD);
  return (
    <div className="min-w-[7.5rem]">
      <div className="flex items-baseline justify-between gap-2 text-xs">
        <span className="font-extrabold tabular-nums text-[#092a53]">{flavor.availableQuantity}</span>
        <span className="text-xs text-[#65748a]">
          {flavor.reservedStock ? `${flavor.reservedStock} ${t("reserved")}` : t("Alert at {count}", { count: LOW_STOCK_THRESHOLD })}
        </span>
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[#f4f6f8]">
        <div className={`h-full rounded-full ${style.bar}`} style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

function FlavorThumb({ src, alt = "", className = "size-12" }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return (
      <span className={`${className} grid shrink-0 place-items-center rounded-md bg-[#f4f6f8] text-[#a3b0bf]`}>
        <Icon className="size-5" path={icons.image} />
      </span>
    );
  }
  return (
    <img decoding="async"
      alt={alt}
      className={`${className} shrink-0 rounded-md bg-[#f4f6f8] object-cover`}
      loading="lazy"
      onError={() => setFailed(true)}
      src={src}
    />
  );
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
    if (!UPLOAD_IMAGE_TYPES.includes(file.type)) {
      setUploadError(t("Choose a JPEG, PNG, WebP, or GIF image."));
      return;
    }
    if (file.type === "image/gif" && file.size > UPLOAD_MAX_BYTES) {
      setUploadError(t("Choose an image smaller than 5 MB."));
      return;
    }
    setIsUploadingImage(true);
    try {
      const dataUrl = await prepareImageForUpload(file);
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
        className="admin-drawer-panel admin-flavor-drawer relative flex h-full w-full max-w-[34rem] flex-col bg-white shadow-[-24px_0_60px_rgba(9,42,83,0.18)]"
        role="dialog"
      >
        <header className="flex items-start justify-between gap-4 border-b border-[#f4f6f8] px-6 py-5">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-[#bd9c00]">
              {t(isEdit ? "Edit flavor" : "Catalog setup")}
            </p>
            <h2 className="mt-1 text-xl font-semibold text-[#092a53]" id="flavor-drawer-title">
              {t(isEdit ? "Edit flavor details" : "Add a flavor")}
            </h2>
            <p className="mt-1 text-sm text-[#65748a]">
              {t(isEdit ? "Changes will appear in the shop right away." : "New flavors are saved to the database and appear in the shop.")}
            </p>
          </div>
          <button
            aria-label={t("Close")}
            className="grid size-9 shrink-0 place-items-center rounded-md text-[#65748a] transition hover:bg-[#f4f6f8] hover:text-[#092a53]"
            onClick={onClose}
            type="button"
          >
            <Icon className="size-5" path={icons.close} />
          </button>
        </header>

        <form className="flex min-h-0 flex-1 flex-col" onSubmit={onSubmit}>
          <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-6 py-6">
            <div className="flex items-center gap-4 rounded-md bg-[#f4f6f8] p-3 ring-1 ring-[#dce3eb]">
              <FlavorThumb className="size-20" key={values.image} src={values.image.trim()} />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-[#65748a]">{t("Live preview")}</p>
                <p className="mt-1 truncate text-sm font-semibold text-[#092a53]">
                  {values.name || t("Flavor name")}
                </p>
                <p className="truncate text-xs text-[#65748a]">{values.detail || t("Short description")}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className="text-sm font-extrabold text-[#092a53]">
                    {Number.isFinite(price) && price > 0 ? formatCartMoney(price, "xaf") : "— FCFA"}
                  </span>
                  {values.tag && (
                    <span className="rounded-full bg-[#ffdc32] px-2 py-0.5 text-xs font-extrabold text-[#092a53]">{values.tag}</span>
                  )}
                </div>
              </div>
            </div>

            <fieldset className="space-y-4">
              <legend className="mb-3 text-xs font-extrabold uppercase tracking-[0.14em] text-[#65748a]">{t("Basics")}</legend>
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
              <legend className="mb-3 text-xs font-extrabold uppercase tracking-[0.14em] text-[#65748a]">{t("Pricing & stock")}</legend>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className={labelClassName}>
                  {t("Price per scoop (FCFA)")}
                  <span className="relative block">
                    <input className={`${inputClassName} pr-16`} min="1" name="price" onChange={onChange} required step="1" type="number" value={values.price} />
                    <span className="pointer-events-none absolute right-3.5 top-1/2 mt-[3px] -translate-y-1/2 text-xs font-extrabold text-[#65748a]">FCFA</span>
                  </span>
                </label>
                <label className={labelClassName}>
                  {t(isEdit ? "Stock quantity" : "Starting stock")}
                  <input className={inputClassName} min={isEdit ? reservedStock : 0} name="stock" onChange={onChange} required step="1" type="number" value={values.stock} />
                  {isEdit && reservedStock > 0 && (
                    <span className="mt-1 block text-xs font-medium text-[#65748a]">
                      {reservedStock} {t("reserved for pending checkouts.")}
                    </span>
                  )}
                </label>
              </div>
            </fieldset>

            <fieldset className="space-y-4">
              <legend className="mb-3 text-xs font-extrabold uppercase tracking-[0.14em] text-[#65748a]">{t("Presentation")}</legend>
              <div className={labelClassName}>
                {t("Flavor image")}
                <div
                  className={`mt-1.5 flex items-center gap-4 rounded-md border-2 border-dashed p-3 transition ${isDraggingImage ? "border-[#bd9c00] bg-[#fffbea]" : "border-[#dce3eb] bg-[#f4f6f8]"}`}
                  onDragLeave={() => setIsDraggingImage(false)}
                  onDragOver={(event) => { event.preventDefault(); setIsDraggingImage(true); }}
                  onDrop={handleImageDrop}
                >
                  <FlavorThumb className="size-16" key={values.image} src={values.image.trim()} />
                  <div className="min-w-0 flex-1">
                    <label
                      className={`inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-md bg-[#092a53] px-4 text-sm font-bold text-white shadow-sm transition hover:bg-[#163e6b] focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[#bd9c00] ${isUploadingImage ? "pointer-events-none opacity-60" : ""}`}
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
                    <p className="mt-1.5 text-xs font-medium leading-4 text-[#65748a]">
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
              <p className="flex items-start gap-2 rounded-md bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 ring-1 ring-red-100" role="alert">
                <Icon className="mt-0.5 size-4 shrink-0" path={icons.alert} />
                {error}
              </p>
            )}
          </div>

          <footer className="flex items-center justify-end gap-3 border-t border-[#f4f6f8] bg-[#f4f6f8] px-6 py-4">
            <button
              className="min-h-10 rounded-md px-4 text-sm font-bold text-[#65748a] transition hover:bg-[#f4f6f8] hover:text-[#092a53]"
              onClick={onClose}
              type="button"
            >
              {t("Cancel")}
            </button>
            <button
              className="inline-flex min-h-10 items-center gap-2 rounded-md bg-[#092a53] px-5 text-sm font-bold text-white shadow-sm transition hover:bg-[#163e6b] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#bd9c00] disabled:cursor-wait disabled:opacity-60"
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
    { label: "Total flavors", value: flavors.length, filter: "all" },
    { label: "In stock", value: inStockCount, filter: "available" },
    { label: "Low stock", value: lowStockCount, filter: "low" },
    { label: "Sold out", value: soldOutCount, filter: "sold-out" },
  ];

  const rowActions = (flavor) => (
    <div className="flex items-center justify-end gap-1">
      <Link
        aria-label={`${t("View")} ${flavor.name}`}
        className="grid size-8 place-items-center rounded-lg text-[#65748a] transition hover:bg-[#f4f6f8] hover:text-[#092a53]"
        title={t("View")}
        to={`/flavor/${flavor.id}`}
      >
        <Icon path={icons.eye} />
      </Link>
      <button
        aria-label={`${t("Edit")} ${flavor.name}`}
        className="grid size-8 place-items-center rounded-lg text-[#65748a] transition hover:bg-[#f4f6f8] hover:text-[#092a53] focus-visible:outline-2 focus-visible:outline-[#bd9c00]"
        onClick={() => openEditForm(flavor)}
        title={t("Edit")}
        type="button"
      >
        <Icon path={icons.edit} />
      </button>
      <button
        aria-label={`${t("Delete")} ${flavor.name}`}
        className="grid size-8 place-items-center rounded-lg text-[#65748a] transition hover:bg-red-50 hover:text-red-600 focus-visible:outline-2 focus-visible:outline-red-400"
        onClick={() => setFlavorToDelete(flavor)}
        title={t("Delete")}
        type="button"
      >
        <Icon path={icons.trash} />
      </button>
    </div>
  );

  return (
    <div className="admin-flavors-page min-w-0 space-y-6">
      <header className="admin-flavors-header flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
        <div className="min-w-0">
          <h1 className="admin-flavors-title text-xl font-semibold tracking-tight text-[#092a53]">
            {t("Flavors")}
          </h1>
          <p className="mt-1 text-sm text-[#65748a]">
              {t("Add a flavor and manage the list of flavors available in your shop.")}
          </p>
        </div>
        <div className="admin-flavor-header-actions flex flex-wrap gap-2.5">
          <Link
            className="admin-flavor-secondary inline-flex min-h-10 items-center gap-2 rounded-md border border-[#dce5ef] bg-white px-4 text-sm font-bold text-[#123b68] transition hover:border-[#bacbdc] hover:bg-[#f4f6f8] hover:text-[#092a53] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#bd9c00]"
            to="/flavors"
          >
            <Icon path={icons.external} />
            {t("View customer shop")}
          </Link>
          <button
            className="admin-flavor-primary inline-flex min-h-10 items-center gap-2 rounded-md bg-[#092a53] px-4 text-sm font-bold text-white transition hover:bg-[#163e6b] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#bd9c00]"
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
          className="admin-flavor-message flex items-center justify-between gap-3 rounded-md bg-[#eaf6ee] px-4 py-3 text-sm font-semibold text-[#1f5d3c] ring-1 ring-[#cfe8d8]"
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
      <section aria-label={t("Flavor inventory overview")} className="admin-flavor-stats admin-stats grid grid-cols-2 gap-3 xl:grid-cols-4">
        {metrics.map((metric) => {
          const isActive = stockFilter === metric.filter;
          return (
            <button
              aria-pressed={isActive}
              className={`admin-flavor-stat group text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#bd9c00] ${isActive ? "is-active" : ""}`}
              key={metric.label}
              onClick={() => setStockFilter(isActive ? "all" : metric.filter)}
              type="button"
            >
              <span className="admin-flavor-stat-label">{t(metric.label)}</span>
              <span className="admin-flavor-stat-value">{metric.value.toLocaleString()}</span>
            </button>
          );
        })}
      </section>

      <div className="admin-inventory-summary flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
        <span className="admin-inventory-total">
          <span className="admin-inventory-total-value">{totalStock.toLocaleString()}</span>
          <span>{t("Units in stock")}</span>
        </span>
        {flavors.length > 0 && (
          <div aria-hidden="true" className="admin-stock-breakdown flex h-2 min-w-40 flex-1 overflow-hidden rounded-full bg-[#dce3eb]">
            <span className="admin-stock-breakdown-available bg-[#35a36b]" style={{ width: `${((inStockCount - lowStockCount) / flavors.length) * 100}%` }} />
            <span className="admin-stock-breakdown-low bg-[#bd9c00]" style={{ width: `${(lowStockCount / flavors.length) * 100}%` }} />
            <span className="admin-stock-breakdown-sold bg-[#d2544b]" style={{ width: `${(soldOutCount / flavors.length) * 100}%` }} />
          </div>
        )}
        <span className="admin-inventory-threshold">
          {t("Low stock = {count} or fewer available", { count: LOW_STOCK_THRESHOLD })}
        </span>
      </div>

      {/* Catalog */}
      <section aria-labelledby="flavor-catalog-title" className="admin-flavor-catalog min-w-0 rounded-md border border-[#dce3eb] bg-white">
        <div className="admin-flavor-catalog-toolbar flex flex-col gap-4 border-b border-[#f4f6f8] p-4 sm:p-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="admin-flavor-catalog-title text-base font-semibold text-[#092a53]" id="flavor-catalog-title">
                {t("Available flavors")}
              </h2>
              <p aria-live="polite" className="admin-flavor-result-count mt-0.5 text-xs text-[#65748a]">
                {t("Showing {shown} of {total} flavors", { shown: filteredFlavors.length, total: flavors.length })}
              </p>
            </div>
            <div aria-label={t("View")} className="inline-flex rounded-md bg-[#f4f6f8] p-1" role="group">
              {[
                { key: "table", icon: icons.list, label: t("Table view") },
                { key: "grid", icon: icons.grid, label: t("Grid view") },
              ].map((option) => (
                <button
                  aria-label={option.label}
                  aria-pressed={view === option.key}
                  className={`grid size-8 place-items-center rounded-lg transition ${
                    view === option.key ? "bg-white text-[#092a53] border border-[#dce3eb]" : "text-[#65748a] hover:text-[#092a53] border border-transparent"
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

          <div className="admin-flavor-filters grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto_auto_auto]">
            <label className="relative block">
              <span className="sr-only">{t("Search flavors")}</span>
              <Icon className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-[#65748a]" path={icons.search} />
              <input
                className={`admin-flavor-control ${inputClassName} mt-0 pl-10`}
                onChange={(event) => setFlavorSearch(event.target.value)}
                placeholder={t("Search flavors")}
                type="search"
                value={flavorSearch}
              />
            </label>
            <label className="block">
              <span className="sr-only">{t("Flavor tag")}</span>
              <select
                className={`admin-flavor-control ${inputClassName} mt-0 lg:w-44`}
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
              <select className={`admin-flavor-control ${inputClassName} mt-0 lg:w-44`} onChange={(event) => setSortBy(event.target.value)} value={sortBy}>
                <option value="name">{t("Sort: Name (A–Z)")}</option>
                <option value="price-asc">{t("Sort: Price, low to high")}</option>
                <option value="price-desc">{t("Sort: Price, high to low")}</option>
                <option value="stock">{t("Sort: Lowest stock first")}</option>
              </select>
            </label>
            <div aria-label={t("Stock status")} className="admin-flavor-stock-filters flex overflow-x-auto rounded-md bg-[#f4f6f8] p-1" role="group">
              {[
                { key: "all", label: t("All") },
                { key: "available", label: t("In stock") },
                { key: "low", label: t("Low stock") },
                { key: "sold-out", label: t("Sold out") },
              ].map((option) => (
                <button
                  aria-pressed={stockFilter === option.key}
                  className={`admin-flavor-stock-filter whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                    stockFilter === option.key ? "bg-white text-[#092a53]" : "text-[#65748a] hover:text-[#092a53]"
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
          <p className="admin-flavor-error mx-4 mt-4 flex items-start gap-2 rounded-md bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 ring-1 ring-red-100 sm:mx-5" role="alert">
            <Icon className="mt-0.5 size-4 shrink-0" path={icons.alert} />
            {flavorsError || error}
          </p>
        )}

        {loading ? (
          <div aria-label={t("Loading flavors from the database…")} className="admin-flavor-loading space-y-3 p-4 sm:p-5" role="status">
            {[0, 1, 2, 3].map((row) => (
              <div className="flex animate-pulse items-center gap-4" key={row}>
                <span className="size-12 rounded-md bg-[#f4f6f8]" />
                <span className="h-3 flex-1 rounded bg-[#f4f6f8]" />
                <span className="h-3 w-24 rounded bg-[#f4f6f8]" />
              </div>
            ))}
          </div>
        ) : filteredFlavors.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <span className="mx-auto grid size-12 place-items-center rounded-md bg-[#f4f6f8] text-[#65748a]">
              <Icon className="size-5" path={icons.search} />
            </span>
            <p className="mt-4 text-sm font-semibold text-[#092a53]">
              {t(flavors.length ? "No flavors match your filters." : "No flavors yet")}
            </p>
            <div className="mt-4 flex justify-center gap-2">
              {hasActiveFilters ? (
                <button
                  className="min-h-9 rounded-md border border-[#dce5ef] px-4 text-xs font-bold text-[#123b68] transition hover:bg-[#f4f6f8]"
                  onClick={resetFilters}
                  type="button"
                >
                  {t("Clear filters")}
                </button>
              ) : (
                <button
                  className="inline-flex min-h-9 items-center gap-2 rounded-md bg-[#092a53] px-4 text-xs font-bold text-white transition hover:bg-[#163e6b]"
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
            <table className="admin-flavor-table w-full min-w-[760px] text-left text-sm">
              <thead>
                <tr className="admin-flavor-table-head border-b border-[#f4f6f8] text-xs font-extrabold uppercase tracking-[0.08em] text-[#65748a]">
                  <th className="px-5 py-3 font-extrabold" scope="col">{t("Flavor")}</th>
                  <th className="px-3 py-3 font-extrabold" scope="col">{t("Badge")}</th>
                  <th className="px-3 py-3 text-right font-extrabold" scope="col">{t("Price")}</th>
                  <th className="px-3 py-3 font-extrabold" scope="col">{t("Stock")}</th>
                  <th className="px-3 py-3 font-extrabold" scope="col">{t("Status")}</th>
                  <th className={`px-5 py-3 text-right font-extrabold ${PINNED_ACTION_HEAD}`} scope="col"><span className="sr-only">{t("Actions")}</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f4f6f8]">
                {filteredFlavors.map((flavor) => (
                  <tr className="admin-flavor-table-row group transition hover:bg-[#f4f6f8]" key={flavor.id}>
                    <td className="px-5 py-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <FlavorThumb alt="" src={flavor.image} />
                        <div className="min-w-0">
                          <p className="truncate font-bold text-[#092a53]">{flavor.name}</p>
                          <p className="max-w-[14rem] truncate text-xs text-[#65748a]">{flavor.detail}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      {flavor.tag ? (
                        <span className="inline-block max-w-[9rem] truncate rounded-full bg-[#fff6cc] px-2.5 py-1 text-xs font-bold text-[#bd9c00]">
                          {t(flavor.tag)}
                        </span>
                      ) : (
                        <span className="text-[#a3b0bf]">—</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-right font-bold tabular-nums text-[#092a53]">
                      {formatCartMoney(flavor.price, "xaf")}
                    </td>
                    <td className="px-3 py-3"><StockMeter flavor={flavor} t={t} /></td>
                    <td className="px-3 py-3"><StockBadge flavor={flavor} t={t} /></td>
                    <td className={`px-5 py-3 ${PINNED_ACTION_CELL}`}>{rowActions(flavor)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="grid gap-4 p-4 sm:grid-cols-2 sm:p-5 2xl:grid-cols-3">
            {filteredFlavors.map((flavor) => (
              <article
                className="admin-flavor-grid-card group flex flex-col overflow-hidden rounded-md border border-[#e7edf4] bg-white transition"
                key={flavor.id}
              >
                <div className="relative h-40 overflow-hidden bg-[#f4f6f8]">
                  <img decoding="async"
                    alt={flavor.name}
                    className="size-full object-cover"
                    loading="lazy"
                    src={flavor.image}
                  />
                  <span className="absolute left-3 top-3"><StockBadge flavor={flavor} t={t} /></span>
                  {flavor.tag && (
                    <span className="absolute right-3 top-3 max-w-[50%] truncate rounded-full bg-[#ffdc32] px-2.5 py-1 text-xs font-extrabold text-[#092a53] shadow-sm">
                      {t(flavor.tag)}
                    </span>
                  )}
                </div>
                <div className="flex flex-1 flex-col p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="truncate text-sm font-semibold text-[#092a53]">{flavor.name}</h3>
                      <p className="mt-0.5 line-clamp-2 text-xs leading-5 text-[#65748a]">{flavor.detail}</p>
                    </div>
                    <p className="shrink-0 text-sm font-extrabold tabular-nums text-[#092a53]">{formatCartMoney(flavor.price, "xaf")}</p>
                  </div>
                  <div className="mt-auto flex items-end justify-between gap-3 border-t border-[#f4f6f8] pt-3 [&>div:first-child]:mt-0">
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
            className="admin-modal-panel relative w-full max-w-md rounded-md bg-white p-6 shadow-[0_30px_80px_rgba(9,42,83,0.3)]"
            role="dialog"
          >
            <span className="grid size-12 place-items-center rounded-md bg-red-50 text-red-600">
              <Icon className="size-6" path={icons.trash} />
            </span>
            <h2 className="mt-4 text-base font-semibold text-[#092a53]" id="delete-flavor-title">
              {t("Remove this flavor?")}
            </h2>
            <div className="mt-4 flex items-center gap-3 rounded-md bg-[#f4f6f8] p-3 ring-1 ring-[#dce3eb]">
              <FlavorThumb src={flavorToDelete.image} />
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-[#092a53]">{flavorToDelete.name}</p>
                <p className="text-xs text-[#65748a]">{formatCartMoney(flavorToDelete.price, "xaf")}</p>
              </div>
            </div>
            <p className="mt-3 text-sm leading-6 text-[#65748a]">
              {t("will be removed from the shop and any saved bags.")}
            </p>
            {error && (
              <p className="mt-3 rounded-md bg-red-50 px-3 py-2.5 text-sm font-semibold text-red-700" role="alert">{error}</p>
            )}
            <div className="mt-6 flex justify-end gap-2.5">
              <button
                className="min-h-10 rounded-md px-4 text-sm font-bold text-[#65748a] transition hover:bg-[#f4f6f8]"
                onClick={() => setFlavorToDelete(null)}
                type="button"
              >
                {t("Cancel")}
              </button>
              <button
                className="inline-flex min-h-10 items-center gap-2 rounded-md bg-red-600 px-4 text-sm font-bold text-white transition hover:bg-red-700 disabled:cursor-wait disabled:opacity-60"
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
