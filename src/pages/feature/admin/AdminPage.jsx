import { useState } from "react";
import { useLanguage } from "../../../language/LanguageContext";
import { Link } from "react-router-dom";
import { useFlavors } from "../../../flavor-context/FlavorContext";
import { useAdminAuth } from "./AdminAuthContext";
import { useCart } from "../../../CartContext";
import { formatCartMoney } from "../../../cartPricing";

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
  const [flavorToDelete, setFlavorToDelete] = useState(null);
  const [flavorToEdit, setFlavorToEdit] = useState(null);
  const [editForm, setEditForm] = useState(initialForm);
  const [flavorSearch, setFlavorSearch] = useState("");
  const [selectedFlavorTag, setSelectedFlavorTag] = useState("");
  const [stockFilter, setStockFilter] = useState("all");
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
  const totalStock = flavors.reduce(
    (sum, flavor) => sum + flavor.availableQuantity,
    0,
  );
  const filteredFlavors = flavors.filter((flavor) => {
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
      (stockFilter === "sold-out" && flavor.availableQuantity === 0);
    return matchesSearch && matchesTag && matchesStock;
  });

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

  function openEditForm(flavor) {
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
    try {
      await deleteFlavor(flavorToDelete.id);
      removeFromCart(flavorToDelete.id);
      setMessage(`${flavorToDelete.name} was removed from the shop.`);
      setFlavorToDelete(null);
    } catch (deleteError) {
      setError(deleteError.message);
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
    try {
      const savedFlavor = await updateFlavor(flavorToEdit.id, updatedFlavor);
      updateCartFlavor(savedFlavor);
      setMessage(`${savedFlavor.name} was updated.`);
      setFlavorToEdit(null);
    } catch (updateError) {
      setError(updateError.message);
    }
  }

  return (
    <div className="min-w-0 space-y-6">
      <section className="relative isolate overflow-hidden rounded-[28px] bg-gradient-to-br from-[#092a53] via-[#123b63] to-[#285777] p-5 text-white shadow-[0_18px_42px_rgba(9,42,83,0.16)] sm:p-7 lg:p-8">
        <div
          aria-hidden="true"
          className="absolute -right-16 -top-28 size-72 rounded-full border-[54px] border-white/[0.05]"
        />
        <div
          aria-hidden="true"
          className="absolute -bottom-20 left-1/3 size-48 rounded-full bg-[#ffdc32]/10 blur-3xl"
        />
        <div className="relative flex flex-wrap items-center justify-between gap-5">
          <div className="flex min-w-0 items-center gap-4">
            {currentAdmin?.profilePicture ? (
              <img
                alt=""
                className="size-14 shrink-0 rounded-2xl border border-white/20 object-cover shadow-lg sm:size-16"
                src={currentAdmin.profilePicture}
              />
            ) : (
              <span
                aria-hidden="true"
                className="grid size-14 shrink-0 place-items-center rounded-2xl bg-[#ffdc32] font-display text-xl font-bold text-[#092a53] shadow-lg sm:size-16"
              >
                {currentAdmin?.name?.charAt(0).toUpperCase()}
              </span>
            )}
            <div className="min-w-0">
              <p className="mb-1 text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#ffdc32]">
                {t("Flavor management")}
              </p>
              <h1 className="truncate font-display text-2xl font-extrabold tracking-tight sm:text-3xl">
                {t("Welcome, {name}", { name: currentAdmin?.name || "Admin" })}
              </h1>
              <p className="mt-1 max-w-xl text-sm leading-6 text-white/70">
                {t(
                  "Add a flavor and manage the list of flavors available in your shop.",
                )}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <label className="inline-flex min-h-9 cursor-pointer items-center rounded-lg border border-white/25 bg-white/10 px-3 py-2 text-xs font-bold transition hover:bg-white/20">
                  {t(
                    currentAdmin?.profilePicture
                      ? "Change profile picture"
                      : "Add profile picture",
                  )}
                  <input
                    accept="image/*"
                    className="sr-only"
                    onChange={handleProfilePictureChange}
                    type="file"
                  />
                </label>
                {profilePicture && (
                  <>
                    <img
                      alt={t("Profile picture preview")}
                      className="size-9 rounded-lg object-cover ring-1 ring-white/30"
                      src={profilePicture}
                    />
                    <button
                      className="inline-flex min-h-9 items-center rounded-lg bg-[#ffdc32] px-3 py-2 text-xs font-extrabold text-[#092a53] transition hover:bg-[#ffe76c] disabled:cursor-wait disabled:opacity-60"
                      disabled={isSavingProfilePicture}
                      onClick={handleProfilePictureSave}
                      type="button"
                    >
                      {t(
                        isSavingProfilePicture
                          ? "Saving…"
                          : "Save profile picture",
                      )}
                    </button>
                  </>
                )}
              </div>
              {profilePictureError && (
                <p
                  className="mt-2 text-xs font-semibold text-red-200"
                  role="alert"
                >
                  {profilePictureError}
                </p>
              )}
              {profilePictureMessage && (
                <p
                  className="mt-2 text-xs font-semibold text-emerald-200"
                  role="status"
                >
                  {profilePictureMessage}
                </p>
              )}
            </div>
          </div>
          <Link
            to="/flavors"
            className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#ffdc32] px-5 py-3 text-sm font-extrabold text-[#092a53] shadow-sm transition hover:-translate-y-0.5 hover:bg-[#ffe76c] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            {t("View customer shop")} <span aria-hidden="true">↗</span>
          </Link>
        </div>
      </section>

      <section
        aria-label={t("Flavor inventory overview")}
        className="grid grid-cols-2 gap-3 xl:grid-cols-4"
      >
        {[
          {
            label: "Total flavors",
            value: flavors.length,
            icon: "🍨",
            accent: "bg-[#fff0a8] text-[#806a00]",
          },
          {
            label: "In stock",
            value: inStockCount,
            icon: "✓",
            accent: "bg-[#e5f3d8] text-[#37632c]",
          },
          {
            label: "Sold out",
            value: soldOutCount,
            icon: "!",
            accent: "bg-[#fff0ed] text-[#b34334]",
          },
          {
            label: "Units in stock",
            value: totalStock,
            icon: "▣",
            accent: "bg-[#e9f1fa] text-[#315982]",
          },
        ].map((metric) => (
          <article
            className="rounded-[20px] border border-[#e5ebf3] bg-white p-4 shadow-[0_8px_24px_rgba(18,44,80,0.045)] transition hover:-translate-y-0.5 hover:shadow-[0_14px_30px_rgba(18,44,80,0.08)] sm:p-5"
            key={metric.label}
          >
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold leading-5 text-[#65748a]">
                {t(metric.label)}
              </p>
              <span
                aria-hidden="true"
                className={`grid size-9 place-items-center rounded-xl text-sm font-bold ${metric.accent}`}
              >
                {metric.icon}
              </span>
            </div>
            <p className="mt-3 font-display text-2xl font-extrabold tracking-tight text-[#102c50] sm:text-3xl">
              {metric.value.toLocaleString()}
            </p>
          </article>
        ))}
      </section>

      <div className="grid min-w-0 items-start gap-6 xl:grid-cols-[minmax(280px,0.82fr)_minmax(0,1.38fr)] 2xl:gap-8">
        <section className="min-w-0 rounded-[24px] border border-[#e5ebf3] bg-white p-5 shadow-[0_12px_34px_rgba(18,44,80,0.055)] sm:p-6">
          <div className="mb-5 flex items-start gap-3 border-b border-[#edf1f5] pb-5">
            <span
              aria-hidden="true"
              className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#fff4c7] text-lg text-[#856d00]"
            >
              +
            </span>
            <div>
              <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#a48700]">
                {t("Catalog setup")}
              </p>
              <h2 className="mt-1 font-display text-2xl font-bold text-[#102c50]">
                {t("Add a flavor")}
              </h2>
              <p className="mt-1 text-sm leading-6 text-[#65748a]">
                {t(
                  "New flavors are saved to the database and appear in the shop.",
                )}
              </p>
            </div>
          </div>

          <form className="space-y-4" onSubmit={handleSubmit}>
            <label className="block text-sm font-semibold">
              {t("Flavor name")}
              <input
                className={inputClassName}
                name="name"
                onChange={handleChange}
                required
                value={form.name}
              />
            </label>
            <label className="block text-sm font-semibold">
              {t("Short description")}
              <input
                className={inputClassName}
                name="detail"
                onChange={handleChange}
                required
                value={form.detail}
              />
            </label>
            <label className="block text-sm font-semibold">
              {t("Full description")}
              <textarea
                className={`${inputClassName} min-h-24 resize-y`}
                name="description"
                onChange={handleChange}
                required
                value={form.description}
              />
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm font-semibold">
                {t("Price per scoop (FCFA)")}
                <input
                  className={inputClassName}
                  min="1"
                  name="price"
                  onChange={handleChange}
                  required
                  step="1"
                  type="number"
                  value={form.price}
                />
              </label>
              <label className="block text-sm font-semibold">
                {t("Starting stock")}
                <input
                  className={inputClassName}
                  min="0"
                  name="stock"
                  onChange={handleChange}
                  required
                  step="1"
                  type="number"
                  value={form.stock}
                />
              </label>
              <label className="block text-sm font-semibold">
                {t("Image URL or path")}
                <input
                  className={inputClassName}
                  name="image"
                  onChange={handleChange}
                  placeholder="/images/flavor.jpg"
                  required
                  value={form.image}
                />
              </label>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm font-semibold">
                {t("Flavor badge")}
                <input
                  className={inputClassName}
                  name="tag"
                  onChange={handleChange}
                  placeholder={t("Fan favorite")}
                  value={form.tag}
                />
              </label>
              <label className="block text-sm font-semibold">
                {t("Origin")}
                <input
                  className={inputClassName}
                  name="origin"
                  onChange={handleChange}
                  placeholder={t("Local dairy")}
                  value={form.origin}
                />
              </label>
            </div>
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
                className="rounded-xl bg-[#fff0a8] px-4 py-3 text-sm text-[#624f00]"
                role="status"
              >
                {message}
              </p>
            )}
            <button
              className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#092a53] px-6 py-3.5 text-sm font-bold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-[#163e6b] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#bd9c00] disabled:cursor-wait disabled:opacity-60"
              disabled={isSaving}
              type="submit"
            >
              {isSaving ? t("Saving flavor…") : t("Add flavor to shop")}
            </button>
          </form>
        </section>

        <section className="min-w-0">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#a48700]">
                {t("Catalog overview")}
              </p>
              <h2 className="mt-1 font-display text-2xl font-bold text-[#102c50]">
                {t("Available flavors")}
              </h2>
              <p aria-live="polite" className="mt-1 text-sm text-[#65748a]">
                {flavors.length}
                {t(" flavors in the catalog, including sold-out flavors")}
              </p>
            </div>
          </div>
          <div className="mb-4 grid gap-3 rounded-[20px] border border-[#e5ebf3] bg-white p-4 shadow-[0_8px_24px_rgba(18,44,80,0.045)] sm:grid-cols-2">
            <label className="block text-sm font-semibold text-[#65748a]">
              {t("Search flavors")}
              <input
                className={inputClassName}
                onChange={(event) => setFlavorSearch(event.target.value)}
                placeholder={t("Search by flavor name or description")}
                type="search"
                value={flavorSearch}
              />
            </label>
            <label className="block text-sm font-semibold text-[#65748a]">
              {t("Flavor tag")}
              <select
                className={inputClassName}
                onChange={(event) => setSelectedFlavorTag(event.target.value)}
                value={selectedFlavorTag}
              >
                <option value="">{t("All tags")}</option>
                {flavorTags.map((tag) => (
                  <option key={tag} value={tag}>
                    {t(tag)}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm font-semibold text-[#65748a]">
              {t("Stock status")}
              <select
                className={inputClassName}
                onChange={(event) => setStockFilter(event.target.value)}
                value={stockFilter}
              >
                <option value="all">{t("All flavors")}</option>
                <option value="available">{t("In stock")}</option>
                <option value="sold-out">{t("Sold out")}</option>
              </select>
            </label>
          </div>
          {(flavorsError || loading) && (
            <p
              className={`mb-3 rounded-xl px-4 py-3 text-sm ${flavorsError ? "bg-red-50 text-red-700" : "bg-[#fff9dc] text-[#624f00]"}`}
              role={flavorsError ? "alert" : "status"}
            >
              {flavorsError || "Loading flavors from the database…"}
            </p>
          )}
          {error && (
            <p
              className="mb-3 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700"
              role="alert"
            >
              {error}
            </p>
          )}

          <div className="rounded-[22px] border border-[#e5ebf3] bg-white p-3 shadow-[0_10px_32px_rgba(18,44,80,0.05)] sm:p-4">
            <div className="grid gap-4 sm:grid-cols-2">
              {filteredFlavors.map((flavor) => (
                <article
                  className="group overflow-hidden rounded-2xl border border-[#e7edf4] bg-white transition duration-200 hover:-translate-y-0.5 hover:border-[#cbd8e6] hover:shadow-[0_14px_30px_rgba(16,44,80,0.09)]"
                  key={flavor.id}
                >
                  <div className="relative h-36 overflow-hidden bg-[#f1f4f7] sm:h-40">
                    <img
                      alt={flavor.name}
                      className="size-full object-cover transition duration-300 group-hover:scale-[1.03]"
                      loading="lazy"
                      src={flavor.image}
                    />
                    <span
                      className={`absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-extrabold shadow-sm ${
                        flavor.availableQuantity > 0
                          ? "bg-white/95 text-[#246a46]"
                          : "bg-white/95 text-[#a53f37]"
                      }`}
                    >
                      <span
                        aria-hidden="true"
                        className={`size-1.5 rounded-full ${flavor.availableQuantity > 0 ? "bg-[#35a36b]" : "bg-[#d2544b]"}`}
                      />
                      {flavor.availableQuantity > 0
                        ? t("In stock")
                        : t("Sold out")}
                    </span>
                    {flavor.tag && (
                      <span className="absolute right-3 top-3 max-w-[55%] truncate rounded-full bg-[#ffdc32] px-2.5 py-1 text-[10px] font-extrabold text-[#092a53] shadow-sm">
                        {t(flavor.tag)}
                      </span>
                    )}
                  </div>
                  <div className="flex min-h-[202px] flex-col p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="truncate font-display text-lg font-extrabold text-[#123253]">
                          {flavor.name}
                        </h3>
                        <p className="mt-1 line-clamp-2 min-h-10 text-sm leading-5 text-[#65748a]">
                          {flavor.detail}
                        </p>
                      </div>
                      <p className="shrink-0 text-right text-sm font-extrabold text-[#123253]">
                        {formatCartMoney(flavor.price, "xaf")}
                      </p>
                    </div>
                    <div className="mt-auto flex items-center justify-between gap-3 border-t border-[#edf1f5] pt-3">
                      <p
                        className={`text-xs font-bold ${flavor.availableQuantity > 0 ? "text-[#397355]" : "text-[#a53f37]"}`}
                      >
                        {flavor.availableQuantity > 0
                          ? `${flavor.availableQuantity} ${t("available")}${flavor.reservedStock ? ` · ${flavor.reservedStock} ${t("reserved")}` : ""}`
                          : t("Sold out")}
                      </p>
                      <Link
                        aria-label={`${t("View")} ${flavor.name}`}
                        className="shrink-0 text-xs font-bold text-[#526b86] underline decoration-[#ffdc32] decoration-2 underline-offset-4 transition hover:text-[#092a53]"
                        to={`/flavor/${flavor.id}`}
                      >
                        {t("View")}
                      </Link>
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-2">
                      <button
                        aria-label={`Edit ${flavor.name}`}
                        className="min-h-9 rounded-lg border border-[#dce5ef] bg-[#f8fafc] px-3 text-xs font-bold text-[#294867] transition hover:border-[#becddd] hover:bg-[#f0f5f9] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#bd9c00]"
                        onClick={() => openEditForm(flavor)}
                        type="button"
                      >
                        {t("Edit")}
                      </button>
                      <button
                        aria-label={`Delete ${flavor.name}`}
                        className="min-h-9 rounded-lg border border-[#f0d8d6] bg-white px-3 text-xs font-bold text-[#a3433b] transition hover:border-[#e9bebb] hover:bg-[#fff7f6] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-400"
                        onClick={() => setFlavorToDelete(flavor)}
                        type="button"
                      >
                        {t("Delete")}
                      </button>
                    </div>
                  </div>
                </article>
              ))}
              {!loading && !flavorsError && filteredFlavors.length === 0 && (
                <p className="px-4 py-6 text-center text-sm text-[#65748a]">
                  {t("No flavors match your filters.")}
                </p>
              )}
            </div>
          </div>
        </section>
      </div>

      {flavorToEdit && (
        <div
          className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-[#092a53]/45 px-5 py-8"
          role="presentation"
        >
          <section
            aria-labelledby="edit-flavor-title"
            aria-modal="true"
            className="my-auto w-full max-w-xl rounded-[24px] bg-white p-6 shadow-2xl sm:p-8"
            role="dialog"
          >
            <h2
              className="font-display text-2xl font-bold"
              id="edit-flavor-title"
            >
              {t("Edit flavor details")}
            </h2>
            <p className="mt-1 text-sm text-[#65748a]">
              {t("Changes will appear in the shop right away.")}
            </p>
            <form className="mt-5 space-y-4" onSubmit={handleUpdateFlavor}>
              <label className="block text-sm font-semibold">
                {t("Flavor name")}
                <input
                  className={inputClassName}
                  name="name"
                  onChange={handleEditChange}
                  required
                  value={editForm.name}
                />
              </label>
              <label className="block text-sm font-semibold">
                {t("Short description")}
                <input
                  className={inputClassName}
                  name="detail"
                  onChange={handleEditChange}
                  required
                  value={editForm.detail}
                />
              </label>
              <label className="block text-sm font-semibold">
                {t("Full description")}
                <textarea
                  className={`${inputClassName} min-h-24 resize-y`}
                  name="description"
                  onChange={handleEditChange}
                  required
                  value={editForm.description}
                />
              </label>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-sm font-semibold">
                  {t("Price per scoop (FCFA)")}
                  <input
                    className={inputClassName}
                    min="1"
                    name="price"
                    onChange={handleEditChange}
                    required
                    step="1"
                    type="number"
                    value={editForm.price}
                  />
                </label>
                <label className="block text-sm font-semibold">
                  {t("Stock quantity")}
                  <input
                    className={inputClassName}
                    min={flavorToEdit.reservedStock}
                    name="stock"
                    onChange={handleEditChange}
                    required
                    step="1"
                    type="number"
                    value={editForm.stock}
                  />
                  {flavorToEdit.reservedStock > 0 && (
                    <span className="mt-1 block text-xs font-normal text-[#65748a]">
                      {flavorToEdit.reservedStock}{" "}
                      {t("reserved for pending checkouts.")}
                    </span>
                  )}
                </label>
                <label className="block text-sm font-semibold">
                  {t("Image URL or path")}
                  <input
                    className={inputClassName}
                    name="image"
                    onChange={handleEditChange}
                    required
                    value={editForm.image}
                  />
                </label>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-sm font-semibold">
                  {t("Flavor badge")}
                  <input
                    className={inputClassName}
                    name="tag"
                    onChange={handleEditChange}
                    value={editForm.tag}
                  />
                </label>
                <label className="block text-sm font-semibold">
                  {t("Origin")}
                  <input
                    className={inputClassName}
                    name="origin"
                    onChange={handleEditChange}
                    value={editForm.origin}
                  />
                </label>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  className="rounded-full border-2 border-[#65748a] px-5 py-2.5 text-sm font-bold transition hover:bg-[#f4f1e7]"
                  onClick={() => setFlavorToEdit(null)}
                  type="button"
                >
                  {t("Cancel")}
                </button>
                <button
                  className="rounded-full bg-[#ffdc32] px-5 py-2.5 text-sm font-bold transition hover:bg-[#ffe76c]"
                  type="submit"
                >
                  {t("Save changes")}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {flavorToDelete && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-[#092a53]/45 px-5"
          role="presentation"
        >
          <section
            aria-labelledby="delete-flavor-title"
            aria-modal="true"
            className="w-full max-w-md rounded-[24px] bg-white p-6 shadow-2xl sm:p-8"
            role="dialog"
          >
            <h2
              className="font-display text-2xl font-bold"
              id="delete-flavor-title"
            >
              {t("Remove this flavor?")}
            </h2>
            <p className="mt-2 text-sm leading-6 text-[#65748a]">
              <strong className="text-[#102c50]">{flavorToDelete.name}</strong>{" "}
              {t("will be removed from the shop and any saved bags.")}
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                className="rounded-full border-2 border-[#65748a] px-5 py-2.5 text-sm font-bold transition hover:bg-[#f4f1e7]"
                onClick={() => setFlavorToDelete(null)}
                type="button"
              >
                {t("Cancel")}
              </button>
              <button
                className="rounded-full bg-red-700 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-red-800"
                onClick={handleDeleteFlavor}
                type="button"
              >
                {t("Delete flavor")}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
