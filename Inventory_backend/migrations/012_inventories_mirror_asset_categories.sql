-- Optional: create `inventories` rows that mirror the **Assets hub category cards**
-- (titles + blurbs from `inventory-frontend/src/app/assets/asset-category.config.ts`).
-- Categories themselves are frontend routes (`/assets/systems`, etc.); this only adds
-- **named inventory lists** in MySQL so they show in the inventory dropdown and can hold `assets.inventory_id`.
--
-- Run on `inventory_system`. Safe to re-run: skips any inventory whose `name` already exists.

USE inventory_system;

INSERT INTO inventories (name, details, created_at)
SELECT 'Computers & workstations',
       CONCAT('Category slug: systems\n\n', 'Systems, laptops, desktops — assign to employees via Sessions.'),
       NOW()
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM inventories WHERE name = 'Computers & workstations');

INSERT INTO inventories (name, details, created_at)
SELECT 'Cameras & imaging',
       CONCAT('Category slug: cameras\n\n', 'Webcams and network cameras — inventory & repairs only (not session checkout).'),
       NOW()
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM inventories WHERE name = 'Cameras & imaging');

INSERT INTO inventories (name, details, created_at)
SELECT 'Power & electrical',
       CONCAT('Category slug: power\n\n', 'Extension boards, UPS, strips — assign via Sessions or track by serial / model.'),
       NOW()
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM inventories WHERE name = 'Power & electrical');

INSERT INTO inventories (name, details, created_at)
SELECT 'Network equipment',
       CONCAT('Category slug: network\n\n', 'Routers, switches, Wi‑Fi — same repair flow as other assets.'),
       NOW()
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM inventories WHERE name = 'Network equipment');

INSERT INTO inventories (name, details, created_at)
SELECT 'Peripherals & storage',
       CONCAT('Category slug: peripherals\n\n', 'Keyboards, docks, monitors, external drives, phones — assign via Sessions like computers.'),
       NOW()
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM inventories WHERE name = 'Peripherals & storage');

INSERT INTO inventories (name, details, created_at)
SELECT 'AV & print',
       CONCAT('Category slug: av-print\n\n', 'Printers, scanners, projectors.'),
       NOW()
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM inventories WHERE name = 'AV & print');

INSERT INTO inventories (name, details, created_at)
SELECT 'Cables',
       CONCAT('Category slug: cables\n\n', 'HDMI, display, and network cables — assign via Sessions or track in inventory.'),
       NOW()
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM inventories WHERE name = 'Cables');

INSERT INTO inventories (name, details, created_at)
SELECT 'Furniture',
       CONCAT('Category slug: furniture\n\n', 'Desks, chairs — optional serial or asset tag in Serial field.'),
       NOW()
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM inventories WHERE name = 'Furniture');

INSERT INTO inventories (name, details, created_at)
SELECT 'Other inventory',
       CONCAT('Category slug: other\n\n', 'Anything that does not fit the categories above (custom types, accessories).'),
       NOW()
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM inventories WHERE name = 'Other inventory');

-- After you set `assets.inventory_id` to these rows, migration 011 triggers (if applied)
-- keep `asset_count` / `asset_names` in sync; otherwise summaries appear once 011 runs.
