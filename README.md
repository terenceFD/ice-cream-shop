# Cold Stone Creamery Cameroon — Independent Guide

An independent, bilingual guide to publicly listed Cold Stone Creamery locations and global menu categories in Cameroon, alongside a separate operator-managed online catalog. Built with React, Vite, Tailwind CSS, Express, and SQLite.

This website is not an official Cold Stone Creamery website and does not claim affiliation. Public branch listings and global menu categories are informational only. Local branch hours, current operations, menu, product availability, and prices require confirmation with the relevant store. The separate website catalog and checkout are managed by this site's operator; catalog items and USD prices are not verified Cold Stone Cameroon products or prices.

The `/locations` page currently lists publicly indexed areas in Bonanjo, Bonamoussadi, Bonabéri, and Ange Raphaël in Douala, and Bastos in Yaoundé. Listings are subject to change and include map-search links for confirmation. Checkout lets customers select the branch that will handle their pickup or delivery, view its listed address, and enter their residence details. The order stores a durable branch reference and a snapshot of its displayed details; admins can see the assigned branch, filter orders by branch, and receive the branch in new-order email notifications. Existing orders are assigned to a branch when their saved area matches a listed branch. On `/menu`, browse image-led categories and product examples from the global brand menu, including Signature Creations. Selecting a product shows its details, an illustrative FCFA estimate, and similar products. Selecting **Order now** adds that example to the cart and uses a separate XAF Stripe checkout; the server validates menu items and prices independently, and Stripe must support XAF for payment to proceed. These are not a confirmed Cameroon branch menu or prices; local availability, recipes, and prices may differ. Menu photos are local copies of the files supplied in `menu-images/`.

No current itemized Cameroon price list could be verified. Search-result snippets that mention a starting price are not treated as a confirmed branch price because the item, serving size, and date could not be established. The online shop continues to use the existing operator-managed USD catalog and checkout; it is explicitly separated from the Cold Stone information guide.

