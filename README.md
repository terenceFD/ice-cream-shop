# Cold Stone Creamery Cameroon — Independent Guide

An independent, bilingual (English and French) guide to publicly listed Cold Stone Creamery locations and global menu categories in Cameroon, alongside a separate operator-managed online shop. Built with React, Vite, Tailwind CSS, Express, and PostgreSQL (Supabase) in production or SQLite in development.

Live site: https://ice-cream-shop-20eg.onrender.com

This website is not an official Cold Stone Creamery website and does not claim affiliation. Public branch listings and global menu categories are informational only. Local branch hours, current operations, menu, product availability, and prices require confirmation with the relevant store. The separate website catalog and checkout are managed by this site's operator; catalog items and prices are not verified Cold Stone Cameroon products or prices.

The `/locations` page lists publicly indexed areas in Bonanjo, Bonamoussadi, Bonabéri, and Ange Raphaël in Douala, and Bastos in Yaoundé. Listings are subject to change and include map-search links for confirmation. On `/menu`, customers browse image-led categories and product examples from the global brand menu, including Signature Creations; `/menu/all` lists every product on one page. Selecting a product shows its details, its FCFA price, a quantity selector with **Add to bag**, and similar products. These are not a confirmed Cameroon branch menu or prices; local availability, recipes, and prices may differ.

