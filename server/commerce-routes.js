// Express routes for the commerce growth features: bundles, wishlist,
// cash-on-delivery collection and the abandoned-cart WhatsApp sweep.
// Mounted from server/index.js; keeps the main router file focused on core flows.

import express from "express";
import rateLimit from "express-rate-limit";
import { database } from "./database.js";
import {
  listActiveBundles,
  listAllBundles,
  saveBundle,
  deleteBundle,
  bundleSavingsPercent,
  listWishlistItems,
  addWishlistItem,
  removeWishlistItem,
  listSharedWishlist,
  getCashOnDeliveryConfig,
  setCashOnDeliveryConfig,
  markCodOrderCollected,
  claimAbandonedCartsForRecovery,
  countAbandonedCartReminders,
} from "./commerce.js";

/**
 * The guards are closures inside server/index.js (they capture the JWT secret and
 * the session machinery), so the caller passes them in rather than this module
 * importing them.
 */
export function registerCommerceRoutes(
  app,
  {
    requireAdmin,
    requireCustomer,
    requireOwner,
    notifyCustomerOfOrderStatus,
    notifyAdminsOfNewOrder,
  },
) {
  // Owner-only routes chain both guards: a signed-in admin whose role is owner.
  const requireOwnerAdmin = [requireAdmin, requireOwner];
  const router = express.Router();

  const wishlistLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 120,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: { error: "Too many wishlist updates. Wait a few minutes." },
  });

  /* ------------------------- Bundles ------------------------- */

  router.get("/bundles", async (_request, response, next) => {
    try {
      const bundles = await listActiveBundles();
      response.json({
        bundles: bundles.map((bundle) => ({
          ...bundle,
          savingsPercent: bundleSavingsPercent(bundle),
        })),
      });
    } catch (error) {
      next(error);
    }
  });

  router.get(
    "/admin/bundles",
    requireAdmin,
    async (_request, response, next) => {
      try {
        response.json({ bundles: await listAllBundles() });
      } catch (error) {
        next(error);
      }
    },
  );

  router.post(
    "/admin/bundles",
    requireOwnerAdmin,
    async (request, response, next) => {
      try {
        const title =
          typeof request.body.title === "string"
            ? request.body.title.trim().slice(0, 120)
            : "";
        const bundlePrice = Number(request.body.bundlePriceXaf);
        const originalPrice = Number(request.body.originalPriceXaf);
        const items = Array.isArray(request.body.items)
          ? request.body.items
          : [];
        const itemsValid =
          items.length >= 2 &&
          items.every(
            (item) =>
              typeof item?.itemKey === "string" &&
              item.itemKey.length <= 120 &&
              Number(item.quantity) >= 1,
          );
        if (
          !title ||
          !Number.isSafeInteger(bundlePrice) ||
          bundlePrice < 1 ||
          !Number.isSafeInteger(originalPrice) ||
          originalPrice < bundlePrice ||
          !itemsValid
        ) {
          response.status(400).json({
            error:
              "A bundle needs a title, a bundle price no higher than the original total, and at least two items.",
          });
          return;
        }
        const bundle = await saveBundle({
          ...request.body,
          title,
          bundlePriceXaf: bundlePrice,
          originalPriceXaf: originalPrice,
        });
        response.status(201).json({ bundle });
      } catch (error) {
        next(error);
      }
    },
  );

  router.delete(
    "/admin/bundles/:id",
    requireOwnerAdmin,
    async (request, response, next) => {
      try {
        const id = Number(request.params.id);
        if (!Number.isSafeInteger(id) || id < 1) {
          response.status(400).json({ error: "Bundle id is invalid." });
          return;
        }
        await deleteBundle(id);
        response.json({ ok: true });
      } catch (error) {
        next(error);
      }
    },
  );

  /* ------------------------- Wishlist ------------------------- */

  router.get(
    "/wishlist",
    requireCustomer,
    wishlistLimiter,
    async (request, response, next) => {
      try {
        response.json(await listWishlistItems(request.customer.id));
      } catch (error) {
        next(error);
      }
    },
  );

  router.post(
    "/wishlist/items",
    requireCustomer,
    wishlistLimiter,
    async (request, response, next) => {
      try {
        const itemKey =
          typeof request.body.itemKey === "string"
            ? request.body.itemKey.trim()
            : "";
        if (!itemKey) {
          response.status(400).json({ error: "Name the item to save." });
          return;
        }
        response.json(await addWishlistItem(request.customer.id, itemKey));
      } catch (error) {
        next(error);
      }
    },
  );

  router.delete(
    "/wishlist/items/:itemKey",
    requireCustomer,
    wishlistLimiter,
    async (request, response, next) => {
      try {
        response.json(
          await removeWishlistItem(request.customer.id, request.params.itemKey),
        );
      } catch (error) {
        next(error);
      }
    },
  );

  // Shared read-only view; no auth so a recipient link works for anyone.
  const sharedWishlistLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 60,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: { error: "Too many wishlist views. Wait a few minutes." },
  });
  router.get(
    "/wishlist/shared/:slug",
    sharedWishlistLimiter,
    async (request, response, next) => {
      try {
        const shared = await listSharedWishlist(request.params.slug);
        if (!shared) {
          response.status(404).json({ error: "This wishlist does not exist." });
          return;
        }
        response.json(shared);
      } catch (error) {
        next(error);
      }
    },
  );

  /* --------------------- Cash on delivery --------------------- */

  router.get("/payment-methods", async (_request, response) => {
    const cod = await getCashOnDeliveryConfig();
    response.json({ cashOnDelivery: cod });
  });

  // Rider/branch admin marks a COD order as paid on handover.
  router.post(
    "/admin/orders/:id/collect-cod",
    requireAdmin,
    async (request, response, next) => {
      try {
        const id = Number(request.params.id);
        if (!Number.isSafeInteger(id) || id < 1) {
          response.status(400).json({ error: "Order id is invalid." });
          return;
        }
        const order = await database
          .prepare("SELECT id, payment_method FROM orders WHERE id = ?")
          .get(id);
        if (!order || order.payment_method !== "cod") {
          response
            .status(404)
            .json({ error: "No cash-on-delivery order with that id." });
          return;
        }
        await markCodOrderCollected(id, request.admin.id);
        notifyCustomerOfOrderStatus(id, "confirmed");
        notifyAdminsOfNewOrder(id);
        response.json({ ok: true });
      } catch (error) {
        next(error);
      }
    },
  );

  router.put(
    "/admin/settings/cash-on-delivery",
    requireOwnerAdmin,
    async (request, response, next) => {
      try {
        const maxTotalXaf = Number(request.body.maxTotalXaf);
        if (
          typeof request.body.enabled !== "boolean" ||
          !Number.isFinite(maxTotalXaf) ||
          maxTotalXaf < 0
        ) {
          response.status(400).json({
            error: "Provide enabled (true/false) and maxTotalXaf (a number).",
          });
          return;
        }
        response.json(
          await setCashOnDeliveryConfig({
            enabled: request.body.enabled,
            maxTotalXaf,
          }),
        );
      } catch (error) {
        next(error);
      }
    },
  );

  /* --------------- Abandoned-cart WhatsApp recovery --------------- */

  // Owner-triggered sweep; a cron can call it with the admin token too.
  router.post(
    "/admin/recovery/run",
    requireOwnerAdmin,
    async (request, response, next) => {
      try {
        const claimed = await claimAbandonedCartsForRecovery({
          afterMinutes: Number(request.body.afterMinutes) || 60,
          limit: Number(request.body.limit) || 20,
        });
        let sent = 0;
        for (const cart of claimed) {
          try {
            const { sendWhatsAppText } = await import("./whatsapp.js");
            const first = cart.contactName
              ? cart.contactName.split(" ")[0]
              : "";
            const message = first
              ? `Hi ${first}! Your Cold Stone bag is still waiting — ${formatXaf(cart.totalCents)}. Finish your order here: ${baseUrl(request)}/checkout`
              : `Your Cold Stone bag is still waiting — ${formatXaf(cart.totalCents)}. Finish your order here: ${baseUrl(request)}/checkout`;
            if (await sendWhatsAppText({ to: cart.phone, text: message }))
              sent += 1;
          } catch (error) {
            console.error(
              `WhatsApp recovery for checkout #${cart.checkoutId} failed:`,
              error.message,
            );
          }
        }
        const recentCount = await countAbandonedCartReminders(24);
        response.json({
          claimed: claimed.length,
          sent,
          remindersLast24h: recentCount,
        });
      } catch (error) {
        next(error);
      }
    },
  );

  app.use("/api", router);
}

function formatXaf(cents) {
  return `${Math.round(Number(cents) || 0).toLocaleString("en-US")} FCFA`;
}

function baseUrl(request) {
  const configured = process.env.FRONTEND_URL?.trim();
  if (configured) return configured.replace(/\/+$/, "");
  return `${request.protocol}://${request.get("host")}`;
}
