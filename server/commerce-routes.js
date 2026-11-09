// REST endpoints for bundles, wishlist, cash on delivery and the WhatsApp
// recovery sweep. Registered from server/index.js.

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

// The auth guards close over the JWT secret in server/index.js, so the caller
// passes them in rather than this module importing them.
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
  // requireOwner(request, response) answers a boolean instead of calling next(),
  // so it is wrapped: Express would otherwise stop the chain after it.
  const requireOwnerAdmin = [
    requireAdmin,
    (request, response, next) => {
      if (requireOwner(request, response)) next();
    },
  ];
  const router = express.Router();

  const wishlistLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 120,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: { error: "Too many wishlist updates. Wait a few minutes." },
  });

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

  // Shared, read-only, and open: a recipient link works without an account.
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



  router.get("/payment-methods", async (_request, response) => {
    const cod = await getCashOnDeliveryConfig();
    response.json({ cashOnDelivery: cod });
  });


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
        // The COD marker lives on the payment row, not the order.
        const order = await database
          .prepare(
            `SELECT o.id FROM orders o JOIN payments p ON p.order_id = o.id
           WHERE o.id = ? AND p.payment_provider = 'cod'`,
          )
          .get(id);
        if (!order) {
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

  // Every role reads the config so the dashboard can show it; writes stay owner-only.
  router.get(
    "/admin/settings/cash-on-delivery",
    requireAdmin,
    async (_request, response, next) => {
      try {
        response.json(await getCashOnDeliveryConfig());
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