Research references:
- [Cold Stone Creamery global menu](https://www.coldstonecreamery.com/menu/)
- [Cold Stone Creamery Cameroon Instagram](https://www.instagram.com/coldstonecameroon/)
- [Cold Stone Creamery Cameroon Facebook](https://www.facebook.com/ColdStoneCreameryCameroon/)

## Features at a glance

**For customers**
- Browse the menu and shop catalog with search, category, dietary, availability ("In stock only") and maximum-price filters, and sort by price or name. On phones the filters fold away behind a **Filters** button. **All menu** (`/menu/all`) shows every product on one page, and products added in admin appear there and on **Flavors** automatically.
- Add any quantity of a product or flavor to the bag from its page and keep shopping.
- Order online for pickup or delivery from a chosen store, and pay by card (Stripe) or Mobile Money (CamPay).
- Customer accounts: order history with live progress, saved delivery details, favorites, one-tap reorder, loyalty points, and reviews of purchased items.
- **Notifications on their device** (with the site's logo and name): order updates (confirmed, being prepared, out for delivery, delivered) and new promotions. Customers turn them on from a small invitation, the account page, or the payment confirmation page.
- **Review reminder** a day after delivery, by notification and email, linking straight to that order's review form.
- **Parties & events** (`/events`): request a bulk order for a birthday, office event or wedding, get a quote from the store, and pay a 30% deposit online.
- Custom ice cream cake requests (`/custom-cake`).
- A **WhatsApp chat button** on every customer page.
- Installable app (web app manifest and service worker) that works offline for browsing.

**For the shop**
- Admin dashboard for flavors, menu, categories, inventory and low-stock alerts, orders, deliveries, payments, promotions, reports, customer accounts, reviews, cake requests, event orders, contact messages, pickup and delivery settings, admin accounts, and an activity log. Admins land on **Store overview** after signing in. See [Admin dashboard](#admin-dashboard).
- Promotions can notify every customer who turned on notifications, with an optional custom message and a phone preview; existing promotions can be re-sent.
- Order and event details include a one-tap **WhatsApp** button with the customer's update already written.
- Store admins see and manage only their own store's data.

## Project folders

```
src/
  app/          App routes and the entry point (main.tsx)
  pages/        One folder per page: home, menu, flavors, cart, checkout, payment, admin, …
  components/   Shared UI pieces; admin/ holds the dashboard layout, guards and notifications
  context/      Cart, customer sign-in and flavor providers with their hooks
  lib/          Small helpers (cart pricing, thumbnails, WhatsApp links, push, image upload)
  language/     French translations and the language switcher
  seo/          Page titles and meta tags
  api/          Calls to the server
shared/         Code used by both the site and the server (menu data, photo sizes, currency, dates)
server/         Express API, database, payments, email and push notifications
scripts/        Dev runner, thumbnail maker, migrations and tests for shared code
public/         Photos, icons and fonts served as-is
assets/original-photos/   Original photos kept for reference (not served)
```

## Getting started

Install dependencies and create a local environment file:

```sh
npm install
```

Copy `.env.example` to `.env`, then set `JWT_SECRET` to a unique random value of at least 32 characters. For the first admin account, set `ADMIN_NAME`, `ADMIN_EMAIL`, and a unique `ADMIN_PASSWORD` of at least 8 characters.

Create the first admin once:

```sh
npm run seed:admin
```

Start the API and frontend together:

```sh
npm run dev
```

The development command waits for the Express API health check on port 3001 before starting Vite, which proxies `/api` and `/uploads` requests to the API. To run either process separately, use `npm run dev:server` for the API or `npm run dev:frontend` for Vite. Do not commit `.env` or the SQLite database.

### Databases: keep development separate from the live site

- **Production (Render)** uses the Supabase PostgreSQL database set by `DATABASE_URL`.
- **Local development** should use its own SQLite file (`server/database.sqlite`, created automatically). Set `DATABASE_BACKEND=sqlite` in your local `.env` and keep the Supabase `DATABASE_URL` commented out, so testing never changes live orders or customer accounts.

On start-up the server creates any missing tables and columns it needs (for example notification devices, review reminders and event orders) on both SQLite and PostgreSQL, so new features need no manual database step.

## Production

Build the React frontend and run the Express server:

```sh
npm run build
npm start
```

The production server serves the build from `dist/` and the API from the same origin. Configure `PORT`, a unique `JWT_SECRET`, and `FRONTEND_URL` (the public storefront address, used for payment returns and links in emails) in the hosting environment. On Render, the service origin is also allowed automatically from `RENDER_EXTERNAL_URL` or `RENDER_EXTERNAL_HOSTNAME`, and Express trusts Render's single reverse-proxy hop so rate limits use the client IP.

**Render does not read your local `.env`.** Every setting the live site needs (database, email, payments, notifications, storage, WhatsApp) must be added on the Render service's **Environment** page. See [Settings reference](#settings-reference).

If the frontend and API must be hosted separately, set `VITE_API_URL` to the API origin before building the frontend and set `FRONTEND_ORIGINS` on the API server to include the exact public frontend origin.

### Performance

- Photos in `public/` are compressed (at most 1200 px on the longest side).
- Every photo in `public/` also gets smaller WebP copies (160, 480 and 800 px) under `public/thumbs/<width>/`, made by `scripts/make-thumbnails.mjs` before each build and dev start (not committed). The size rules are in `shared/photoSizes.js`: pages use `srcset`/`sizes` so the browser downloads the smallest copy that is still sharp, and tiny pictures use the 160 px copy. Unsplash photos are resized by Unsplash the same way.
- The server adds a preload tag for each page's main photo (home slider, page headers, flavor pages) so it downloads straight away instead of after the app's code. The home slider downloads only the slide on screen and the next one.
- The fonts (DM Sans and Fredoka) are served from `public/fonts/` and preloaded, so pages never wait on Google before showing text.
- Uploaded images are resized on the server to at most 1200 px and saved as WebP (GIFs are kept as they are), see `server/images.js`.
- Pages load their own code only when opened, so first-time visitors don't download the admin dashboard.
- Files under `/assets/` are cached by browsers for a year (their names change with every build); photos and icons for a week. `sw.js` and the web app manifest are never cached, so updates reach visitors immediately. Raise `CACHE_NAME` in `public/sw.js` when the offline copy of the page should be refreshed.
- On phones and tablets (below 1024 px), the shopping pages (Menu, Flavors, All menu) leave out the photo collage in their header, so products start on the first screen. The breakpoint is `COMPACT_HERO_MEDIA` in `shared/photoSizes.js`, shared with the server's photo preload.
- The server compresses pages, scripts, styles and API answers itself (`compression`), so they stay small even on a host without a CDN.
- The active promotion is sent with each page as a JSON block (`id="initial-promotion"`, added in `server/seo.js` and cached for 30 seconds), so the yellow promotion bar is there from the first paint instead of pushing the page down when it arrives.
- The website loader (`src/components/WebsiteLoader.tsx`) leaves as soon as the page's content is drawn, after at least 0.35 seconds, rather than waiting for every image.
- Sections already on screen are shown straight away; only content further down fades in as it scrolls into view. `src/components/ScrollRevealObserver.tsx` learns where elements are from `IntersectionObserver`, because measuring them directly forces extra page layouts.
- Decorative glows are soft radial gradients rather than blurred shapes, which are slow to draw on phones. Prices are formatted with one shared, reused formatter (`numberFormatter` in `src/lib/cartPricing.ts`).

### Supabase

To copy a SQLite database into a **new, empty** Supabase project, set `DATABASE_URL` to the Supabase session-pooler URI and run:

```sh
npm run migrate:supabase
```

The script defaults to `server/database.sqlite`; use `--source=path/to/database.sqlite` to choose another source. It copies tables in dependency order, preserves IDs, resets sequences, and stops if application tables already exist. Back up the source first; it does not merge databases.

Both the migration and the application verify the PostgreSQL server certificate. If your environment does not trust Supabase's certificate chain, download the CA certificate from the Supabase database settings and set `DATABASE_SSL_CA_FILE` to its path. Do not disable certificate verification.

**Backups:** check your Supabase plan's backup policy and export the database regularly if automatic daily backups are not included.

### Image uploads

Admin image uploads (menu items and flavors, including "Upload from device" in the flavor form) are stored in **Supabase Storage** when `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are set; a public bucket named `menu-images` (or `SUPABASE_STORAGE_BUCKET`) is created on the first upload. Hosts such as Render wipe the server disk on every deploy, so the live site refuses uploads with a clear message when storage is not configured. Locally, without these settings, uploads are saved to `server/uploads/`. Large photos are resized in the browser before upload, and the server then shrinks every upload to at most 1200 px WebP. The server log shows `Image uploads are stored in: supabase | local-disk | invalid-supabase-url` at start-up.

### Store admin access

An owner account has access to all stores and can create a store admin from **Admin accounts**, assigning that login to one branch. Store admins can access only that branch's orders, payments, related customer accounts, order reviews, custom-cake requests, event orders, contact messages, and sales reports; the server enforces the same scope for reads and updates. Catalog, inventory, discounts, promotion notifications, and fulfillment configuration remain owner-managed.

### Menu products

Built-in menu products live in `shared/data.js`. A product's ID is built from its category and name, and stock, orders, favorites and reviews are saved under that ID. To rename a product, change `name` and add `idName` with the old name, so the ID stays the same (`scripts/menu-ids.test.js` checks this, and that no two products share an ID or a photo). The server adds stock rows for new products at start-up.

Built-in category descriptions are stored in the database. To change one for existing sites, add a row to `CATEGORY_DESCRIPTION_UPDATES` in `server/database.js` (old text, new text): the server updates it at start-up only if the old text is still there, so a description an admin has edited is kept. Category photos work the same way with `CATEGORY_IMAGE_UPDATES`.

### Flavor tags

Each flavor has one tag, shown on its card and used as a filter on `/flavors`. A tag only becomes a filter button when two or more flavors share it, so give flavors a small set of family tags (for example **Classics**, **Fruity**, **Chocolate**, **Caramel & coffee**) rather than a different tag each. French names for tags go in `src/language/french.ts`.

## Payments and order management

Checkout offers card payments through Stripe and Cameroon Mobile Money through CamPay when configured. Use a Stripe test-mode key (`sk_test_…`) while developing and the live key (`sk_live_…`) on the live site. To enable CamPay, set `CAMPAY_ENVIRONMENT` (`DEV` for the sandbox, `PROD` only after CamPay has approved the merchant account), `CAMPAY_APP_USERNAME`, `CAMPAY_APP_PASSWORD`, and `CAMPAY_MOBILE_MONEY_ENABLED=true`. CamPay's hosted page handles payment authorization; this website never collects Mobile Money PINs or OTPs. Card details are entered on Stripe and never stored by this app.

The server creates each order from current database prices, applies the Buy 2 Get 1 Free offer or an eligible discount code, supports account-only loyalty redemptions (1 point per 100 FCFA spent; 100 points = 1,000 FCFA off; not combinable with another discount), reserves stock during checkout, and records fulfillment, schedule and payment details. Reserved stock is deducted only after the provider confirms payment, or released when it confirms failure.

**Stripe webhook:** register `https://<your-site>/api/stripe/webhook` in the Stripe dashboard (in live mode for the live site) and subscribe to `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, and `checkout.session.expired`. Set the signing secret as `STRIPE_WEBHOOK_SECRET`. For local testing, forward events with the Stripe CLI to `http://localhost:3001/api/stripe/webhook`. Without the webhook, payments are still confirmed when the customer returns to the site and by a background check every few minutes. CamPay returns are verified server-side against transaction status, reference, amount and currency.

Paid orders appear in **Orders**, where admins set accepted, preparing, ready, out-for-delivery, or delivered progress; delivered orders also appear in **Delivered**. New-order emails to admins include a link that opens that exact order in the dashboard (and survives the admin sign-in page). The customer who placed the order never receives the admin email, even if their address belongs to an admin.

Inventory: admins set stock per flavor and menu item, availability, low-stock thresholds and dietary tags in **Menu inventory**; **Low-stock alerts** lists unavailable items and items at or below their threshold. Sold-out items cannot be ordered.

## Notifications (Web Push)

Customers with an account can turn on notifications. They then receive, on that device and even when the site is closed:

| When | Notification |
|---|---|
| Account created (sign-up form's "Notify me on this device", ticked by default) | "Welcome to Cold Stone Creamery, Agnes!", sent once, only to accounts under 7 days old |
| Payment confirmed | "Order #12 confirmed" |
| Staff update the order | accepted · being prepared · ready (or ready for pickup at the store) · out for delivery · delivered |
| A day after delivery | "How was order #12?" review reminder |
| The owner creates or re-sends a promotion | the discount and code, or the owner's own message |
| Event orders | quote ready · deposit received · confirmed · declined or cancelled |

Each order's updates replace each other, so a customer never collects a pile of notifications. Signing out turns notifications off on that device. On iPhone and iPad, notifications work only after the site is added to the Home Screen and opened from there; private/incognito windows refuse them.

**Set-up:** generate one key pair and set both values on the server:

```sh
npx web-push generate-vapid-keys
```

Set `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, and `VAPID_SUBJECT` (the site's address or a contact `mailto:`). The server checks at start-up that the two keys are a matching pair and otherwise switches notifications off with a clear reason. If the keys are ever replaced, customers' browsers renew their subscription automatically the next time they open the site.

**Promotions page:** a status line shows whether notifications are ready and how many customer devices have them on. Creating an active code offers **Notify customers** with an optional message (up to 180 characters; the code is added if the message leaves it out) and a phone preview. After sending, the page reports how many devices received it and the push service's reason for any failure. The bell button on an active code re-sends its notification.

**Review reminders** run hourly: orders delivered 24 hours to 7 days ago, not yet reviewed and not yet reminded, get one notification and one email. `REVIEW_REMINDER_DELAY_HOURS` changes the delay (useful for testing).

## Parties & events

Signed-in customers request bulk orders at `/events`: event type, date (2 to 180 days ahead), time, guests, delivery or pickup, store, phone, and at least 10 items in total from the current menu. They see a live estimate and the suggested 30% deposit; nothing is charged at this stage.

1. The store's admins and owners receive an email with a link to the request.
2. In **Event orders**, staff review it, set or adjust the total and deposit, add an optional note, and **Send quote**. The customer gets an email and a notification.
3. The customer pays the deposit on `/events` by card (Stripe) or Mobile Money (CamPay). The server verifies the payment with the provider before marking it paid; the Stripe webhook handles deposits too.
4. Staff **Confirm event**, and later **Mark completed**. Requests can be declined, and events cancelled (refund any deposit manually through Stripe or CamPay).

Prices are always recalculated on the server from the menu; the deposit uses the same payment configuration as regular orders.

## WhatsApp

- **Chat button:** set `WHATSAPP_NUMBER` (international format, for example `237690000000`) and a green WhatsApp button appears on customer pages, opening a chat with a greeting already typed. Without the setting the button stays hidden. It never appears on admin, checkout or payment pages.
- **Order updates:** each order in **Orders** has **Send update on WhatsApp**, which opens a chat with the customer and the current step already written (for example "your order #12 is out for delivery"). Event orders have a **Chat on WhatsApp** button. Staff review and send each message.
- **Customer accounts** can prepare promotion messages in WhatsApp one customer at a time.
- Fully automatic WhatsApp messages would require a WhatsApp Business account approved by Meta (WhatsApp Cloud API); this is not set up.

## Email

Email is used for contact-form replies, admin new-order and cake/event request notices, customer order updates, payment receipts (`PAYMENT_CONFIRMATION_EMAILS_ENABLED=true`), event quotes, and review reminders. Configure `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`, and `SMTP_FROM`.

With **Brevo** (`smtp-relay.brevo.com`):
- Use port `587` locally. **On Render's free plan, outgoing ports 25, 465 and 587 are blocked: use `SMTP_PORT=2525`** with `SMTP_SECURE=false`.
- `SMTP_PASSWORD` is a Brevo **SMTP key**, not your account password.
- Turn off IP blocking for SMTP keys (Brevo: Settings › Security › Authorized IPs) or authorize the server's outbound addresses; hosts and mobile networks change IP addresses.
- Verify `SMTP_FROM` as a sender in Brevo. A sender on your own domain delivers more reliably than a Gmail address.

When a reply cannot be sent, the dashboard shows the mail server's reason in plain words (blocked IP, rejected login, refused sender, or unreachable server). Email failures are logged and never reverse orders or payments.

## About, contact and the activity log

`/about` shares the shop story and `/contact` sends visitor messages to the selected store; replies are sent from the admin **Notifications** page. The **Activity log** (owners only) records every successful change made in the dashboard by any admin, with the admin's name, the action and the time (the latest 200 entries); page views are not recorded. Entries read as plain sentences ("Marked order #54 delivered"), are grouped by day, and can be filtered by person and by area.

## Admin dashboard

The dashboard pages share a few building blocks in `src/pages/admin/`:

| File | What it does |
|---|---|
| `AdminPageHeader.jsx`, `adminIcons.js` | Page header (icon, breadcrumb, title, actions), stat cards, notices and on/off switches in the dashboard style |
| `adminTable.js` | Keeps the Edit/Delete column of wide tables pinned to the right, so it stays visible when a table scrolls sideways |
| `stockMeter.js` | Stock bars: full at four times the low-stock alert level or more, shrinking as stock runs down (`scripts/stock-meter.test.js`) |
| `chartScale.js` | Round chart axes (2K, 4K, 6K…) for the Reports bar chart (`scripts/chart-scale.test.js`) |
| `describeAdminActivity.js` | The plain-English sentence for each admin action in the activity log |

**Adding an admin action:** when you add a new `POST`, `PUT`, `PATCH` or `DELETE` route under `/api/admin`, add its sentence to `describeAdminActivity.js`. `scripts/admin-activity.test.js` fails if any admin route is missing one, so it never shows up in the log as "Made a change".

On phones, the stat cards at the top of each page become one row that scrolls sideways (the `.admin-stats` class in `src/index.css`), so the page's list starts on the first screen. The admin profile picture is changed from the account menu at the top right.

## Settings reference

| Setting | Purpose |
|---|---|
| `PORT`, `JWT_SECRET` | Server port; secret for sign-in sessions (32+ characters) |
| `FRONTEND_URL`, `FRONTEND_ORIGINS` | Public site address for payment returns and email links; allowed browser origins |
| `DATABASE_URL`, `DATABASE_BACKEND`, `DATABASE_SSL_CA_FILE` | Supabase PostgreSQL connection; `sqlite` locally; CA certificate path |
| `ADMIN_NAME`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` | Only for `npm run seed:admin` |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM` | Email delivery (use port 2525 on Render's free plan) |
| `PAYMENT_CONFIRMATION_EMAILS_ENABLED` | `true` to email customers a receipt after payment |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | Card payments and the Stripe webhook |
| `CAMPAY_ENVIRONMENT`, `CAMPAY_APP_USERNAME`, `CAMPAY_APP_PASSWORD`, `CAMPAY_MOBILE_MONEY_ENABLED` | Mobile Money payments |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_STORAGE_BUCKET` | Image uploads in Supabase Storage |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | Device notifications |
| `REVIEW_REMINDER_DELAY_HOURS` | Hours after delivery before the review reminder (default 24) |
| `WHATSAPP_NUMBER` | The shop's WhatsApp number for the chat button |
| `SITE_URL` | Optional fixed public address for the sitemap and page links |

## Checks

```sh
npm run lint
npm test
npm run build
```

`npm test` runs every server test with temporary databases, plus the checks in `scripts/*.test.js` (menu IDs, photo sizes, similar items, admin activity sentences, stock bars, and chart axes); it never touches your development or live data.
