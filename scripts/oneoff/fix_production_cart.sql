-- Runs in the Supabase SQL Editor: fixes the 500 on /api/menu, which is what breaks the cart
-- page (it loads the menu for its suggestions).
--
-- Why it is needed: production predates these columns. The public menu query selects them, so
-- until they exist every /api/menu request fails and any page that reads the menu with it.
--
-- Safe to run more than once. Every statement only adds what is missing.

-- Menu inventory: stock flags, dietary tags and the columns added this month.
ALTER TABLE menu_inventory ADD COLUMN IF NOT EXISTS dietary_tags TEXT NOT NULL DEFAULT '[]';
ALTER TABLE menu_inventory ADD COLUMN IF NOT EXISTS is_available SMALLINT NOT NULL DEFAULT 1;
ALTER TABLE menu_inventory ADD COLUMN IF NOT EXISTS low_stock_threshold INTEGER NOT NULL DEFAULT 5;
ALTER TABLE menu_inventory ADD COLUMN IF NOT EXISTS restock_eta TEXT;
ALTER TABLE menu_inventory ADD COLUMN IF NOT EXISTS allergens TEXT NOT NULL DEFAULT '[]';

-- Any built-in product still missing its inventory row gets one (stock defaults to 100).
INSERT INTO menu_inventory (item_id)
SELECT item_id FROM (VALUES
  ('menu:ice-cream:birthday-cake-remix'),
  ('menu:ice-cream:create-your-own-creation'),
  ('menu:ice-cream:banana-split-decision'),
  ('menu:ice-cream:mix-go'),
  ('menu:ice-cream:pre-packed-ice-cream')
) AS items(item_id)
ON CONFLICT (item_id) DO NOTHING;

-- Verify afterwards: this must return 5.
-- SELECT COUNT(*) FROM information_schema.columns
--  WHERE table_schema = 'public' AND table_name = 'menu_inventory'
--    AND column_name IN ('is_available','dietary_tags','low_stock_threshold','restock_eta','allergens');
