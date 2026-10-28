-- Production cleanup: deletes all test accounts, orders, cake requests, event
-- orders and contact messages, EXCEPT Terence Timah (customer 23, admin 1).
-- Verified ID-safe: Terence's production IDs match the local ones.
--
-- HOW TO RUN: Supabase dashboard → SQL Editor → paste → Run.
-- Every statement is idempotent — running it twice changes nothing the second time.

BEGIN;

-- Children of customers/orders first, so nothing is left orphaned.
DELETE FROM menu_reviews
 WHERE order_id NOT IN (SELECT id FROM orders WHERE customer_id = 23);

DELETE FROM order_items
 WHERE order_id NOT IN (SELECT id FROM orders WHERE customer_id = 23);

DELETE FROM payments
 WHERE order_id NOT IN (SELECT id FROM orders WHERE customer_id = 23);

DELETE FROM loyalty_ledger      WHERE customer_id <> 23;
DELETE FROM customer_favorites  WHERE customer_id <> 23;
DELETE FROM customer_saved_carts WHERE customer_id <> 23;
DELETE FROM push_subscriptions WHERE customer_id IS NULL OR customer_id <> 23;
DELETE FROM push_subscriptions WHERE admin_id  IS NULL OR admin_id  <> 1;

-- All orders from other users (Terence's own orders are kept).
DELETE FROM orders WHERE customer_id <> 23 OR customer_id IS NULL;

-- All cake requests, event orders, contact messages.
DELETE FROM cake_requests;
DELETE FROM event_orders;
DELETE FROM contact_messages;

-- Test admin accounts and their audit trail.
-- KEPT: id=1 Terence Timah, id=2 forteh miright (both real owner accounts).
DELETE FROM admin_activity WHERE admin_id NOT IN (1, 2);
DELETE FROM admins         WHERE id    NOT IN (1, 2);

-- Test customer accounts.
DELETE FROM customers WHERE id <> 23;

-- Leftover verification records from testing.
DELETE FROM pending_customer_signups;
DELETE FROM password_resets;

COMMIT;

-- Verify the result:
-- SELECT COUNT(*) FROM customers;       -- expect 1
-- SELECT id, name, email, role FROM admins;  -- expect Terence Timah AND forteh miright
-- SELECT COUNT(*) FROM orders;          -- expect Terence's orders only
-- SELECT COUNT(*) FROM cake_requests;   -- expect 0
-- SELECT COUNT(*) FROM event_orders;    -- expect 0
-- SELECT COUNT(*) FROM contact_messages; -- expect 0
