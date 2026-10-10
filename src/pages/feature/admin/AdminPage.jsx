import { useState } from "react";
import { Link } from "react-router-dom";
import { useFlavors } from "../../../flavor-context/FlavorContext";
import { useAdminAuth } from "./AdminAuthContext";
import { useCart } from "../../../CartContext";
import { useLanguage } from "../../../language/LanguageContext";
import { formatCartMoney } from "../../../cartPricing";

const inputClassName =
  "mt-1.5 w-full rounded-xl border border-[#d9d6cc] bg-white px-4 py-3 text-sm font-normal text-[#102c50] outline-none transition focus:border-[#bd9c00] focus:ring-2 focus:ring-[#ffdc32]/40";

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
  const { currentAdmin } = useAdminAuth();
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
  const flavorTags = [
    ...new Set(flavors.map((flavor) => flavor.tag).filter(Boolean)),
  ].sort((a, b) => a.localeCompare(b));
  const inStockCount = flavors.filter((flavor) => flavor.availableQuantity > 0).length;
  const soldOutCount = flavors.length - inStockCount;
  const totalStock = flavors.reduce((sum, flavor) => sum + flavor.availableQuantity, 0);
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
      <section className="relative isolate overflow-hidden rounded-[24px] bg-[#092a53] p-5 text-white shadow-[0_14px_36px_rgba(9,42,83,0.16)] sm:p-7 lg:p-8">
        <div aria-hidden="true" className="absolute -right-16 -top-28 size-72 rounded-full border-[54px] border-white/[0.04]" />
        <div className="relative flex flex-wrap items-center justify-between gap-5">
          <div className="flex min-w-0 items-center gap-4">
            {currentAdmin?.profilePicture ? (
              <img alt="" className="size-14 shrink-0 rounded-2xl border border-white/20 object-cover sm:size-16" src={currentAdmin.profilePicture} />
            ) : (
              <span aria-hidden="true" className="grid size-14 shrink-0 place-items-center rounded-2xl bg-[#ffdc32] font-display text-xl font-bold text-[#092a53] sm:size-16">
                {currentAdmin?.name?.charAt(0).toUpperCase()}
              </span>
            )}
            <div className="min-w-0">
              <p className="mb-1 text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#ffdc32]">{t("Store management")}</p>
              <h1 className="truncate font-display text-2xl font-bold tracking-tight sm:text-3xl">
                {t("Welcome, {name}", { name: currentAdmin?.name || "Admin" })}
              </h1>
              <p className="mt-1 text-sm text-white/70">{t("Add a flavor and manage the list of flavors available in your shop.")}</p>
            </div>
          </div>
          <Link
            to="/flavors"
            className="inline-flex items-center gap-2 rounded-full bg-[#ffdc32] px-5 py-3 text-sm font-bold text-[#092a53] transition hover:-translate-y-0.5 hover:bg-[#ffe76c]"
          >
            {t("View customer shop")} <span aria-hidden="true">↗</span>
          </Link>
        </div>
      </section>

      <section aria-label={t("Flavor inventory overview")} className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {[
          { label: "Total flavors", value: flavors.length, icon: "🍨", accent: "bg-[#fff0a8] text-[#806a00]" },
          { label: "In stock", value: inStockCount, icon: "✓", accent: "bg-[#e5f3d8] text-[#37632c]" },
          { label: "Sold out", value: soldOutCount, icon: "!", accent: "bg-[#fff0ed] text-[#b34334]" },
          { label: "Units in stock", value: totalStock, icon: "▣", accent: "bg-[#e9f1fa] text-[#315982]" },
        ].map((metric) => (
          <article className="rounded-[18px] border border-[#e7e3d9] bg-white p-4 shadow-[0_6px_20px_rgba(18,44,80,0.04)] sm:p-5" key={metric.label}>
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold leading-5 text-[#65748a]">{t(metric.label)}</p>
              <span aria-hidden="true" className={`grid size-9 place-items-center rounded-xl text-sm font-bold ${metric.accent}`}>{metric.icon}</span>
            </div>
            <p className="mt-3 font-display text-2xl font-extrabold tracking-tight text-[#102c50] sm:text-3xl">{metric.value.toLocaleString()}</p>
          </article>
        ))}
      </section>

      <div className="grid min-w-0 items-start gap-8 xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
        <section className="min-w-0 rounded-[22px] border border-[#e7e3d9] bg-white p-5 shadow-[0_10px_32px_rgba(18,44,80,0.06)] sm:p-7">
          <div className="mb-6 border-b border-[#e7e3d9] pb-5">
            <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#a48700]">{t("Catalog setup")}</p>
            <h2 className="mt-1 font-display text-2xl font-bold">
            {t("Add a flavor")}
            </h2>
            <p className="mt-1 text-sm leading-6 text-[#65748a]">
            {t("New flavors are saved to the database and appear in the shop.")}
            </p>
          </div>

          <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
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
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#092a53] px-6 py-3.5 text-sm font-bold text-white transition hover:-translate-y-0.5 hover:bg-[#163e6b] disabled:cursor-wait disabled:opacity-60"
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
              <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#a48700]">{t("Catalog overview")}</p>
              <h2 className="font-display text-2xl font-bold">
                {t("Available flavors")}
              </h2>
              <p className="mt-1 text-sm text-[#65748a]">
                {flavors.length}
                {t(" flavors in the catalog, including sold-out flavors")}
              </p>
            </div>
          </div>
          <div className="mb-4 grid gap-3 rounded-[18px] border border-[#e7e3d9] bg-white p-4 shadow-[0_6px_20px_rgba(18,44,80,0.04)] sm:grid-cols-2">
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

          <div className="overflow-hidden rounded-[22px] border border-[#e7e3d9] bg-white shadow-[0_10px_32px_rgba(18,44,80,0.06)]">
            <div className="divide-y divide-[#eeeae1]">
              {filteredFlavors.map((flavor) => (
                <article
                  className="flex items-center gap-3 p-4 transition-colors hover:bg-[#fbfaf5] sm:gap-4 sm:p-5"
                  key={flavor.id}
                >
                  <img
                    alt=""
                    className="size-16 shrink-0 rounded-2xl bg-[#f4f1e7] object-cover sm:size-20"
                    src={flavor.image}
                  />
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate font-display text-lg font-bold">
                      {flavor.name}
                    </h3>
                    <p className="mt-0.5 truncate text-sm text-[#65748a]">
                      {flavor.detail}
                    </p>
                    <p className="mt-1 text-xs font-semibold text-[#8b7400]">
                      {flavor.tag}
                    </p>
                    <p
                      className={`mt-1 text-xs font-bold ${flavor.availableQuantity > 0 ? "text-[#163e35]" : "text-red-700"}`}
                    >
                      {flavor.availableQuantity > 0
                        ? `${flavor.availableQuantity} ${t("available")}${flavor.reservedStock ? ` · ${flavor.reservedStock} ${t("reserved")}` : ""}`
                        : t("Sold out")}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="font-bold">{formatCartMoney(flavor.price, "xaf")}</p>
                    <Link
                      className="mt-1 inline-block text-xs font-semibold text-[#65748a] underline decoration-[#ffdc32] underline-offset-2 hover:text-[#102c50]"
                      to={`/flavor/${flavor.id}`}
                    >
                      {t("View")}
                    </Link>
                    <button
                      aria-label={`Edit ${flavor.name}`}
                      className="mt-2 block rounded-full border border-[#d9d6cc] px-3 py-1 text-xs font-bold text-[#65748a] transition hover:bg-[#f4f1e7]"
                      onClick={() => openEditForm(flavor)}
                      type="button"
                    >
                      {t("Edit")}
                    </button>
                    <button
                      aria-label={`Delete ${flavor.name}`}
                      className="mt-2 block rounded-full border border-red-200 px-3 py-1 text-xs font-bold text-red-700 transition hover:bg-red-50"
                      onClick={() => setFlavorToDelete(flavor)}
                      type="button"
                    >
                      {t("Delete")}
                    </button>
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