Research references:
- [Cold Stone Creamery global menu](https://www.coldstonecreamery.com/menu/)
- [Cold Stone Creamery Cameroon Instagram](https://www.instagram.com/coldstonecameroon/)
- [Cold Stone Creamery Cameroon Facebook](https://www.facebook.com/ColdStoneCreameryCameroon/)

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

The development command waits for the Express API health check on port 3001 before starting Vite, which proxies `/api` requests to the API. To run either process separately, use `npm run dev:server` for the API or `npm run dev:frontend` for Vite. SQLite creates `server/database.sqlite` automatically. Customer registrations and flavor changes are persisted in this database. Do not commit `.env` or the SQLite database.

## Production

Build the React frontend and run the Express server:

```sh
npm run build
npm start
```

The production server serves the build from `dist/` and the API from the same origin, so `/api` requests do not need a separate proxy. Configure `PORT` and a unique `JWT_SECRET` of at least 32 characters in the hosting environment. Set `FRONTEND_URL` to the public storefront URL for checkout returns. On Render, the service origin is also allowed automatically from `RENDER_EXTERNAL_URL` or `RENDER_EXTERNAL_HOSTNAME`. Keep the server process running; `vite preview` alone only serves the frontend and does not provide the API.

If the frontend and API must be hosted separately, set `VITE_API_URL` to the API origin before building the frontend and set `FRONTEND_ORIGINS` on the API server to include the exact public frontend origin.

## Payments and order management

Checkout offers Card, MTN Mobile Money, Orange Money, and Crypto. Card payments use Stripe-hosted Checkout; set `STRIPE_SECRET_KEY` in `.env` to a Stripe test-mode secret key while developing. MTN Mobile Money, Orange Money, and Crypto are shown as coming soon and cannot be selected until their payment providers are integrated. The server creates each order from current database prices, applies the Buy 2 Get 1 Free offer or an eligible discount code, supports account-only loyalty redemptions (1 point per 100 FCFA spent; 100 points = 1,000 FCFA off; loyalty rewards cannot be combined with another discount), reserves stock during checkout, and records fulfillment, schedule, and payment details in SQLite. Reserved stock is deducted only after Stripe confirms payment, or released when Stripe reports an expired or failed session. Orders fully paid by loyalty points do not require a Stripe checkout. Checkout sessions expire after 40 minutes; the server reconciles older sessions periodically as a fallback if a webhook is unavailable. Card details are entered on Stripe and are never stored by this app. A payment is marked paid only after Stripe confirms it.

For local webhook testing, configure Stripe CLI to forward events to `http://localhost:3001/api/stripe/webhook` and set the generated signing secret as `STRIPE_WEBHOOK_SECRET`. In production, register that endpoint in Stripe and subscribe to `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, and `checkout.session.expired`. Set `FRONTEND_URL` to the storefront origin used for checkout return and cancellation. Webhooks update orders immediately if a customer closes Stripe Checkout without returning to the shop; periodic Stripe reconciliation is the fallback.

Admins can set starting stock when adding a flavor and adjust its stock quantity from the flavor editor. In **Menu inventory**, admins can set stock, availability, low-stock thresholds, and dietary tags for each menu item. **Low-stock alerts** automatically lists unavailable items and items at or below their threshold. Sold-out flavors are hidden from the storefront and direct flavor pages redirect to the catalog; sold-out menu items cannot be added to an order. Existing flavors and menu items are initialized with stock of 100; admins should adjust these quantities to match physical inventory.

The storefront menu supports search, category, maximum-price, availability, and dietary filters. Admins manage categories (including display order) in **Categories**; a category cannot be deleted while it contains built-in or custom items. **Menu management** supports JPEG, PNG, WebP, and GIF uploads up to 5 MB. Uploaded images are stored under `server/uploads/` and served from `/uploads/`.

Customers can create an account with their name, email, and password, save delivery details, view their order history and fulfillment progress at `/account/orders`, earn/redeem points, save favorites, reorder past purchases, and submit a review for a purchased item. Existing customer accounts can sign in and continue using account features; their existing order and profile data is preserved. Reviews are held for admin approval before appearing publicly. In **Customer accounts**, admins can view registered customers, ban or restore account access, and prepare individual promotion messages in WhatsApp. **Send to all** opens a prefilled WhatsApp chat one active customer at a time for customers with valid phone numbers; the admin reviews and sends each message before moving to the next chat. Guest checkout remains available. **Pickup and delivery** lets admins configure enabled locations, delivery fees, and non-overlapping time slots; pickup is enabled by default and delivery must be activated and priced by an admin before customers can select it. Checkout revalidates the location, mode, date, slot, stock, price, and discount on the server. Paid orders appear in **Orders** and admins can set accepted, preparing, ready, out-for-delivery, or delivered progress; delivered orders also appear in **Delivered**. Customers can submit custom-cake requests for a selected size, flavor, message, toppings, and pickup date; a request is not a confirmed order or price quote, and admins manage requests in **Cake requests**. **Payments** lists Stripe payment records, **Promotions** manages fixed or percentage discount codes, and **Reports** summarizes sales and inventory. Active discount codes with an expiry are shown as a public countdown; the nearest-expiring eligible offer is displayed, and the banner disappears once it expires. These views and updates are protected by admin authentication.

When checkout successfully creates an order and Stripe session, the server emails configured admin accounts a new-order notification. On payment confirmation, customers receive an email receipt; further fulfillment changes send email progress updates. Custom-cake requests are also emailed to admins and appear in the dashboard. These email features require SMTP; failures are logged and do not reverse successful orders, payments, or cake requests. SMS delivery is not configured.

The site includes a web app manifest, installable icon, keyboard skip link, visible focus indicators, reduced-motion support, and a service worker that caches the application shell and static assets for offline browsing. API-backed checkout, account, and admin actions still require a connection.

## About and contact

The `/about` page shares the shop story, and the `/contact` page submits visitor messages to SQLite. Admins can review new messages in the dashboard's **Contact notifications** inbox, mark them as read, and reply by email. Replies, admin order notifications, customer order updates, and cake-request notifications require SMTP; configure `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, and `SMTP_FROM` in `.env`. Set `SMTP_USER` and `SMTP_PASSWORD` when the email provider requires authentication.

## Checks

```sh
npm run lint
npm run build
```
