# Antixor Icy

A responsive ice-cream shop built with React, Vite, and Tailwind CSS, backed by an Express API and SQLite database.

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

Run the API and frontend in separate terminals:

```sh
npm run dev:server
npm run dev
```

The Express API listens on port 3001 and Vite proxies `/api` requests to it. SQLite creates `server/database.sqlite` automatically and seeds the initial flavor catalog on first start. Customer registrations and flavor changes are persisted in this database. Do not commit `.env` or the SQLite database.

## Payments and order management

Checkout offers Card, MTN Mobile Money, Orange Money, and Crypto. Card payments use Stripe-hosted Checkout; set `STRIPE_SECRET_KEY` in `.env` to a Stripe test-mode secret key while developing. MTN Mobile Money, Orange Money, and Crypto are shown as coming soon and cannot be selected until their payment providers are integrated. The server creates each order from current database prices, applies the Buy 2 Get 1 Free discount, reserves available flavor stock during checkout, and records the order and payment state in SQLite. Reserved stock is deducted only after Stripe confirms payment, or released when Stripe reports an expired or failed session. Checkout sessions expire after 40 minutes; the server reconciles older sessions periodically as a fallback if a webhook is unavailable. Card details are entered on Stripe and are never stored by this app. A payment is marked paid only after Stripe confirms it.

For local webhook testing, configure Stripe CLI to forward events to `http://localhost:3001/api/stripe/webhook` and set the generated signing secret as `STRIPE_WEBHOOK_SECRET`. In production, register that endpoint in Stripe and subscribe to `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, and `checkout.session.expired`. Set `FRONTEND_URL` to the storefront origin used for checkout return and cancellation. Webhooks update orders immediately if a customer closes Stripe Checkout without returning to the shop; periodic Stripe reconciliation is the fallback.

Admins can set starting stock when adding a flavor and adjust its stock quantity from the flavor editor. Sold-out flavors are hidden from the storefront and direct flavor pages redirect to the catalog. Existing flavors are migrated with an initial stock of 100; admins can adjust those quantities to match physical inventory.

The admin dashboard has separate **Orders**, **Delivered**, and **Payments** pages. Paid orders appear in Orders and can be marked delivered; delivered orders then appear in Delivered. Payments lists Stripe payment records. These views are protected by admin authentication. When checkout successfully creates an order and Stripe session, the server emails the configured admin accounts a new-order notification with customer/order details and a direct link to the Orders page. Configure SMTP as described below; notification email failures are logged and do not interrupt customer checkout.

## About and contact

The `/about` page shares the shop story, and the `/contact` page submits visitor messages to SQLite. Admins can review new messages in the dashboard's **Contact notifications** inbox, mark them as read, and reply by email. To send replies and order notifications, configure `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, and `SMTP_FROM` in `.env`. Set `SMTP_USER` and `SMTP_PASSWORD` when the email provider requires authentication. Contact replies are sent only after the SMTP server accepts the message; the contact's email address is used as the recipient.

## Checks

```sh
npm run lint
npm run build
```
